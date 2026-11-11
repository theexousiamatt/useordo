-- Canonical board stages: guarded reorder and safe removal, including archived tasks.
-- Apply only to the verified Ordo canonical database after preview testing.
BEGIN;

CREATE FUNCTION public.change_production_column(
  _organization_id uuid,
  _project_id uuid,
  _action text,
  _column_id uuid,
  _expected_revision integer,
  _destination_column_id uuid,
  _request_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  actor uuid;
  ctx uuid;
  src public.board_columns%ROWTYPE;
  destination public.board_columns%ROWTYPE;
  payload jsonb;
  result uuid;
  column_ids uuid[];
  target_index integer;
  affected_tasks integer;
  target_last_position integer;
BEGIN
  actor := public.foundation_require_actor();
  PERFORM 1 FROM public.organization_memberships
    WHERE organization_id=_organization_id AND user_id=actor FOR SHARE;
  PERFORM 1 FROM public.work_context_memberships
    WHERE organization_id=_organization_id AND user_id=actor FOR SHARE;
  SELECT p.work_context_id INTO ctx
    FROM public.projects p
    JOIN public.work_contexts c ON c.organization_id=p.organization_id AND c.id=p.work_context_id
    WHERE p.organization_id=_organization_id AND p.id=_project_id AND c.archived_at IS NULL
    FOR UPDATE OF c;
  IF ctx IS NULL OR NOT public.foundation_can_write_context(_organization_id,ctx) THEN
    RAISE EXCEPTION 'Project write access denied' USING ERRCODE='42501';
  END IF;
  IF NOT (public.foundation_has_capability(_organization_id,'production.write_all') OR EXISTS (
    SELECT 1 FROM public.work_context_memberships
      WHERE organization_id=_organization_id AND work_context_id=ctx
        AND user_id=actor AND status='active' AND role IN ('owner','manager')
  )) THEN
    RAISE EXCEPTION 'Board configuration access denied' USING ERRCODE='42501';
  END IF;
  IF _action IS NULL OR _action NOT IN ('move_column','remove_column') THEN
    RAISE EXCEPTION 'Invalid column action' USING ERRCODE='22023';
  END IF;

  payload := jsonb_build_object(
    'organization',_organization_id,'project',_project_id,'action',_action,
    'column',_column_id,'revision',_expected_revision,
    'destination',_destination_column_id
  );
  result := public.foundation_command_result('change_production_column',_request_id,payload);
  IF result IS NOT NULL THEN RETURN result; END IF;

  SELECT col.* INTO src FROM public.board_columns col
    JOIN public.boards b
      ON b.organization_id=col.organization_id AND b.work_context_id=col.work_context_id AND b.id=col.board_id
    WHERE col.organization_id=_organization_id AND col.work_context_id=ctx AND col.id=_column_id
      AND b.archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Column unavailable' USING ERRCODE='42501'; END IF;
  IF src.revision IS DISTINCT FROM _expected_revision THEN
    RAISE EXCEPTION 'This column changed. Reload before trying again.' USING ERRCODE='40001';
  END IF;

  IF _action='move_column' THEN
    SELECT * INTO destination FROM public.board_columns
      WHERE organization_id=_organization_id AND work_context_id=ctx
        AND board_id=src.board_id AND id=_destination_column_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Destination stage unavailable' USING ERRCODE='42501'; END IF;
    IF destination.id<>src.id THEN
      SELECT coalesce(array_agg(id ORDER BY position,id),ARRAY[]::uuid[])
        INTO column_ids FROM public.board_columns
        WHERE organization_id=_organization_id AND work_context_id=ctx
          AND board_id=src.board_id AND id<>src.id;
      target_index := array_position(column_ids,destination.id);
      IF target_index IS NULL THEN RAISE EXCEPTION 'Destination stage changed' USING ERRCODE='40001'; END IF;
      column_ids := coalesce(column_ids[1:target_index-1],ARRAY[]::uuid[])
        || ARRAY[src.id]
        || coalesce(column_ids[target_index:cardinality(column_ids)],ARRAY[]::uuid[]);
      SET CONSTRAINTS ALL DEFERRED;
      UPDATE public.board_columns col
        SET position=ordering.n-1, revision=col.revision+1
        FROM unnest(column_ids) WITH ORDINALITY ordering(id,n)
        WHERE col.organization_id=_organization_id AND col.work_context_id=ctx
          AND col.board_id=src.board_id AND col.id=ordering.id
          AND col.position IS DISTINCT FROM ordering.n-1;
    END IF;
  ELSE
    SELECT count(*) INTO affected_tasks FROM public.tasks
      WHERE organization_id=_organization_id AND work_context_id=ctx AND column_id=src.id;
    IF affected_tasks>0 THEN
      IF _destination_column_id IS NULL OR _destination_column_id=src.id THEN
        RAISE EXCEPTION 'Choose another stage to receive the tasks before removing this one' USING ERRCODE='22023';
      END IF;
      SELECT * INTO destination FROM public.board_columns
        WHERE organization_id=_organization_id AND work_context_id=ctx
          AND board_id=src.board_id AND id=_destination_column_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Destination stage unavailable' USING ERRCODE='42501'; END IF;
      SELECT coalesce(max(position),-1) INTO target_last_position FROM public.tasks
        WHERE organization_id=_organization_id AND work_context_id=ctx AND column_id=destination.id;
      WITH moving AS (
        SELECT id,row_number() OVER (ORDER BY position,id) AS n
        FROM public.tasks WHERE organization_id=_organization_id AND work_context_id=ctx AND column_id=src.id
      )
      UPDATE public.tasks task
        SET board_id=destination.board_id, column_id=destination.id,
            category=destination.category, position=target_last_position+moving.n,
            revision=task.revision+1, updated_at=now()
        FROM moving WHERE task.id=moving.id
          AND task.organization_id=_organization_id AND task.work_context_id=ctx;
    END IF;
    SET CONSTRAINTS ALL DEFERRED;
    DELETE FROM public.board_columns WHERE organization_id=_organization_id AND work_context_id=ctx AND id=src.id;
    UPDATE public.board_columns col
      SET position=col.position-1,revision=col.revision+1
      WHERE col.organization_id=_organization_id AND col.work_context_id=ctx
        AND col.board_id=src.board_id AND col.position>src.position;
  END IF;

  INSERT INTO public.command_receipts(actor_id,command,request_id,organization_id,payload,result_id)
    VALUES(actor,'change_production_column',_request_id,_organization_id,payload,_column_id);
  INSERT INTO public.audit_events(organization_id,actor_id,event_type,entity_id,request_id)
    VALUES(_organization_id,actor,'production.'||_action,_column_id,_request_id);
  RETURN _column_id;
END $$;

REVOKE ALL ON FUNCTION public.change_production_column(uuid,uuid,text,uuid,integer,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_production_column(uuid,uuid,text,uuid,integer,uuid,uuid) TO authenticated;
COMMIT;
