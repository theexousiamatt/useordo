BEGIN;
ALTER TABLE public.boards ADD COLUMN revision integer NOT NULL DEFAULT 0 CHECK(revision>=0);
ALTER TABLE public.board_columns ADD COLUMN revision integer NOT NULL DEFAULT 0 CHECK(revision>=0);
ALTER TABLE public.tasks ADD COLUMN revision integer NOT NULL DEFAULT 0 CHECK(revision>=0);

CREATE FUNCTION public.production_assignee_eligible(_organization_id uuid,_context_id uuid,_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.organization_memberships m
 WHERE m.organization_id=_organization_id AND m.user_id=_user_id AND m.status='active' AND m.role<>'client'
 AND (EXISTS(SELECT 1 FROM public.organization_role_capabilities r WHERE r.role=m.role AND r.capability_key='production.write_all')
 OR EXISTS(SELECT 1 FROM public.organization_capability_grants g WHERE g.organization_id=m.organization_id AND g.user_id=m.user_id AND g.capability_key='production.write_all')
 OR EXISTS(SELECT 1 FROM public.work_context_memberships c WHERE c.organization_id=m.organization_id AND c.work_context_id=_context_id AND c.user_id=m.user_id AND c.status='active' AND c.role IN ('owner','manager','contributor'))));
$$;
REVOKE ALL ON FUNCTION public.production_assignee_eligible(uuid,uuid,uuid) FROM PUBLIC;

