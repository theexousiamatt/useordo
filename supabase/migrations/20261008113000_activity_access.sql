-- Replace legacy global-role checks with workspace authorization.
-- Raw activity payloads may contain internal task details, so clients cannot read them.
DROP POLICY IF EXISTS "Project members can view activity" ON public.activity;
CREATE POLICY "Project members can view activity" ON public.activity
FOR SELECT TO authenticated
USING (public.is_workspace_collaborator(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Members can insert activity" ON public.activity;
CREATE POLICY "Members can insert activity" ON public.activity
FOR INSERT TO authenticated
WITH CHECK (
 actor_id = auth.uid()
 AND public.is_workspace_collaborator(workspace_id, auth.uid())
 AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.workspace_id = activity.workspace_id)
 AND public.can_contribute_project(project_id, auth.uid())
);
