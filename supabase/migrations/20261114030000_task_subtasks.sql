-- Add a real checklist to legacy Ordo tasks. Existing task rows are untouched.
-- Progress is derived in the frontend only from completed/total subtasks.
BEGIN;

-- Allows project-scoped FK enforcement and follows project moves.
CREATE UNIQUE INDEX IF NOT EXISTS tasks_project_id_id_for_subtasks
  ON public.tasks(project_id, id);

CREATE TABLE IF NOT EXISTS public.task_subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  task_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 240),
  completed boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_subtasks_parent_task_fk
    FOREIGN KEY (project_id, task_id)
    REFERENCES public.tasks(project_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS task_subtasks_project_task_position_idx
  ON public.task_subtasks(project_id, task_id, position, created_at);

ALTER TABLE public.task_subtasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.task_subtasks FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.task_subtasks TO authenticated;

CREATE POLICY "View task subtasks" ON public.task_subtasks
  FOR SELECT TO authenticated
  USING (public.can_contribute_project(project_id, (select auth.uid())));

CREATE POLICY "Create task subtasks" ON public.task_subtasks
  FOR INSERT TO authenticated
  WITH CHECK (public.can_contribute_project(project_id, (select auth.uid())));

CREATE POLICY "Update task subtasks" ON public.task_subtasks
  FOR UPDATE TO authenticated
  USING (public.can_contribute_project(project_id, (select auth.uid())))
  WITH CHECK (public.can_contribute_project(project_id, (select auth.uid())));

CREATE POLICY "Delete task subtasks" ON public.task_subtasks
  FOR DELETE TO authenticated
  USING (public.can_contribute_project(project_id, (select auth.uid())));

COMMENT ON TABLE public.task_subtasks IS
  'Checklist items attached to a task; displayed progress is derived only when at least one exists.';
COMMIT;
