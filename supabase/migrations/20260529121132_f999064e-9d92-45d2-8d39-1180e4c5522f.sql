-- ============ CLEAN UP CONFLICTING PRIOR-SESSION OBJECTS ============
DROP TABLE IF EXISTS public.comments CASCADE;
DROP TABLE IF EXISTS public.deliverables CASCADE;
DROP TABLE IF EXISTS public.client_access CASCADE;
DROP FUNCTION IF EXISTS public.is_client_for_project(uuid, uuid);

-- Old activity-logging triggers insert into activity without workspace_id -> drop them
DROP TRIGGER IF EXISTS trg_task_activity ON public.tasks;
DROP TRIGGER IF EXISTS trg_milestone_activity ON public.milestones;
DROP TRIGGER IF EXISTS trg_file_activity ON public.files;

-- Drop policies that reference columns/types being changed
DROP POLICY IF EXISTS "Admins can manage projects" ON public.projects;
DROP POLICY IF EXISTS "Members and admins can view projects" ON public.projects;
DROP POLICY IF EXISTS "Owners can update their projects" ON public.projects;
DROP POLICY IF EXISTS "Admins delete tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins manage tasks" ON public.tasks;
DROP POLICY IF EXISTS "Project members can update task status" ON public.tasks;
DROP POLICY IF EXISTS "Project members can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins manage milestones" ON public.milestones;
DROP POLICY IF EXISTS "Project members can view milestones" ON public.milestones;
DROP POLICY IF EXISTS "Admins can manage membership" ON public.project_members;
DROP POLICY IF EXISTS "Members can view membership" ON public.project_members;

-- ============ PROJECTS ============
ALTER TABLE public.projects ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.projects ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE public.projects ALTER COLUMN status SET DEFAULT 'active';
UPDATE public.projects SET status = 'active' WHERE status NOT IN ('draft','active','on_hold','completed','archived');
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS health text NOT NULL DEFAULT 'on_track';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.profiles(id);
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.projects ALTER COLUMN start_date TYPE timestamptz USING start_date::timestamptz;
ALTER TABLE public.projects ALTER COLUMN due_date TYPE timestamptz USING due_date::timestamptz;
ALTER TABLE public.projects ADD CONSTRAINT projects_status_check CHECK (status IN ('draft','active','on_hold','completed','archived'));
ALTER TABLE public.projects ADD CONSTRAINT projects_health_check CHECK (health IN ('on_track','at_risk','blocked'));
CREATE INDEX IF NOT EXISTS idx_projects_owner ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_client ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);

-- ============ TASKS ============
ALTER TABLE public.tasks ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.tasks ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE public.tasks ALTER COLUMN status SET DEFAULT 'backlog';
UPDATE public.tasks SET status = 'backlog' WHERE status NOT IN ('backlog','todo','in_progress','review','done');
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('backlog','todo','in_progress','review','done'));
ALTER TABLE public.tasks ADD CONSTRAINT tasks_priority_check CHECK (priority IN ('low','medium','high','critical'));
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority);

-- ============ MILESTONES ============
ALTER TABLE public.milestones ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.milestones ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.milestones ALTER COLUMN due_date TYPE timestamptz USING due_date::timestamptz;
ALTER TABLE public.milestones ADD CONSTRAINT milestones_status_check CHECK (status IN ('pending','completed'));

-- ============ PROJECT_MEMBERS ============
ALTER TABLE public.project_members ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.project_members ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.project_members ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.project_members ALTER COLUMN role TYPE text USING role::text;
ALTER TABLE public.project_members ALTER COLUMN role SET DEFAULT 'member';
UPDATE public.project_members SET role = 'member' WHERE role NOT IN ('owner','manager','member','client');
ALTER TABLE public.project_members ADD CONSTRAINT project_members_role_check CHECK (role IN ('owner','manager','member','client'));
CREATE INDEX IF NOT EXISTS idx_project_members_user ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_workspace ON public.project_members(workspace_id);

-- ============ HELPER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.project_members WHERE project_id = _project_id AND user_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = _project_id AND p.owner_id = _user_id)
    OR EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.workspaces w ON w.id = p.workspace_id
      WHERE p.id = _project_id AND w.owner_id = _user_id
    );
$$;

