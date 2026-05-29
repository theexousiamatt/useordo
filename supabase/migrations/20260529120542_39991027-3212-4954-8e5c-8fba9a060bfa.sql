-- ============ ENUMS ============
CREATE TYPE public.deliverable_status AS ENUM ('draft','in_review','approved','delivered','archived');
CREATE TYPE public.comment_entity_type AS ENUM ('project','task','milestone','deliverable');
CREATE TYPE public.client_access_level AS ENUM ('viewer','approver');
CREATE TYPE public.ai_plan_status AS ENUM ('queued','running','complete','failed');
CREATE TYPE public.ai_item_entity_type AS ENUM ('task','milestone','deliverable');

-- ============ ADD workspace_id TO EXISTING TABLES (all empty, safe NOT NULL) ============
ALTER TABLE public.projects   ADD COLUMN workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.tasks      ADD COLUMN workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.milestones ADD COLUMN workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.files      ADD COLUMN workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.activity   ADD COLUMN workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE;

CREATE INDEX idx_projects_workspace   ON public.projects(workspace_id);
CREATE INDEX idx_tasks_workspace      ON public.tasks(workspace_id, project_id);
CREATE INDEX idx_milestones_workspace ON public.milestones(workspace_id, project_id);
CREATE INDEX idx_files_workspace      ON public.files(workspace_id, project_id);
CREATE INDEX idx_activity_workspace   ON public.activity(workspace_id, project_id);

-- ============ CLIENT_ACCESS ============
CREATE TABLE public.client_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_user_id uuid NOT NULL,
  access_level public.client_access_level NOT NULL DEFAULT 'viewer',
  invited_by uuid,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, client_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_access TO authenticated;
GRANT ALL ON public.client_access TO service_role;
ALTER TABLE public.client_access ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_client_access_workspace ON public.client_access(workspace_id);
CREATE INDEX idx_client_access_lookup ON public.client_access(project_id, client_user_id);

-- ============ HELPER: client access check (security definer, avoids recursive RLS) ============
CREATE OR REPLACE FUNCTION public.is_client_for_project(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_access
    WHERE project_id = _project_id AND client_user_id = _user_id AND revoked_at IS NULL
  );
$$;

CREATE POLICY "Members and the client can view access" ON public.client_access
FOR SELECT TO authenticated
USING (is_workspace_member(workspace_id, auth.uid()) OR client_user_id = auth.uid());

CREATE POLICY "Owners and members manage client access" ON public.client_access
FOR ALL TO authenticated
USING (has_workspace_role(workspace_id, auth.uid(), 'owner') OR has_workspace_role(workspace_id, auth.uid(), 'member'))
WITH CHECK (has_workspace_role(workspace_id, auth.uid(), 'owner') OR has_workspace_role(workspace_id, auth.uid(), 'member'));

-- ============ DELIVERABLES ============
CREATE TABLE public.deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status public.deliverable_status NOT NULL DEFAULT 'draft',
  due_date date,
  file_id uuid REFERENCES public.files(id) ON DELETE SET NULL,
  delivered_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deliverables TO authenticated;
GRANT ALL ON public.deliverables TO service_role;
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_deliverables_workspace ON public.deliverables(workspace_id, project_id);
CREATE INDEX idx_deliverables_status ON public.deliverables(status);

CREATE POLICY "Members and clients can view deliverables" ON public.deliverables
FOR SELECT TO authenticated
USING (
  has_workspace_role(workspace_id, auth.uid(), 'owner')
  OR has_workspace_role(workspace_id, auth.uid(), 'member')
  OR is_client_for_project(project_id, auth.uid())
);
CREATE POLICY "Owners and members manage deliverables" ON public.deliverables
FOR ALL TO authenticated
USING (has_workspace_role(workspace_id, auth.uid(), 'owner') OR has_workspace_role(workspace_id, auth.uid(), 'member'))
WITH CHECK (has_workspace_role(workspace_id, auth.uid(), 'owner') OR has_workspace_role(workspace_id, auth.uid(), 'member'));

-- ============ COMMENTS ============
CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  entity_type public.comment_entity_type NOT NULL,
  entity_id uuid NOT NULL,
  parent_comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  is_client_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_comments_workspace ON public.comments(workspace_id, project_id);
CREATE INDEX idx_comments_entity ON public.comments(entity_type, entity_id);
CREATE INDEX idx_comments_parent ON public.comments(parent_comment_id);

CREATE POLICY "Members and clients can view comments" ON public.comments
FOR SELECT TO authenticated
USING (
  has_workspace_role(workspace_id, auth.uid(), 'owner')
  OR has_workspace_role(workspace_id, auth.uid(), 'member')
  OR (is_client_visible AND is_client_for_project(project_id, auth.uid()))
);
CREATE POLICY "Members and clients can post comments" ON public.comments
FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    has_workspace_role(workspace_id, auth.uid(), 'owner')
    OR has_workspace_role(workspace_id, auth.uid(), 'member')
    OR is_client_for_project(project_id, auth.uid())
  )
);
CREATE POLICY "Authors and owners update comments" ON public.comments
FOR UPDATE TO authenticated
USING (author_id = auth.uid() OR has_workspace_role(workspace_id, auth.uid(), 'owner'))
WITH CHECK (author_id = auth.uid() OR has_workspace_role(workspace_id, auth.uid(), 'owner'));
CREATE POLICY "Authors and owners delete comments" ON public.comments
FOR DELETE TO authenticated
USING (author_id = auth.uid() OR has_workspace_role(workspace_id, auth.uid(), 'owner'));

