ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_files_task ON public.files(task_id);

CREATE POLICY "Uploaders can delete their own files"
  ON public.files FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid() AND is_project_member(project_id, auth.uid()));