BEGIN;
CREATE FUNCTION public.list_unified_tasks(_organization_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object(
 'id',t.id,'organization_id',t.organization_id,'work_context_id',t.work_context_id,'board_id',t.board_id,'column_id',t.column_id,
 'title',t.title,'description',t.description,'category',t.category,'priority',t.priority,'position',t.position,'due_date',t.due_date,'revision',t.revision,'archived_at',t.archived_at,
 'context_kind',c.kind,'context_name',coalesce(p.name,o.name),'project_id',p.id,'ownership',p.ownership,'initiative_name',i.name,
 'board_name',b.name,'board_archived',b.archived_at IS NOT NULL,'context_archived',c.archived_at IS NOT NULL,
 'can_write',c.archived_at IS NULL AND public.foundation_can_write_context(t.organization_id,t.work_context_id),
 'assignees',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.user_id,'name',coalesce(nullif(pr.full_name,''),'Team member '||left(a.user_id::text,8))) ORDER BY a.user_id)
 FROM public.task_assignees a JOIN public.profiles pr ON pr.id=a.user_id WHERE a.organization_id=t.organization_id AND a.work_context_id=t.work_context_id AND a.task_id=t.id),'[]'::jsonb)
 ) ORDER BY t.due_date NULLS LAST,t.title,t.id),'[]'::jsonb)
 FROM public.tasks t JOIN public.work_contexts c ON c.organization_id=t.organization_id AND c.id=t.work_context_id
 LEFT JOIN public.projects p ON p.organization_id=c.organization_id AND p.work_context_id=c.id
 LEFT JOIN public.operational_contexts o ON o.organization_id=c.organization_id AND o.work_context_id=c.id
 LEFT JOIN public.internal_initiatives i ON i.organization_id=p.organization_id AND i.id=p.internal_initiative_id
 LEFT JOIN public.boards b ON b.organization_id=t.organization_id AND b.work_context_id=t.work_context_id AND b.id=t.board_id
 WHERE t.organization_id=_organization_id AND t.archived_at IS NULL AND public.foundation_can_read_context(t.organization_id,t.work_context_id);
