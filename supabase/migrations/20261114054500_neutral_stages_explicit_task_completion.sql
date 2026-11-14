-- Stage names, templates, themes and ordering are presentation/organization ONLY.
-- Task completion is an explicit task property; stage movement never changes it.
-- Legacy category and status columns are retained solely for old-client compatibility.
BEGIN;

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_at timestamptz;
COMMENT ON COLUMN public.tasks.completed_at IS 'Explicit task completion, independent of stage, stage name, reporting category and checklist. Null = incomplete.';

-- Remove the stage-specific completion feature entirely.
DROP TRIGGER IF EXISTS trg_ordo_stage_completion_progress ON public.project_stages;
DROP FUNCTION IF EXISTS public.set_project_stage_completion(uuid, uuid, boolean, integer);
DROP FUNCTION IF EXISTS public.ordo_stage_progress_trigger();
ALTER TABLE public.project_stages DROP COLUMN IF EXISTS is_completion;

-- Default stage names are merely optional starting labels. No category is completed by default.
CREATE OR REPLACE FUNCTION public.legacy_seed_project_stages()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.project_stages(workspace_id, project_id, name, category, position)
  SELECT NEW.workspace_id, NEW.id, seed.name, seed.category, seed.position
  FROM (VALUES
    ('Backlog','backlog',0),('To do','todo',1),('In progress','in_progress',2),
    ('Review','review',3),('Done','done',4)
  ) AS seed(name,category,position);
  RETURN NEW;
END $$;

-- Stage_id is the only workflow location. No status-to-stage or stage-to-status mapping.
-- Assign the first available stage only when a task has no stage (legacy fallback)
-- or is explicitly moved to another project.
CREATE OR REPLACE FUNCTION public.legacy_sync_task_stage()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $ordo$
DECLARE needs_stage boolean;
BEGIN
  IF TG_OP='INSERT' THEN
    needs_stage:=NEW.stage_id IS NULL;
  ELSE
    needs_stage:=NEW.stage_id IS NULL OR NEW.project_id IS DISTINCT FROM OLD.project_id;
  END IF;
  IF needs_stage THEN
    SELECT s.id INTO NEW.stage_id FROM public.project_stages s
      WHERE s.project_id=NEW.project_id ORDER BY s.position,s.id LIMIT 1;
    IF NEW.stage_id IS NULL THEN
      RAISE EXCEPTION 'Project has no available stages' USING ERRCODE='23503';
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.project_stages s
      WHERE s.project_id=NEW.project_id AND s.id=NEW.stage_id) THEN
    RAISE EXCEPTION 'Stage does not belong to this project' USING ERRCODE='23503';
  END IF;
  RETURN NEW;
END $ordo$;

DROP TRIGGER IF EXISTS legacy_task_stage_compat ON public.tasks;
CREATE TRIGGER legacy_task_stage_compat
  BEFORE INSERT OR UPDATE OF stage_id,project_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.legacy_sync_task_stage();

