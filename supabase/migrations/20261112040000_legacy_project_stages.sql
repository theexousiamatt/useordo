-- Additive legacy-Ordo stage model: the existing tasks.status category remains
-- intact for dashboard/reporting compatibility. DO NOT apply to the canonical foundation.
-- Not run against production: stage and RLS tests required before deployment.
BEGIN;

CREATE TABLE public.project_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 160),
  category text NOT NULL CHECK(category IN ('backlog','todo','in_progress','review','done')),
  position integer NOT NULL DEFAULT 0 CHECK(position>=0),
  revision integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id,id)
);
CREATE INDEX project_stages_order_idx ON public.project_stages(project_id,position,id);

ALTER TABLE public.project_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read project stages" ON public.project_stages FOR SELECT TO authenticated
  USING(public.can_view_project(project_id,auth.uid()));
GRANT SELECT ON public.project_stages TO authenticated;

-- Seed all existing projects; no tasks are removed or their legacy status altered.
INSERT INTO public.project_stages(workspace_id,project_id,name,category,position)
SELECT p.workspace_id,p.id,seed.name,seed.category,seed.position
FROM public.projects p CROSS JOIN (VALUES
  ('Backlog','backlog',0),
  ('To do','todo',1),
  ('In progress','in_progress',2),
  ('Review','review',3),
  ('Done','done',4)
) AS seed(name,category,position);

CREATE FUNCTION public.legacy_seed_project_stages() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  INSERT INTO public.project_stages(workspace_id,project_id,name,category,position)
  SELECT NEW.workspace_id,NEW.id,seed.name,seed.category,seed.position
  FROM (VALUES
    ('Backlog','backlog',0),('To do','todo',1),('In progress','in_progress',2),
    ('Review','review',3),('Done','done',4)
  ) AS seed(name,category,position);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.legacy_seed_project_stages() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER legacy_project_stage_seed AFTER INSERT ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.legacy_seed_project_stages();

ALTER TABLE public.tasks ADD COLUMN stage_id uuid;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_project_stage_fk
  FOREIGN KEY(project_id,stage_id) REFERENCES public.project_stages(project_id,id)
  ON DELETE RESTRICT;
CREATE INDEX tasks_project_stage_order_idx ON public.tasks(project_id,stage_id,position);

UPDATE public.tasks t SET stage_id=(
  SELECT s.id FROM public.project_stages s WHERE s.project_id=t.project_id AND s.category=t.status
  ORDER BY s.position,s.id LIMIT 1
);

-- Preserve compatibility with existing clients that only write tasks.status.
-- An explicit stage move updates the reporting category; a status-only update
-- chooses the first matching stage, or the first available stage as fallback.
CREATE FUNCTION public.legacy_sync_task_stage() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $
DECLARE target_category text; target_stage uuid; map_legacy_status boolean;
BEGIN
  -- Handle INSERT separately: accessing OLD on an insert is undefined.
  IF TG_OP='INSERT' THEN
    map_legacy_status := NEW.stage_id IS NULL;
  ELSE
    map_legacy_status := NEW.project_id IS DISTINCT FROM OLD.project_id
      OR NEW.stage_id IS NULL
      OR (NEW.status IS DISTINCT FROM OLD.status
        AND NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id);
  END IF;

  IF map_legacy_status THEN
    SELECT s.id INTO target_stage FROM public.project_stages s
      WHERE s.project_id=NEW.project_id AND s.category=NEW.status
      ORDER BY s.position,s.id LIMIT 1;
    IF target_stage IS NULL THEN
      SELECT s.id INTO target_stage FROM public.project_stages s
        WHERE s.project_id=NEW.project_id ORDER BY s.position,s.id LIMIT 1;
    END IF;
    NEW.stage_id:=target_stage;
  END IF;

  IF NEW.stage_id IS NOT NULL THEN
    SELECT s.category INTO target_category FROM public.project_stages s
      WHERE s.project_id=NEW.project_id AND s.id=NEW.stage_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Stage does not belong to this project' USING ERRCODE='23503'; END IF;
    IF NOT map_legacy_status AND (
      TG_OP='INSERT' OR
      (TG_OP='UPDATE' AND NEW.stage_id IS DISTINCT FROM OLD.stage_id)
    ) THEN
      NEW.status:=target_category;
    END IF;
  END IF;
  RETURN NEW;
END $;
REVOKE ALL ON FUNCTION public.legacy_sync_task_stage() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER legacy_task_stage_compat
BEFORE INSERT OR UPDATE OF stage_id,status,project_id ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.legacy_sync_task_stage();

-- Prevent uncertain create/remove retries from applying a second time.
CREATE TABLE public.project_stage_receipts (
  actor_id uuid NOT NULL,
  request_id uuid NOT NULL,
  project_id uuid NOT NULL,
  payload jsonb NOT NULL,
  result_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(actor_id,request_id)
);
ALTER TABLE public.project_stage_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_stage_receipts FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.manage_project_stage(
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
 IF _action IS NULL OR _action NOT IN ('create','rename','reorder','remove') THEN
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
       SET stage_id=destination.id,status=destination.category,position=last_position+moving.n
       FROM moving WHERE t.id=moving.id AND t.project_id=_project_id;
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
COMMIT;
