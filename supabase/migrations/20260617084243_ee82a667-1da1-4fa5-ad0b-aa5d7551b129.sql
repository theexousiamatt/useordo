DROP POLICY IF EXISTS "View comments" ON public.project_comments;
CREATE POLICY "View comments" ON public.project_comments
  FOR SELECT USING (
    public.can_view_project(project_id, auth.uid())
    OR public.is_project_client(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Create comments" ON public.project_comments;
CREATE POLICY "Create comments" ON public.project_comments
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND public.can_contribute_project(project_id, auth.uid())
  );