-- Preserve stage management operations and user permissions, but transferring
-- tasks into another stage must not write reporting status or task completion.
CREATE OR REPLACE FUNCTION public.manage_project_stage(
  _project_id uuid,_action text,_stage_id uuid,_name text,
  _category text,_before_id uuid,_destination_id uuid,
  _expected_revision integer,_request_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 actor uuid; project_workspace uuid; current_stage public.project_stages%ROWTYPE;
 payload jsonb; previous public.project_stage_receipts%ROWTYPE;
 result uuid; ordered_ids uuid[]; insert_index integer; other_count integer;
 destination public.project_stages%ROWTYPE; last_position integer;
BEGIN
 actor:=auth.uid();
 IF actor IS NULL OR _project_id IS NULL OR _request_id IS NULL THEN
   RAISE EXCEPTION 'Sign-in, project and request ID are required' USING ERRCODE='42501';
 END IF;
 IF _action IS NULL OR _action NOT IN ('create','rename','reorder','remove','delete') THEN
   RAISE EXCEPTION 'Unknown stage action' USING ERRCODE='22023';
 END IF;
 SELECT workspace_id INTO project_workspace FROM public.projects p
   WHERE p.id=_project_id AND p.archived_at IS NULL FOR UPDATE;
 IF project_workspace IS NULL OR NOT public.can_manage_project(_project_id,actor) THEN
   RAISE EXCEPTION 'Project stage management denied' USING ERRCODE='42501';
 END IF;

 payload:=jsonb_build_object('project',_project_id,'action',_action,'stage',_stage_id,
   'name',_name,'category',_category,'before',_before_id,'destination',_destination_id,
   'revision',_expected_revision);
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||':'||_request_id::text,0));
 SELECT * INTO previous FROM public.project_stage_receipts
   WHERE actor_id=actor AND request_id=_request_id;
 IF FOUND THEN
   IF previous.payload IS DISTINCT FROM payload THEN
     RAISE EXCEPTION 'Request identity was already used for a different action' USING ERRCODE='22023';
   END IF;
   RETURN previous.result_id;
 END IF;

 IF _action='create' THEN
   IF _stage_id IS NOT NULL OR _name IS NULL OR length(btrim(_name)) NOT BETWEEN 1 AND 160
      OR _category IS NULL OR _category NOT IN ('backlog','todo','in_progress','review','done') THEN
     RAISE EXCEPTION 'A valid stage title and category are required' USING ERRCODE='22023';
   END IF;
   INSERT INTO public.project_stages(workspace_id,project_id,name,category,position)
   VALUES(project_workspace,_project_id,btrim(_name),_category,
     (SELECT coalesce(max(position)+1,0) FROM public.project_stages WHERE project_id=_project_id))
   RETURNING id INTO result;
 ELSE
   SELECT * INTO current_stage FROM public.project_stages s
     WHERE s.id=_stage_id AND s.project_id=_project_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'Stage unavailable, refresh the project' USING ERRCODE='40001'; END IF;
   IF current_stage.revision IS DISTINCT FROM _expected_revision THEN
     RAISE EXCEPTION 'Stage changed, reload before saving' USING ERRCODE='40001';
   END IF;
   result:=current_stage.id;
   IF _action='rename' THEN
     IF _name IS NULL OR length(btrim(_name)) NOT BETWEEN 1 AND 160 THEN
       RAISE EXCEPTION 'Choose a stage title' USING ERRCODE='22023';
     END IF;
     UPDATE public.project_stages SET name=btrim(_name),revision=revision+1 WHERE id=result;
   ELSIF _action='reorder' THEN
     IF _before_id=result THEN
       RAISE EXCEPTION 'Choose a different stage' USING ERRCODE='22023';
     END IF;
     SELECT coalesce(array_agg(id ORDER BY position,id),ARRAY[]::uuid[]) INTO ordered_ids
       FROM public.project_stages WHERE project_id=_project_id AND id<>result;
     IF _before_id IS NULL THEN insert_index:=cardinality(ordered_ids)+1;
     ELSE
       insert_index:=array_position(ordered_ids,_before_id);
       IF insert_index IS NULL THEN
         RAISE EXCEPTION 'Destination stage unavailable' USING ERRCODE='40001';
       END IF;
     END IF;
     ordered_ids:=coalesce(ordered_ids[1:insert_index-1],ARRAY[]::uuid[])||
       ARRAY[result]||coalesce(ordered_ids[insert_index:cardinality(ordered_ids)],ARRAY[]::uuid[]);
     UPDATE public.project_stages s SET position=o.n-1,
       revision=s.revision+CASE WHEN s.position IS DISTINCT FROM o.n-1 THEN 1 ELSE 0 END
       FROM unnest(ordered_ids) WITH ORDINALITY o(id,n)
       WHERE s.project_id=_project_id AND s.id=o.id AND s.position IS DISTINCT FROM o.n-1;
   ELSE
     SELECT count(*) INTO other_count FROM public.project_stages WHERE project_id=_project_id AND id<>result;
     IF other_count=0 THEN
       RAISE EXCEPTION 'Keep at least one stage in a project' USING ERRCODE='22023';
     END IF;
     IF _action='delete' THEN
       -- Explicit destructive action; cached clients still use 'remove' to
       -- transfer tasks. Related task rows follow existing FK ON DELETE CASCADE.
       DELETE FROM public.tasks WHERE project_id=_project_id AND stage_id=result;
     ELSE
     IF EXISTS(SELECT 1 FROM public.tasks WHERE project_id=_project_id AND stage_id=result) THEN
       IF _destination_id IS NULL OR _destination_id=result THEN
         RAISE EXCEPTION 'Move tasks to a different stage before removing this stage' USING ERRCODE='22023';
       END IF;
       SELECT * INTO destination FROM public.project_stages
         WHERE project_id=_project_id AND id=_destination_id;
       IF NOT FOUND THEN
         RAISE EXCEPTION 'Destination stage unavailable' USING ERRCODE='42501';
       END IF;
       SELECT coalesce(max(position),-1) INTO last_position FROM public.tasks
         WHERE project_id=_project_id AND stage_id=destination.id;
       WITH moving AS (
         SELECT t.id,row_number() OVER(ORDER BY t.position,t.id) AS n FROM public.tasks t
         WHERE t.project_id=_project_id AND t.stage_id=result
       )
       UPDATE public.tasks t
       SET stage_id=destination.id,position=last_position+moving.n
       FROM moving WHERE t.id=moving.id AND t.project_id=_project_id;
     END IF;
     END IF;
     DELETE FROM public.project_stages WHERE project_id=_project_id AND id=result;
     WITH ordered AS (
       SELECT id,row_number() OVER(ORDER BY position,id) AS n
       FROM public.project_stages WHERE project_id=_project_id
     )
     UPDATE public.project_stages s SET position=o.n-1,revision=s.revision+1
       FROM ordered o WHERE s.id=o.id AND s.position IS DISTINCT FROM o.n-1;
   END IF;
 END IF;

 INSERT INTO public.project_stage_receipts(actor_id,request_id,project_id,payload,result_id)
 VALUES(actor,_request_id,_project_id,payload,result);
 RETURN result;