CREATE FUNCTION public.list_production_assignees(_organization_id uuid,_project_id uuid) RETURNS TABLE(id uuid,name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ctx uuid;
BEGIN
 SELECT work_context_id INTO ctx FROM public.projects WHERE organization_id=_organization_id AND id=_project_id;
 IF ctx IS NULL OR NOT public.foundation_can_write_context(_organization_id,ctx) THEN RAISE EXCEPTION 'Project access denied' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT p.id,coalesce(nullif(p.full_name,''),'Team member '||left(p.id::text,8)) FROM public.profiles p
 WHERE public.production_assignee_eligible(_organization_id,ctx,p.id) ORDER BY p.full_name,p.id;
END $$;
REVOKE ALL ON FUNCTION public.list_production_assignees(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_production_assignees(uuid,uuid) TO authenticated;

CREATE FUNCTION public.save_production_item(_organization_id uuid,_project_id uuid,_kind text,_id uuid,_expected_revision integer,_values jsonb,_request_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid; ctx uuid; result uuid; payload jsonb; current_revision integer; destination public.board_columns%ROWTYPE;
 old_task public.tasks%ROWTYPE; target_board public.boards%ROWTYPE; users uuid[]; uid uuid; next_position integer;
BEGIN
 actor:=public.foundation_require_actor();
 PERFORM 1 FROM public.organization_memberships WHERE organization_id=_organization_id AND user_id=actor FOR SHARE;
 PERFORM 1 FROM public.work_context_memberships WHERE organization_id=_organization_id AND user_id=actor FOR SHARE;
 SELECT p.work_context_id INTO ctx FROM public.projects p JOIN public.work_contexts c ON c.organization_id=p.organization_id AND c.id=p.work_context_id
 WHERE p.organization_id=_organization_id AND p.id=_project_id AND c.archived_at IS NULL FOR UPDATE OF c;
 IF ctx IS NULL OR NOT public.foundation_can_write_context(_organization_id,ctx) THEN RAISE EXCEPTION 'Project write access denied' USING ERRCODE='42501'; END IF;
 IF _kind NOT IN ('board','column','task') OR _kind IS NULL OR jsonb_typeof(_values) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid production command' USING ERRCODE='22023'; END IF;
 IF _kind IN ('board','column') AND NOT (public.foundation_has_capability(_organization_id,'production.write_all') OR EXISTS(
 SELECT 1 FROM public.work_context_memberships WHERE organization_id=_organization_id AND work_context_id=ctx AND user_id=actor AND status='active' AND role IN ('owner','manager'))) THEN
 RAISE EXCEPTION 'Board configuration access denied' USING ERRCODE='42501'; END IF;
 payload:=jsonb_build_object('organization',_organization_id,'project',_project_id,'kind',_kind,'id',_id,'revision',_expected_revision,'values',_values);
 result:=public.foundation_command_result('save_production_item',_request_id,payload);
 IF result IS NOT NULL THEN RETURN result; END IF;
 result:=coalesce(_id,gen_random_uuid());
 IF _kind='board' THEN
  IF _id IS NULL THEN
   SELECT coalesce(max(position)+1,0) INTO next_position FROM public.boards WHERE organization_id=_organization_id AND work_context_id=ctx;
   INSERT INTO public.boards(id,organization_id,work_context_id,name,position) VALUES(result,_organization_id,ctx,trim(_values->>'name'),next_position);
   INSERT INTO public.board_columns(organization_id,work_context_id,board_id,name,category,position) VALUES(_organization_id,ctx,result,'To do','todo',0);
  ELSE
   SELECT revision INTO current_revision FROM public.boards WHERE organization_id=_organization_id AND work_context_id=ctx AND id=_id AND archived_at IS NULL;
   IF NOT FOUND THEN RAISE EXCEPTION 'Board unavailable' USING ERRCODE='42501'; END IF;
   IF _expected_revision IS DISTINCT FROM current_revision THEN RAISE EXCEPTION 'This board changed. Reload before saving.' USING ERRCODE='40001'; END IF;
   UPDATE public.boards SET name=trim(_values->>'name'),revision=revision+1 WHERE id=_id;
  END IF;
 ELSIF _kind='column' THEN
  SELECT * INTO target_board FROM public.boards WHERE organization_id=_organization_id AND work_context_id=ctx AND id=(_values->>'board_id')::uuid AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Board unavailable' USING ERRCODE='42501'; END IF;
  IF _id IS NULL THEN
   SELECT coalesce(max(position)+1,0) INTO next_position FROM public.board_columns WHERE board_id=target_board.id;
   INSERT INTO public.board_columns(id,organization_id,work_context_id,board_id,name,category,position) VALUES(result,_organization_id,ctx,target_board.id,trim(_values->>'name'),_values->>'category',next_position);
  ELSE
   SELECT revision INTO current_revision FROM public.board_columns WHERE organization_id=_organization_id AND work_context_id=ctx AND board_id=target_board.id AND id=_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'Column unavailable' USING ERRCODE='42501'; END IF;
   IF _expected_revision IS DISTINCT FROM current_revision THEN RAISE EXCEPTION 'This column changed. Reload before saving.' USING ERRCODE='40001'; END IF;
   IF EXISTS(SELECT 1 FROM public.tasks WHERE column_id=_id) AND EXISTS(SELECT 1 FROM public.board_columns WHERE id=_id AND category IS DISTINCT FROM _values->>'category') THEN
    RAISE EXCEPTION 'Move tasks before changing this column category.' USING ERRCODE='22023'; END IF;
   UPDATE public.board_columns SET name=trim(_values->>'name'),category=_values->>'category',revision=revision+1 WHERE id=_id;
  END IF;
 ELSE
  SELECT c.* INTO destination FROM public.board_columns c JOIN public.boards b ON b.organization_id=c.organization_id AND b.work_context_id=c.work_context_id AND b.id=c.board_id
   WHERE c.organization_id=_organization_id AND c.work_context_id=ctx AND c.id=(_values->>'column_id')::uuid AND b.archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Destination unavailable' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(_values->'assignees') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Provide an assignee list' USING ERRCODE='22023'; END IF;
  SELECT coalesce(array_agg(DISTINCT value::uuid),ARRAY[]::uuid[]) INTO users FROM jsonb_array_elements_text(_values->'assignees');
  IF cardinality(users)>100 OR array_position(users,NULL) IS NOT NULL THEN RAISE EXCEPTION 'Invalid assignees' USING ERRCODE='22023'; END IF;
  -- Lock the membership rows used by eligibility so concurrent revocation cannot be ignored.
  PERFORM 1 FROM public.organization_memberships WHERE organization_id=_organization_id AND user_id=ANY(users) FOR SHARE;
  PERFORM 1 FROM public.work_context_memberships WHERE organization_id=_organization_id AND work_context_id=ctx AND user_id=ANY(users) FOR SHARE;
  FOREACH uid IN ARRAY users LOOP
   IF NOT public.production_assignee_eligible(_organization_id,ctx,uid) THEN RAISE EXCEPTION 'Assignee needs active contribution access to this project' USING ERRCODE='42501'; END IF;
  END LOOP;
  SELECT coalesce(max(position)+1,0) INTO next_position FROM public.tasks WHERE column_id=destination.id;
  IF _id IS NULL THEN
   INSERT INTO public.tasks(id,organization_id,work_context_id,board_id,column_id,title,description,priority,due_date,category,position,created_by)
    VALUES(result,_organization_id,ctx,destination.board_id,destination.id,trim(_values->>'title'),nullif(_values->>'description',''),_values->>'priority',nullif(_values->>'due_date','')::date,destination.category,next_position,actor);
  ELSE
   SELECT * INTO old_task FROM public.tasks WHERE organization_id=_organization_id AND work_context_id=ctx AND id=_id AND archived_at IS NULL;
   IF NOT FOUND THEN RAISE EXCEPTION 'Task unavailable' USING ERRCODE='42501'; END IF;
   IF _expected_revision IS DISTINCT FROM old_task.revision THEN RAISE EXCEPTION 'This task changed. Reload before saving.' USING ERRCODE='40001'; END IF;
   UPDATE public.tasks SET title=trim(_values->>'title'),description=nullif(_values->>'description',''),priority=_values->>'priority',due_date=nullif(_values->>'due_date','')::date,
    board_id=destination.board_id,column_id=destination.id,category=destination.category,position=CASE WHEN old_task.column_id=destination.id THEN old_task.position ELSE next_position END,revision=revision+1,updated_at=now() WHERE id=_id;
  END IF;
  DELETE FROM public.task_assignees WHERE organization_id=_organization_id AND task_id=result;
  INSERT INTO public.task_assignees(organization_id,work_context_id,task_id,user_id) SELECT _organization_id,ctx,result,u FROM unnest(users) u;
 END IF;
 INSERT INTO public.command_receipts(actor_id,command,request_id,organization_id,payload,result_id) VALUES(actor,'save_production_item',_request_id,_organization_id,payload,result);
 INSERT INTO public.audit_events(organization_id,actor_id,event_type,entity_id,request_id) VALUES(_organization_id,actor,'production.'||_kind||'.saved',result,_request_id);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.save_production_item(uuid,uuid,text,uuid,integer,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_production_item(uuid,uuid,text,uuid,integer,jsonb,uuid) TO authenticated;
CREATE FUNCTION public.production_permissions(_organization_id uuid,_project_id uuid) RETURNS TABLE(can_write boolean,can_configure boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.foundation_can_write_context(_organization_id,p.work_context_id),
 public.foundation_can_write_context(_organization_id,p.work_context_id) AND (public.foundation_has_capability(_organization_id,'production.write_all') OR EXISTS(SELECT 1 FROM public.work_context_memberships m WHERE m.organization_id=_organization_id AND m.work_context_id=p.work_context_id AND m.user_id=auth.uid() AND m.status='active' AND m.role IN ('owner','manager')))
 FROM public.projects p WHERE p.organization_id=_organization_id AND p.id=_project_id AND public.foundation_can_read_context(_organization_id,p.work_context_id);
$$;
REVOKE ALL ON FUNCTION public.production_permissions(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.production_permissions(uuid,uuid) TO authenticated;
COMMIT;