-- ============ AI_PLANS ============
CREATE TABLE public.ai_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  model text,
  status public.ai_plan_status NOT NULL DEFAULT 'queued',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_plans TO authenticated;
GRANT ALL ON public.ai_plans TO service_role;
ALTER TABLE public.ai_plans ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_ai_plans_workspace ON public.ai_plans(workspace_id, project_id);

CREATE POLICY "Members can view ai plans" ON public.ai_plans
FOR SELECT TO authenticated
USING (has_workspace_role(workspace_id, auth.uid(), 'owner') OR has_workspace_role(workspace_id, auth.uid(), 'member'));
CREATE POLICY "Members manage ai plans" ON public.ai_plans
FOR ALL TO authenticated
USING (has_workspace_role(workspace_id, auth.uid(), 'owner') OR has_workspace_role(workspace_id, auth.uid(), 'member'))
WITH CHECK (has_workspace_role(workspace_id, auth.uid(), 'owner') OR has_workspace_role(workspace_id, auth.uid(), 'member'));

-- ============ AI_PLAN_ITEMS ============
CREATE TABLE public.ai_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_plan_id uuid NOT NULL REFERENCES public.ai_plans(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity_type public.ai_item_entity_type NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied boolean NOT NULL DEFAULT false,
  applied_entity_id uuid,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_plan_items TO authenticated;
GRANT ALL ON public.ai_plan_items TO service_role;
ALTER TABLE public.ai_plan_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_ai_plan_items_plan ON public.ai_plan_items(ai_plan_id);
CREATE INDEX idx_ai_plan_items_workspace ON public.ai_plan_items(workspace_id);

CREATE POLICY "Members can view ai plan items" ON public.ai_plan_items
FOR SELECT TO authenticated
USING (has_workspace_role(workspace_id, auth.uid(), 'owner') OR has_workspace_role(workspace_id, auth.uid(), 'member'));
CREATE POLICY "Members manage ai plan items" ON public.ai_plan_items
FOR ALL TO authenticated
USING (has_workspace_role(workspace_id, auth.uid(), 'owner') OR has_workspace_role(workspace_id, auth.uid(), 'member'))
WITH CHECK (has_workspace_role(workspace_id, auth.uid(), 'owner') OR has_workspace_role(workspace_id, auth.uid(), 'member'));

-- ============ updated_at TRIGGERS ============
CREATE TRIGGER touch_client_access BEFORE UPDATE ON public.client_access FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_deliverables BEFORE UPDATE ON public.deliverables FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_comments BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_ai_plans BEFORE UPDATE ON public.ai_plans FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ ACTIVITY LOGGING TRIGGERS ============
CREATE OR REPLACE FUNCTION public.log_deliverable_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  if TG_OP = 'INSERT' then
    insert into public.activity (workspace_id, project_id, actor_id, type, payload)
    values (new.workspace_id, new.project_id, auth.uid(), 'deliverable_created',
      jsonb_build_object('deliverable_id', new.id, 'title', new.title));
  elsif TG_OP = 'UPDATE' and old.status is distinct from new.status then
    insert into public.activity (workspace_id, project_id, actor_id, type, payload)
    values (new.workspace_id, new.project_id, auth.uid(), 'deliverable_status_changed',
      jsonb_build_object('deliverable_id', new.id, 'title', new.title, 'from', old.status, 'to', new.status));
  end if;
  return new;
end; $$;
CREATE TRIGGER log_deliverable_activity AFTER INSERT OR UPDATE ON public.deliverables FOR EACH ROW EXECUTE FUNCTION public.log_deliverable_activity();

CREATE OR REPLACE FUNCTION public.log_comment_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  insert into public.activity (workspace_id, project_id, actor_id, type, payload)
  values (new.workspace_id, new.project_id, auth.uid(), 'comment_added',
    jsonb_build_object('comment_id', new.id, 'entity_type', new.entity_type, 'entity_id', new.entity_id));
  return new;
end; $$;
CREATE TRIGGER log_comment_activity AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.log_comment_activity();

CREATE OR REPLACE FUNCTION public.log_client_access_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  if TG_OP = 'INSERT' then
    insert into public.activity (workspace_id, project_id, actor_id, type, payload)
    values (new.workspace_id, new.project_id, auth.uid(), 'client_access_granted',
      jsonb_build_object('client_user_id', new.client_user_id, 'access_level', new.access_level));
  elsif TG_OP = 'UPDATE' and old.revoked_at is null and new.revoked_at is not null then
    insert into public.activity (workspace_id, project_id, actor_id, type, payload)
    values (new.workspace_id, new.project_id, auth.uid(), 'client_access_revoked',
      jsonb_build_object('client_user_id', new.client_user_id));
  end if;
  return new;
end; $$;
CREATE TRIGGER log_client_access_activity AFTER INSERT OR UPDATE ON public.client_access FOR EACH ROW EXECUTE FUNCTION public.log_client_access_activity();