CREATE OR REPLACE FUNCTION public.has_project_role(_project_id uuid, _user_id uuid, _role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_client(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND user_id = _user_id AND role = 'client'
  ) OR EXISTS (
    SELECT 1 FROM public.projects WHERE id = _project_id AND client_id = _user_id
  );
$$;

-- ============ PROJECTS / TASKS / MILESTONES POLICIES ============
CREATE POLICY "View projects" ON public.projects FOR SELECT TO authenticated
USING (is_project_member(id, auth.uid()));
CREATE POLICY "Create projects" ON public.projects FOR INSERT TO authenticated
WITH CHECK (is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Update projects" ON public.projects FOR UPDATE TO authenticated
USING (is_project_member(id, auth.uid())) WITH CHECK (is_project_member(id, auth.uid()));
CREATE POLICY "Delete projects" ON public.projects FOR DELETE TO authenticated
USING (owner_id = auth.uid() OR has_workspace_role(workspace_id, auth.uid(), 'owner'));

CREATE POLICY "View tasks" ON public.tasks FOR SELECT TO authenticated
USING (is_project_member(project_id, auth.uid()));
CREATE POLICY "Create tasks" ON public.tasks FOR INSERT TO authenticated
WITH CHECK (is_project_member(project_id, auth.uid()));
CREATE POLICY "Update tasks" ON public.tasks FOR UPDATE TO authenticated
USING (is_project_member(project_id, auth.uid())) WITH CHECK (is_project_member(project_id, auth.uid()));
CREATE POLICY "Delete tasks" ON public.tasks FOR DELETE TO authenticated
USING (
  has_project_role(project_id, auth.uid(), 'owner')
  OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = tasks.project_id AND p.owner_id = auth.uid())
  OR has_workspace_role(workspace_id, auth.uid(), 'owner')
);

CREATE POLICY "View milestones" ON public.milestones FOR SELECT TO authenticated
USING (is_project_member(project_id, auth.uid()));
CREATE POLICY "Manage milestones" ON public.milestones FOR ALL TO authenticated
USING (is_project_member(project_id, auth.uid())) WITH CHECK (is_project_member(project_id, auth.uid()));

-- ============ PROJECT_MEMBERS POLICIES ============
CREATE POLICY "View project members" ON public.project_members FOR SELECT TO authenticated
USING (user_id = auth.uid() OR is_project_member(project_id, auth.uid()));
CREATE POLICY "Manage project members" ON public.project_members FOR ALL TO authenticated
USING (
  has_workspace_role(workspace_id, auth.uid(), 'owner')
  OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_members.project_id AND p.owner_id = auth.uid())
  OR has_project_role(project_id, auth.uid(), 'owner')
  OR has_project_role(project_id, auth.uid(), 'manager')
)
WITH CHECK (
  has_workspace_role(workspace_id, auth.uid(), 'owner')
  OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_members.project_id AND p.owner_id = auth.uid())
  OR has_project_role(project_id, auth.uid(), 'owner')
  OR has_project_role(project_id, auth.uid(), 'manager')
);

-- ============ DELIVERABLES ============
CREATE TABLE public.deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft',
  requires_approval boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deliverables_status_check CHECK (status IN ('draft','submitted','approved','rejected'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deliverables TO authenticated;
GRANT ALL ON public.deliverables TO service_role;
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_deliverables_workspace ON public.deliverables(workspace_id, project_id);
CREATE POLICY "View deliverables" ON public.deliverables FOR SELECT TO authenticated
USING (is_project_member(project_id, auth.uid()) OR is_project_client(project_id, auth.uid()));
CREATE POLICY "Manage deliverables" ON public.deliverables FOR ALL TO authenticated
USING (is_project_member(project_id, auth.uid())) WITH CHECK (is_project_member(project_id, auth.uid()));

-- ============ PROJECT_COMMENTS ============
CREATE TABLE public.project_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_comments TO authenticated;
GRANT ALL ON public.project_comments TO service_role;
ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_project_comments_project ON public.project_comments(project_id);
CREATE INDEX idx_project_comments_task ON public.project_comments(task_id);
CREATE POLICY "View comments" ON public.project_comments FOR SELECT TO authenticated
USING (is_project_member(project_id, auth.uid()));
CREATE POLICY "Create comments" ON public.project_comments FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid() AND is_project_member(project_id, auth.uid()));
CREATE POLICY "Update own comments" ON public.project_comments FOR UPDATE TO authenticated
USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "Delete own comments" ON public.project_comments FOR DELETE TO authenticated
USING (author_id = auth.uid() OR has_workspace_role(workspace_id, auth.uid(), 'owner'));

-- ============ PROJECT_FILES ============
CREATE TABLE public.project_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES public.profiles(id),
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_files TO authenticated;
GRANT ALL ON public.project_files TO service_role;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_project_files_project ON public.project_files(project_id);
CREATE POLICY "View files" ON public.project_files FOR SELECT TO authenticated
USING (is_project_member(project_id, auth.uid()) OR is_project_client(project_id, auth.uid()));
CREATE POLICY "Manage files" ON public.project_files FOR ALL TO authenticated
USING (is_project_member(project_id, auth.uid())) WITH CHECK (is_project_member(project_id, auth.uid()));

-- ============ PROJECT_ACTIVITY ============
CREATE TABLE public.project_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id),
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_activity TO authenticated;
GRANT ALL ON public.project_activity TO service_role;
ALTER TABLE public.project_activity ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_project_activity_project ON public.project_activity(project_id, created_at DESC);
CREATE POLICY "View activity" ON public.project_activity FOR SELECT TO authenticated
USING (is_project_member(project_id, auth.uid()) OR is_project_client(project_id, auth.uid()));
CREATE POLICY "Insert activity" ON public.project_activity FOR INSERT TO authenticated
WITH CHECK (is_project_member(project_id, auth.uid()));

