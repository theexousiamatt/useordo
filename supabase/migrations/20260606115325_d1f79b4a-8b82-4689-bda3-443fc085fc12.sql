-- Tighten projects SELECT policy to authenticated role only
DROP POLICY IF EXISTS "View projects" ON public.projects;
CREATE POLICY "View projects" ON public.projects
FOR SELECT
TO authenticated
USING (
  is_project_member(id, auth.uid())
  OR owner_id = auth.uid()
  OR created_by = auth.uid()
);

-- Indexes to keep workspace-scoped queries fast
CREATE INDEX IF NOT EXISTS idx_projects_workspace_id ON public.projects (workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_id ON public.tasks (workspace_id);
CREATE INDEX IF NOT EXISTS idx_milestones_workspace_id ON public.milestones (workspace_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_workspace_id ON public.deliverables (workspace_id);
CREATE INDEX IF NOT EXISTS idx_project_comments_workspace_id ON public.project_comments (workspace_id);
CREATE INDEX IF NOT EXISTS idx_project_files_workspace_id ON public.project_files (workspace_id);
CREATE INDEX IF NOT EXISTS idx_project_activity_workspace_id ON public.project_activity (workspace_id);
CREATE INDEX IF NOT EXISTS idx_activity_workspace_id ON public.activity (workspace_id);