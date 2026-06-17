-- 1. New columns: soft-delete marker + future-proof visibility
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'workspace';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_visibility_check'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_visibility_check CHECK (visibility IN ('workspace','restricted'));
  END IF;
END $$;

-- 2. Helper: a workspace collaborator is the workspace owner or an active
--    member with an internal role (clients are excluded).
CREATE OR REPLACE FUNCTION public.is_workspace_collaborator(_workspace_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspaces WHERE id = _workspace_id AND owner_id = _user_id)
      OR EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = _workspace_id AND user_id = _user_id
          AND status = 'active' AND role IN ('owner','manager','member')
      );
$$;

-- 3. Who can VIEW a project: workspace collaborators (all projects) or anyone
--    explicitly added to the project (covers clients on assigned projects).
CREATE OR REPLACE FUNCTION public.can_view_project(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id AND public.is_workspace_collaborator(p.workspace_id, _user_id)
  )
  OR public.is_project_member(_project_id, _user_id);
$$;

-- 4. Who can CONTRIBUTE (tasks etc.): workspace collaborators or internal
--    project members. Clients are excluded.
CREATE OR REPLACE FUNCTION public.can_contribute_project(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id AND public.is_workspace_collaborator(p.workspace_id, _user_id)
  )
  OR public.has_project_role(_project_id, _user_id, 'owner')
  OR public.has_project_role(_project_id, _user_id, 'manager')
  OR public.has_project_role(_project_id, _user_id, 'member');
$$;

-- 5. Who can MANAGE project settings/deletion: project owner, workspace
--    owner/manager, or project owner/manager role.
CREATE OR REPLACE FUNCTION public.can_manage_project(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id
      AND (p.owner_id = _user_id OR public.can_manage_workspace(p.workspace_id, _user_id))
  )
  OR public.has_project_role(_project_id, _user_id, 'owner')
  OR public.has_project_role(_project_id, _user_id, 'manager');
$$;

GRANT EXECUTE ON FUNCTION public.is_workspace_collaborator(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_view_project(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_contribute_project(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_project(uuid, uuid) TO authenticated, anon;

-- 6. Rewrite project policies
DROP POLICY IF EXISTS "View projects" ON public.projects;
CREATE POLICY "View projects" ON public.projects
  FOR SELECT USING (public.can_view_project(id, auth.uid()));

DROP POLICY IF EXISTS "Update projects" ON public.projects;
CREATE POLICY "Update projects" ON public.projects
  FOR UPDATE USING (public.can_manage_project(id, auth.uid()))
  WITH CHECK (public.can_manage_project(id, auth.uid()));

-- 7. Tasks: workspace collaborators + internal project members (no clients)
DROP POLICY IF EXISTS "View tasks" ON public.tasks;
CREATE POLICY "View tasks" ON public.tasks
  FOR SELECT USING (public.can_contribute_project(project_id, auth.uid()));

DROP POLICY IF EXISTS "Create tasks" ON public.tasks;
CREATE POLICY "Create tasks" ON public.tasks
  FOR INSERT WITH CHECK (public.can_contribute_project(project_id, auth.uid()));

DROP POLICY IF EXISTS "Update tasks" ON public.tasks;
CREATE POLICY "Update tasks" ON public.tasks
  FOR UPDATE USING (public.can_contribute_project(project_id, auth.uid()))
  WITH CHECK (public.can_contribute_project(project_id, auth.uid()));

-- 8. Milestones
DROP POLICY IF EXISTS "View milestones" ON public.milestones;
CREATE POLICY "View milestones" ON public.milestones
  FOR SELECT USING (public.can_view_project(project_id, auth.uid()));

DROP POLICY IF EXISTS "Manage milestones" ON public.milestones;
CREATE POLICY "Manage milestones" ON public.milestones
  FOR ALL USING (public.can_contribute_project(project_id, auth.uid()))
  WITH CHECK (public.can_contribute_project(project_id, auth.uid()));

-- 9. Deliverables
DROP POLICY IF EXISTS "View deliverables" ON public.deliverables;
CREATE POLICY "View deliverables" ON public.deliverables
  FOR SELECT USING (
    public.can_view_project(project_id, auth.uid())
    OR public.is_project_client(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Manage deliverables" ON public.deliverables;
CREATE POLICY "Manage deliverables" ON public.deliverables
  FOR ALL USING (public.can_contribute_project(project_id, auth.uid()))
  WITH CHECK (public.can_contribute_project(project_id, auth.uid()));

-- 10. Project activity
DROP POLICY IF EXISTS "View activity" ON public.project_activity;
CREATE POLICY "View activity" ON public.project_activity
  FOR SELECT USING (
    public.can_view_project(project_id, auth.uid())
    OR public.is_project_client(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Insert activity" ON public.project_activity;
CREATE POLICY "Insert activity" ON public.project_activity
  FOR INSERT WITH CHECK (public.can_contribute_project(project_id, auth.uid()));

-- 11. Legacy activity feed
DROP POLICY IF EXISTS "Project members can view activity" ON public.activity;
CREATE POLICY "Project members can view activity" ON public.activity
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR public.can_view_project(project_id, auth.uid())
  );

-- 12. Project members: workspace collaborators can see project rosters
DROP POLICY IF EXISTS "View project members" ON public.project_members;
CREATE POLICY "View project members" ON public.project_members
  FOR SELECT USING (
    user_id = auth.uid() OR public.can_view_project(project_id, auth.uid())
  );

-- 13. Owner-only project deletion with cascade + report
CREATE OR REPLACE FUNCTION public.delete_project(_project_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ws uuid;
  v_owner uuid;
  v_report jsonb;
BEGIN
  SELECT workspace_id, owner_id INTO v_ws, v_owner FROM public.projects WHERE id = _project_id;
  IF v_ws IS NULL THEN
    RAISE EXCEPTION 'Project not found';
  END IF;
  IF NOT (v_owner = v_uid OR EXISTS (SELECT 1 FROM public.workspaces WHERE id = v_ws AND owner_id = v_uid)) THEN
    RAISE EXCEPTION 'Only the project owner can delete this project';
  END IF;

  SELECT jsonb_build_object(
    'tasks',        (SELECT count(*) FROM public.tasks WHERE project_id = _project_id),
    'milestones',   (SELECT count(*) FROM public.milestones WHERE project_id = _project_id),
    'deliverables', (SELECT count(*) FROM public.deliverables WHERE project_id = _project_id),
    'members',      (SELECT count(*) FROM public.project_members WHERE project_id = _project_id),
    'comments',     (SELECT count(*) FROM public.project_comments WHERE project_id = _project_id),
    'files',        (SELECT count(*) FROM public.project_files WHERE project_id = _project_id)
                    + (SELECT count(*) FROM public.files WHERE project_id = _project_id),
    'activity',     (SELECT count(*) FROM public.project_activity WHERE project_id = _project_id)
                    + (SELECT count(*) FROM public.activity WHERE project_id = _project_id)
  ) INTO v_report;

  DELETE FROM public.projects WHERE id = _project_id;

  RETURN jsonb_build_object('project_id', _project_id, 'deleted', true, 'records', v_report);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_project(uuid) TO authenticated;