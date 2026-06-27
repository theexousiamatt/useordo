ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS tasks_archived_at_idx ON public.tasks (project_id, archived_at);