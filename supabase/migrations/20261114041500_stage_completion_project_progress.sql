-- Ordo: one explicit stage-completion contract; task checklists measure something different.
-- Additive, backward-compatible migration; existing stage, task and checklist data remain intact.
BEGIN;

ALTER TABLE public.project_stages
  ADD COLUMN IF NOT EXISTS is_completion boolean NOT NULL DEFAULT false;

-- Match existing legacy "Done" stages without guessing from user-supplied stage names.
UPDATE public.project_stages SET is_completion = true
WHERE category = 'done' AND is_completion = false;

COMMENT ON COLUMN public.project_stages.is_completion IS
  'Explicit meaning of this stage: tasks here count as complete for project progress. Unrelated to stage theme or checklist completion.';

-- New projects must seed one completion stage; do not rely on the old name.
CREATE OR REPLACE FUNCTION public.legacy_seed_project_stages()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.project_stages(workspace_id,project_id,name,category,position,is_completion)
  SELECT NEW.workspace_id,NEW.id,seed.name,seed.category,seed.position,(seed.category='done')
  FROM (VALUES
    ('Backlog','backlog',0),('To do','todo',1),('In progress','in_progress',2),
    ('Review','review',3),('Done','done',4)
  ) AS seed(name,category,position);
  RETURN NEW;
END $$;

-- Completion is stage-driven; keep projects.progress up to date for all clients,
-- including dashboards that do not have the task board open.
CREATE OR REPLACE FUNCTION public.recalculate_ordo_project_progress(_project_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  all_tasks integer;
  completed_tasks integer;
BEGIN
  IF _project_id IS NULL THEN RETURN; END IF;
  SELECT count(*)::integer,
    count(*) FILTER (
      WHERE coalesce(s.is_completion, t.stage_id IS NULL AND t.status = 'done')
    )::integer
  INTO all_tasks, completed_tasks
  FROM public.tasks t
  LEFT JOIN public.project_stages s
    ON s.project_id = t.project_id AND s.id = t.stage_id
  WHERE t.project_id = _project_id AND t.archived_at IS NULL;

  UPDATE public.projects
  SET progress = CASE WHEN all_tasks = 0 THEN 0
    ELSE round((completed_tasks::numeric / all_tasks) * 100)::integer END
  WHERE id = _project_id;
END $$;

-- Do not make security-definer recomputation callable by browser clients.
REVOKE ALL ON FUNCTION public.recalculate_ordo_project_progress(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ordo_task_progress_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_ordo_project_progress(OLD.project_id);
    RETURN OLD;
  END IF;
  PERFORM public.recalculate_ordo_project_progress(NEW.project_id);
  IF TG_OP = 'UPDATE' AND OLD.project_id IS DISTINCT FROM NEW.project_id THEN
    PERFORM public.recalculate_ordo_project_progress(OLD.project_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ordo_task_progress ON public.tasks;
CREATE TRIGGER trg_ordo_task_progress
AFTER INSERT OR UPDATE OF stage_id, status, archived_at, project_id OR DELETE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.ordo_task_progress_trigger();

CREATE OR REPLACE FUNCTION public.ordo_stage_progress_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.recalculate_ordo_project_progress(COALESCE(NEW.project_id, OLD.project_id));
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_ordo_stage_completion_progress ON public.project_stages;
CREATE TRIGGER trg_ordo_stage_completion_progress
AFTER UPDATE OF is_completion ON public.project_stages
FOR EACH ROW WHEN (OLD.is_completion IS DISTINCT FROM NEW.is_completion)
EXECUTE FUNCTION public.ordo_stage_progress_trigger();

-- Keep a manager-only setting separate from the stage's visual theme.
CREATE OR REPLACE FUNCTION public.set_project_stage_completion(
  _project_id uuid, _stage_id uuid, _is_completion boolean, _expected_revision integer
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  actor uuid;
  result uuid;
BEGIN
  actor := auth.uid();
  IF actor IS NULL OR _project_id IS NULL OR _stage_id IS NULL OR _is_completion IS NULL
      OR _expected_revision IS NULL THEN
    RAISE EXCEPTION 'Stage and authenticated manager are required' USING ERRCODE = '42501';
  END IF;
  -- Project ownership is revalidated server-side; never trust a UI-only check.
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = _project_id AND archived_at IS NULL)
     OR NOT public.can_manage_project(_project_id, actor) THEN
    RAISE EXCEPTION 'Stage management denied' USING ERRCODE = '42501';
  END IF;
  UPDATE public.project_stages
  SET is_completion = _is_completion,
      revision = revision + CASE WHEN is_completion IS DISTINCT FROM _is_completion THEN 1 ELSE 0 END
  WHERE id = _stage_id AND project_id = _project_id AND revision = _expected_revision
  RETURNING id INTO result;
  IF result IS NULL THEN
    RAISE EXCEPTION 'Stage changed. Refresh and try again' USING ERRCODE='40001';
  END IF;
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.set_project_stage_completion(uuid, uuid, boolean, integer)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_project_stage_completion(uuid, uuid, boolean, integer)
TO authenticated;

-- Backfill header/dashboard progress without changing any tasks.
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT id FROM public.projects LOOP
    PERFORM public.recalculate_ordo_project_progress(p.id);
  END LOOP;
END $$;
COMMIT;