$$;
REVOKE ALL ON FUNCTION public.list_unified_tasks(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_unified_tasks(uuid) TO authenticated;

CREATE FUNCTION public.list_context_assignees(_organization_id uuid,_context_id uuid) RETURNS TABLE(id uuid,name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT public.foundation_can_write_context(_organization_id,_context_id) THEN RAISE EXCEPTION 'Context access denied' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT p.id,coalesce(nullif(p.full_name,''),'Team member '||left(p.id::text,8)) FROM public.profiles p
 WHERE public.production_assignee_eligible(_organization_id,_context_id,p.id) ORDER BY p.full_name,p.id;
END $$;
REVOKE ALL ON FUNCTION public.list_context_assignees(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_context_assignees(uuid,uuid) TO authenticated;

CREATE FUNCTION public.save_operational_task(_organization_id uuid,_context_id uuid,_task_id uuid,_expected_revision integer,_values jsonb,_request_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid; context_id uuid; t public.tasks%ROWTYPE; dest public.board_columns%ROWTYPE; v_column uuid; v_category text; v_position integer; users uuid[];uid uuid;payload jsonb;result uuid;
BEGIN
 actor:=public.foundation_require_actor();
 PERFORM 1 FROM public.organization_memberships WHERE organization_id=_organization_id AND user_id=actor FOR SHARE;
 PERFORM 1 FROM public.work_context_memberships WHERE organization_id=_organization_id AND user_id=actor FOR SHARE;
 SELECT c.id INTO context_id FROM public.work_contexts c WHERE c.organization_id=_organization_id AND c.id=_context_id AND c.kind='operational' AND c.archived_at IS NULL FOR UPDATE;
 IF context_id IS NULL OR NOT public.foundation_can_write_context(_organization_id,context_id) THEN RAISE EXCEPTION 'Operational write access denied' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(_values) IS DISTINCT FROM 'object' OR jsonb_typeof(_values->'assignees') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid operational task values' USING ERRCODE='22023'; END IF;
 payload:=jsonb_build_object('org',_organization_id,'context',_context_id,'task',_task_id,'revision',_expected_revision,'values',_values);
 result:=public.foundation_command_result('save_operational_task',_request_id,payload);IF result IS NOT NULL THEN RETURN result; END IF;
 SELECT * INTO t FROM public.tasks WHERE organization_id=_organization_id AND work_context_id=context_id AND id=_task_id AND archived_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Task unavailable' USING ERRCODE='42501'; END IF;
 IF t.revision IS DISTINCT FROM _expected_revision THEN RAISE EXCEPTION 'Task changed. Reload before saving.' USING ERRCODE='40001'; END IF;
 v_column:=nullif(_values->>'column_id','')::uuid;
 IF v_column IS NOT NULL THEN
  SELECT c.* INTO dest FROM public.board_columns c JOIN public.boards b ON b.id=c.board_id AND b.organization_id=c.organization_id AND b.work_context_id=c.work_context_id WHERE c.id=v_column AND c.organization_id=_organization_id AND c.work_context_id=context_id AND b.archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Destination unavailable' USING ERRCODE='42501'; END IF;
  v_category:=dest.category;
 ELSE v_category:=coalesce(_values->>'category',t.category); END IF;
 SELECT coalesce(array_agg(DISTINCT value::uuid),ARRAY[]::uuid[]) INTO users FROM jsonb_array_elements_text(_values->'assignees');
 IF cardinality(users)>100 OR array_position(users,NULL) IS NOT NULL THEN RAISE EXCEPTION 'Invalid assignees' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM public.organization_memberships WHERE organization_id=_organization_id AND user_id=ANY(users) FOR SHARE;
 PERFORM 1 FROM public.work_context_memberships WHERE organization_id=_organization_id AND work_context_id=context_id AND user_id=ANY(users) FOR SHARE;
 FOREACH uid IN ARRAY users LOOP IF NOT public.production_assignee_eligible(_organization_id,context_id,uid) THEN RAISE EXCEPTION 'Assignee needs active contribution access' USING ERRCODE='42501'; END IF; END LOOP;
 IF t.column_id IS NOT DISTINCT FROM v_column THEN v_position:=t.position; ELSE SELECT coalesce(max(other.position)+1,0) INTO v_position FROM public.tasks other WHERE other.work_context_id=context_id AND other.column_id IS NOT DISTINCT FROM v_column; END IF;
 UPDATE public.tasks SET title=trim(_values->>'title'),description=nullif(_values->>'description',''),priority=_values->>'priority',due_date=nullif(_values->>'due_date','')::date,category=v_category,board_id=dest.board_id,column_id=v_column,position=v_position,revision=revision+1,updated_at=now() WHERE id=_task_id;
 DELETE FROM public.task_assignees WHERE organization_id=_organization_id AND task_id=_task_id;
 INSERT INTO public.task_assignees(organization_id,work_context_id,task_id,user_id) SELECT _organization_id,context_id,_task_id,u FROM unnest(users) u;
 INSERT INTO public.command_receipts(actor_id,command,request_id,organization_id,payload,result_id) VALUES(actor,'save_operational_task',_request_id,_organization_id,payload,_task_id);
 INSERT INTO public.audit_events(organization_id,actor_id,event_type,entity_id,request_id) VALUES(_organization_id,actor,'production.operational_task.saved',_task_id,_request_id);
 RETURN _task_id;
END $$;
REVOKE ALL ON FUNCTION public.save_operational_task(uuid,uuid,uuid,integer,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_operational_task(uuid,uuid,uuid,integer,jsonb,uuid) TO authenticated;
COMMIT;
