-- INSERT ... RETURNING evaluates SELECT policy before a STABLE helper can
-- query the freshly inserted project. Evaluate workspace access from the row.
DROP POLICY "View projects" ON public.projects;
CREATE POLICY "View projects" ON public.projects FOR SELECT TO authenticated
 USING(public.is_workspace_collaborator(workspace_id,auth.uid())
 OR public.can_view_project(id,auth.uid()));