-- ============ updated_at TRIGGERS ============
CREATE TRIGGER touch_deliverables BEFORE UPDATE ON public.deliverables FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ ACTIVITY LOGGING -> project_activity ============
CREATE OR REPLACE FUNCTION public.log_project_task_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  if TG_OP = 'INSERT' then
    insert into public.project_activity (workspace_id, project_id, actor_id, action, metadata)
    values (new.workspace_id, new.project_id, auth.uid(), 'task_created',
      jsonb_build_object('task_id', new.id, 'title', new.title));
  elsif TG_OP = 'UPDATE' and old.status is distinct from new.status then
    insert into public.project_activity (workspace_id, project_id, actor_id, action, metadata)
    values (new.workspace_id, new.project_id, auth.uid(), 'task_status_changed',
      jsonb_build_object('task_id', new.id, 'title', new.title, 'from', old.status, 'to', new.status));
  end if;
  return new;
end; $$;
CREATE TRIGGER log_task_activity AFTER INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.log_project_task_activity();

CREATE OR REPLACE FUNCTION public.log_project_milestone_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  if TG_OP = 'INSERT' then
    insert into public.project_activity (workspace_id, project_id, actor_id, action, metadata)
    values (new.workspace_id, new.project_id, auth.uid(), 'milestone_created',
      jsonb_build_object('milestone_id', new.id, 'title', new.title));
  elsif TG_OP = 'UPDATE' and old.status is distinct from new.status then
    insert into public.project_activity (workspace_id, project_id, actor_id, action, metadata)
    values (new.workspace_id, new.project_id, auth.uid(), 'milestone_status_changed',
      jsonb_build_object('milestone_id', new.id, 'title', new.title, 'to', new.status));
  end if;
  return new;
end; $$;
CREATE TRIGGER log_milestone_activity AFTER INSERT OR UPDATE ON public.milestones FOR EACH ROW EXECUTE FUNCTION public.log_project_milestone_activity();

CREATE OR REPLACE FUNCTION public.log_project_deliverable_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  if TG_OP = 'INSERT' then
    insert into public.project_activity (workspace_id, project_id, actor_id, action, metadata)
    values (new.workspace_id, new.project_id, auth.uid(), 'deliverable_created',
      jsonb_build_object('deliverable_id', new.id, 'title', new.title));
  elsif TG_OP = 'UPDATE' and old.status is distinct from new.status then
    insert into public.project_activity (workspace_id, project_id, actor_id, action, metadata)
    values (new.workspace_id, new.project_id, auth.uid(), 'deliverable_status_changed',
      jsonb_build_object('deliverable_id', new.id, 'title', new.title, 'to', new.status));
  end if;
  return new;
end; $$;
CREATE TRIGGER log_deliverable_activity AFTER INSERT OR UPDATE ON public.deliverables FOR EACH ROW EXECUTE FUNCTION public.log_project_deliverable_activity();

CREATE OR REPLACE FUNCTION public.log_project_comment_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  insert into public.project_activity (workspace_id, project_id, actor_id, action, metadata)
  values (new.workspace_id, new.project_id, new.author_id, 'comment_added',
    jsonb_build_object('comment_id', new.id, 'task_id', new.task_id));
  return new;
end; $$;
CREATE TRIGGER log_comment_activity AFTER INSERT ON public.project_comments FOR EACH ROW EXECUTE FUNCTION public.log_project_comment_activity();