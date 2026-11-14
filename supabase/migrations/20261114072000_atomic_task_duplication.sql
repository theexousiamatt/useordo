-- Duplicate an Ordo task in a single transaction, including its checklist,
-- project label assignments and multiple assignees. No partial copies.
-- Completion is independent from stage and is always reset for new work.
BEGIN;

CREATE OR REPLACE FUNCTION public.duplicate_ordo_task(
  _task_id uuid,
  _copy_assignees boolean DEFAULT true
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $ordo$
DECLARE
  source_task public.tasks%ROWTYPE;
  actor uuid := auth.uid();
  new_task_id uuid;
  next_position integer;
BEGIN
  IF actor IS NULL OR _task_id IS NULL THEN
    RAISE EXCEPTION 'Sign in and select a task to duplicate'
      USING ERRCODE = '42501';
  END IF;

  SELECT t.* INTO source_task
  FROM public.tasks t
  JOIN public.projects p ON p.id = t.project_id
  WHERE t.id = _task_id
    AND t.archived_at IS NULL
    AND p.archived_at IS NULL
    AND p.workspace_id = t.workspace_id
  FOR SHARE OF t;

  IF NOT FOUND
     OR NOT public.can_contribute_project(source_task.project_id, actor) THEN
    RAISE EXCEPTION 'Task unavailable or you do not have permission to duplicate it'
      USING ERRCODE = '42501';
  END IF;

  -- Append within the source stage, rather than renumbering other tasks.
  -- Task stage names and legacy status must never imply completion.
  SELECT COALESCE(MAX(t.position) + 1, 0)
    INTO next_position
  FROM public.tasks t
  WHERE t.project_id = source_task.project_id
    AND t.stage_id = source_task.stage_id
    AND t.archived_at IS NULL;

  INSERT INTO public.tasks (
    workspace_id, project_id, title, description, status, stage_id,
    position, assignee_id, due_date, created_by, archived_at, completed_at
  ) VALUES (
    source_task.workspace_id, source_task.project_id,
    source_task.title || ' (Copy)', source_task.description,
    source_task.status, source_task.stage_id,
    next_position,
    CASE WHEN COALESCE(_copy_assignees, true) THEN source_task.assignee_id ELSE NULL END,
    source_task.due_date, actor, NULL, NULL
  ) RETURNING id INTO new_task_id;

  INSERT INTO public.task_subtasks (
    project_id, task_id, title, completed, position
  )
  SELECT source_task.project_id, new_task_id, st.title, st.completed, st.position
  FROM public.task_subtasks st
  WHERE st.task_id = source_task.id
    AND st.project_id = source_task.project_id;

  -- Reuse project labels; do not create new global labels for the copy.
  INSERT INTO public.task_labels (
    workspace_id, project_id, task_id, label_id
  )
  SELECT source_task.workspace_id, source_task.project_id, new_task_id, tl.label_id
  FROM public.task_labels tl
  JOIN public.project_labels pl ON pl.id = tl.label_id
    AND pl.project_id = source_task.project_id
    AND pl.workspace_id = source_task.workspace_id
  WHERE tl.task_id = source_task.id
    AND tl.project_id = source_task.project_id
    AND tl.workspace_id = source_task.workspace_id;

  IF COALESCE(_copy_assignees, true) THEN
    INSERT INTO public.task_assignees (
      workspace_id, project_id, task_id, user_id, created_by
    )
    SELECT source_task.workspace_id, source_task.project_id,
      new_task_id, a.user_id, actor
    FROM public.task_assignees a
    WHERE a.task_id = source_task.id
      AND a.project_id = source_task.project_id
      AND a.workspace_id = source_task.workspace_id;
  END IF;

  RETURN new_task_id;
END;
$ordo$;

REVOKE ALL ON FUNCTION public.duplicate_ordo_task(uuid,boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicate_ordo_task(uuid,boolean)
  TO authenticated;

COMMENT ON FUNCTION public.duplicate_ordo_task(uuid,boolean) IS
'Atomically clone a task with checklist, project label assignments and optional assignees. The new task is always incomplete. Requires project contribution permission; comments, activity and attached files are not copied.';

COMMIT;
