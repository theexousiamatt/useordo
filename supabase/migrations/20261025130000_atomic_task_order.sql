-- A board move writes both affected columns in one transaction. A stale board
-- version fails instead of overwriting another editor's newer order.
CREATE OR REPLACE FUNCTION public.touch_task_updated_at_clock()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.updated_at := greatest(clock_timestamp(), OLD.updated_at + interval '1 microsecond');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_tasks_updated ON public.tasks;
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.touch_task_updated_at_clock();

CREATE OR REPLACE FUNCTION public.reorder_project_tasks(_project_id uuid, _updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  payload_count integer;
  matched_count integer;
  affected text[];
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_contribute_project(_project_id, auth.uid()) THEN
    RAISE EXCEPTION 'You cannot move tasks in this project' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = _project_id AND archived_at IS NULL) THEN
    RAISE EXCEPTION 'This project is unavailable' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(_updates) IS DISTINCT FROM 'array' OR jsonb_array_length(_updates) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Invalid task move payload' USING ERRCODE = '22023';
  END IF;

  -- Serialize moves for a project before checking the expected task versions.
  PERFORM pg_advisory_xact_lock(hashtextextended(_project_id::text, 0));
  PERFORM 1 FROM public.tasks WHERE project_id = _project_id AND archived_at IS NULL ORDER BY id FOR UPDATE;

  SELECT count(*), count(DISTINCT u.id) INTO payload_count, matched_count
  FROM jsonb_to_recordset(_updates) AS u(id uuid, status text, position integer, expected_updated_at timestamptz);
  IF payload_count <> matched_count OR EXISTS (
    SELECT 1 FROM jsonb_to_recordset(_updates) AS u(id uuid, status text, position integer, expected_updated_at timestamptz)
    WHERE u.id IS NULL OR u.status NOT IN ('backlog','todo','in_progress','review','done')
      OR u.position IS NULL OR u.position < 0 OR u.expected_updated_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Invalid task move payload' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO matched_count
  FROM public.tasks t
  JOIN jsonb_to_recordset(_updates) AS u(id uuid, status text, position integer, expected_updated_at timestamptz) ON u.id = t.id
  WHERE t.project_id = _project_id AND t.archived_at IS NULL AND t.updated_at = u.expected_updated_at;
  IF matched_count <> payload_count THEN
    RAISE EXCEPTION 'The board changed. Refresh and try again' USING ERRCODE = '40001';
  END IF;

  SELECT array_agg(DISTINCT status) INTO affected FROM (
    SELECT t.status FROM public.tasks t
    JOIN jsonb_to_recordset(_updates) AS u(id uuid, status text, position integer, expected_updated_at timestamptz) ON u.id = t.id
    UNION ALL
    SELECT u.status FROM jsonb_to_recordset(_updates) AS u(id uuid, status text, position integer, expected_updated_at timestamptz)
  ) statuses;
  IF (SELECT count(*) FROM public.tasks WHERE project_id = _project_id AND archived_at IS NULL AND status = ANY(affected)) <> payload_count THEN
    RAISE EXCEPTION 'The board changed. Refresh and try again' USING ERRCODE = '40001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(_updates) AS u(id uuid, status text, position integer, expected_updated_at timestamptz)
    GROUP BY u.status HAVING min(u.position) <> 0 OR max(u.position) <> count(*) - 1 OR count(DISTINCT u.position) <> count(*)
  ) THEN
    RAISE EXCEPTION 'Task positions must be consecutive' USING ERRCODE = '22023';
  END IF;

  UPDATE public.tasks t SET status = u.status, position = u.position
  FROM jsonb_to_recordset(_updates) AS u(id uuid, status text, position integer, expected_updated_at timestamptz)
  WHERE t.id = u.id AND t.project_id = _project_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_project_tasks(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_project_tasks(uuid, jsonb) TO authenticated;
