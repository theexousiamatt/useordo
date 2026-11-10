BEGIN;
CREATE FUNCTION public.change_production_item(_organization_id uuid,_project_id uuid,_action text,_id uuid,_expected_revision integer,_column_id uuid,_before_id uuid,_request_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid;ctx uuid;result uuid;payload jsonb;t public.tasks%ROWTYPE;b public.boards%ROWTYPE;dest public.board_columns%ROWTYPE;users uuid[];ordered_ids uuid[];at_index integer;
BEGIN
 actor:=public.foundation_require_actor();
 PERFORM 1 FROM public.organization_memberships WHERE organization_id=_organization_id AND user_id=actor FOR SHARE;
 SELECT p.work_context_id INTO ctx FROM public.projects p JOIN public.work_contexts c ON c.organization_id=p.organization_id AND c.id=p.work_context_id WHERE p.organization_id=_organization_id AND p.id=_project_id AND c.archived_at IS NULL FOR UPDATE OF c;
 IF ctx IS NULL OR NOT public.foundation_can_write_context(_organization_id,ctx) THEN RAISE EXCEPTION 'Project write access denied' USING ERRCODE='42501'; END IF;
 IF _action IS NULL OR _action NOT IN ('move_task','archive_task','restore_task','archive_board','restore_board') THEN RAISE EXCEPTION 'Invalid production action' USING ERRCODE='22023'; END IF;
 IF _action IN ('archive_board','restore_board') AND NOT (public.foundation_has_capability(_organization_id,'production.write_all') OR EXISTS(SELECT 1 FROM public.work_context_memberships WHERE organization_id=_organization_id AND work_context_id=ctx AND user_id=actor AND status='active' AND role IN ('owner','manager'))) THEN RAISE EXCEPTION 'Board configuration access denied' USING ERRCODE='42501'; END IF;
 payload:=jsonb_build_object('org',_organization_id,'project',_project_id,'action',_action,'id',_id,'revision',_expected_revision,'column',_column_id,'before',_before_id);
 result:=public.foundation_command_result('change_production_item',_request_id,payload);IF result IS NOT NULL THEN RETURN result; END IF;
 IF _action IN ('archive_board','restore_board') THEN
  SELECT * INTO b FROM public.boards WHERE organization_id=_organization_id AND work_context_id=ctx AND id=_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Board unavailable' USING ERRCODE='42501'; END IF;
  IF b.revision IS DISTINCT FROM _expected_revision THEN RAISE EXCEPTION 'Board changed. Reload before trying again.' USING ERRCODE='40001'; END IF;
  UPDATE public.boards SET archived_at=CASE WHEN _action='archive_board' THEN coalesce(archived_at,now()) ELSE NULL END,revision=revision+1 WHERE id=_id;
 ELSE
  SELECT * INTO t FROM public.tasks WHERE organization_id=_organization_id AND work_context_id=ctx AND id=_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task unavailable' USING ERRCODE='42501'; END IF;
  IF t.revision IS DISTINCT FROM _expected_revision THEN RAISE EXCEPTION 'Task changed. Reload before trying again.' USING ERRCODE='40001'; END IF;
  IF _action='move_task' THEN
   IF t.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Restore the task before moving it' USING ERRCODE='22023'; END IF;
   SELECT * INTO dest FROM public.board_columns WHERE organization_id=_organization_id AND work_context_id=ctx AND id=_column_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'Destination unavailable' USING ERRCODE='42501'; END IF;
   IF _before_id IS NOT NULL AND (_before_id=_id OR NOT EXISTS(SELECT 1 FROM public.tasks WHERE organization_id=_organization_id AND work_context_id=ctx AND column_id=dest.id AND id=_before_id AND archived_at IS NULL)) THEN RAISE EXCEPTION 'Drop destination changed. Reload and retry.' USING ERRCODE='40001'; END IF;
   SELECT coalesce(array_agg(user_id ORDER BY user_id),ARRAY[]::uuid[]) INTO users FROM public.task_assignees WHERE organization_id=_organization_id AND task_id=_id;
   PERFORM public.save_production_item(_organization_id,_project_id,'task',_id,t.revision,jsonb_build_object('title',t.title,'description',t.description,'priority',t.priority,'due_date',t.due_date,'column_id',dest.id,'assignees',to_jsonb(users)),_request_id);
   SELECT coalesce(array_agg(id ORDER BY position,id),ARRAY[]::uuid[]) INTO ordered_ids FROM public.tasks WHERE column_id=dest.id AND id<>_id AND archived_at IS NULL;
   at_index:=coalesce(array_position(ordered_ids,_before_id),cardinality(ordered_ids)+1);
   ordered_ids:=coalesce(ordered_ids[1:at_index-1],ARRAY[]::uuid[])||ARRAY[_id]||coalesce(ordered_ids[at_index:cardinality(ordered_ids)],ARRAY[]::uuid[]);
   UPDATE public.tasks task SET position=ordering.n-1,revision=task.revision+CASE WHEN task.id=_id THEN 0 ELSE 1 END,updated_at=now()
    FROM unnest(ordered_ids) WITH ORDINALITY ordering(id,n) WHERE task.id=ordering.id AND task.position IS DISTINCT FROM ordering.n-1;
  ELSE
   IF _action='restore_task' AND NOT EXISTS(SELECT 1 FROM public.boards WHERE id=t.board_id AND organization_id=_organization_id AND work_context_id=ctx AND archived_at IS NULL) THEN RAISE EXCEPTION 'Restore the home board before restoring this task' USING ERRCODE='22023'; END IF;
   UPDATE public.tasks SET archived_at=CASE WHEN _action='archive_task' THEN coalesce(archived_at,now()) ELSE NULL END,position=CASE WHEN _action='restore_task' THEN (SELECT coalesce(max(other.position)+1,0) FROM public.tasks other WHERE other.column_id=t.column_id) ELSE position END,revision=revision+1,updated_at=now() WHERE id=_id;
  END IF;
 END IF;
 INSERT INTO public.command_receipts(actor_id,command,request_id,organization_id,payload,result_id) VALUES(actor,'change_production_item',_request_id,_organization_id,payload,_id);
 INSERT INTO public.audit_events(organization_id,actor_id,event_type,entity_id,request_id) VALUES(_organization_id,actor,'production.'||_action,_id,_request_id);
 RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.change_production_item(uuid,uuid,text,uuid,integer,uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_production_item(uuid,uuid,text,uuid,integer,uuid,uuid,uuid) TO authenticated;
COMMIT;