END $$;


REVOKE ALL ON FUNCTION public.manage_project_stage(uuid,text,uuid,text,text,uuid,uuid,integer,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manage_project_stage(uuid,text,uuid,text,text,uuid,uuid,integer,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.recalculate_ordo_project_progress(_project_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE all_tasks integer; completed_tasks integer;
BEGIN
  IF _project_id IS NULL THEN RETURN; END IF;
  SELECT count(*)::integer,
    count(*) FILTER (WHERE completed_at IS NOT NULL)::integer
    INTO all_tasks, completed_tasks
  FROM public.tasks WHERE project_id=_project_id AND archived_at IS NULL;

  UPDATE public.projects SET progress=CASE WHEN all_tasks=0 THEN 0
    ELSE round(completed_tasks::numeric*100/all_tasks)::integer END
  WHERE id=_project_id;
END $$;

REVOKE ALL ON FUNCTION public.recalculate_ordo_project_progress(uuid)
  FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS trg_ordo_task_progress ON public.tasks;
CREATE TRIGGER trg_ordo_task_progress
 AFTER INSERT OR DELETE OR UPDATE OF completed_at,archived_at,project_id ON public.tasks
 FOR EACH ROW EXECUTE FUNCTION public.ordo_task_progress_trigger();

-- Do not invent completion for old tasks based on their stage names. New field
-- starts NULL for everyone; users explicitly mark completed work.
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT id FROM public.projects LOOP
    PERFORM public.recalculate_ordo_project_progress(p.id);
  END LOOP;
END $$;

COMMIT;
