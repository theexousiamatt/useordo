DROP POLICY IF EXISTS "View projects" ON public.projects;
CREATE POLICY "View projects" ON public.projects
FOR SELECT
USING (
  is_project_member(id, auth.uid())
  OR owner_id = auth.uid()
  OR created_by = auth.uid()
);