-- Canonical project team membership (existing internal studio members only).
-- Deployment: apply after 20261111220000_trello_stages.sql to the VERIFIED canonical database.
-- Never apply to the legacy production Supabase project.
BEGIN;

CREATE FUNCTION public.list_project_team(_organization_id uuid,_project_id uuid)
RETURNS TABLE(user_id uuid, member_name text, studio_role text, project_role text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE context_id uuid;
BEGIN
  SELECT p.work_context_id INTO context_id
  FROM public.projects p
  JOIN public.work_contexts ctx ON ctx.organization_id=p.organization_id AND ctx.id=p.work_context_id
  WHERE p.id=_project_id AND p.organization_id=_organization_id
    AND p.archived_at IS NULL AND ctx.archived_at IS NULL;

  IF context_id IS NULL OR NOT public.foundation_can_write_context(_organization_id,context_id)
     OR NOT (
       public.foundation_has_capability(_organization_id,'production.write_all')
       OR EXISTS(SELECT 1 FROM public.work_context_memberships existing
                 WHERE existing.organization_id=_organization_id AND existing.work_context_id=context_id
                   AND existing.user_id=auth.uid() AND existing.status='active'
                   AND existing.role IN ('owner','manager'))
     ) THEN
    RAISE EXCEPTION 'Project team management access denied' USING ERRCODE='42501';
  END IF;

  RETURN QUERY SELECT member.user_id,
    coalesce(nullif(trim(profile.full_name),''),'Team member '||left(member.user_id::text,8)),
    member.role,
    assigned.role
  FROM public.organization_memberships member
  JOIN public.profiles profile ON profile.id=member.user_id
  LEFT JOIN public.work_context_memberships assigned
    ON assigned.organization_id=_organization_id AND assigned.work_context_id=context_id
      AND assigned.user_id=member.user_id AND assigned.status='active'
  WHERE member.organization_id=_organization_id AND member.status='active'
    AND member.role IN ('owner','admin','manager','member')
  ORDER BY CASE WHEN assigned.role IS NULL THEN 1 ELSE 0 END,
    profile.full_name NULLS LAST,member.user_id;
END $$;
REVOKE ALL ON FUNCTION public.list_project_team(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_project_team(uuid,uuid) TO authenticated;

CREATE FUNCTION public.set_project_team_member(
  _organization_id uuid,_project_id uuid,_user_id uuid,_role text,_request_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  actor uuid;
  project_row public.projects%ROWTYPE;
  current_role text;
  is_lead boolean;
  payload jsonb;
  replay uuid;
BEGIN
  actor:=public.foundation_require_actor();
  PERFORM 1 FROM public.organization_memberships
    WHERE organization_id=_organization_id AND user_id=actor FOR SHARE;
  SELECT p.* INTO project_row FROM public.projects p
    JOIN public.work_contexts ctx ON ctx.organization_id=p.organization_id AND ctx.id=p.work_context_id
    WHERE p.id=_project_id AND p.organization_id=_organization_id
      AND p.archived_at IS NULL AND ctx.archived_at IS NULL
    FOR UPDATE OF ctx;
  IF NOT FOUND OR NOT public.foundation_can_write_context(_organization_id,project_row.work_context_id) THEN
    RAISE EXCEPTION 'Project unavailable or access denied' USING ERRCODE='42501';
  END IF;
  is_lead := actor=project_row.owner_id OR public.foundation_has_capability(_organization_id,'production.write_all');
  IF NOT (is_lead OR EXISTS(
    SELECT 1 FROM public.work_context_memberships member
     WHERE member.organization_id=_organization_id AND member.work_context_id=project_row.work_context_id
       AND member.user_id=actor AND member.role='manager' AND member.status='active'
  )) THEN
    RAISE EXCEPTION 'Project team management access denied' USING ERRCODE='42501';
  END IF;

  IF _user_id IS NULL OR _role IS NOT NULL AND _role NOT IN ('manager','contributor','viewer') THEN
    RAISE EXCEPTION 'Choose a valid member role' USING ERRCODE='22023';
  END IF;
  IF _user_id=project_row.owner_id THEN
    RAISE EXCEPTION 'Project owner access cannot be changed here' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.organization_memberships member
      WHERE member.organization_id=_organization_id AND member.user_id=_user_id
        AND member.status='active' AND member.role IN ('owner','admin','manager','member')
  ) THEN
    RAISE EXCEPTION 'Add this person to the studio before assigning them to a project' USING ERRCODE='22023';
  END IF;

  SELECT member.role INTO current_role FROM public.work_context_memberships member
    WHERE member.organization_id=_organization_id AND member.work_context_id=project_row.work_context_id
      AND member.user_id=_user_id AND member.status='active';

  IF current_role='owner' THEN
    RAISE EXCEPTION 'Project ownership cannot be changed here' USING ERRCODE='42501';
  END IF;
  IF NOT is_lead AND (_role='manager' OR current_role='manager' OR _user_id=actor) THEN
    RAISE EXCEPTION 'Only the project owner may manage project managers' USING ERRCODE='42501';
  END IF;
  IF _role IS NULL OR _role='viewer' THEN
    IF EXISTS(
      SELECT 1 FROM public.task_assignees assigned
      WHERE assigned.organization_id=_organization_id
        AND assigned.work_context_id=project_row.work_context_id AND assigned.user_id=_user_id
    ) THEN
      RAISE EXCEPTION 'Reassign this person''s tasks before removing or reducing project access' USING ERRCODE='22023';
    END IF;
  END IF;

  payload:=jsonb_build_object('organization',_organization_id,'project',_project_id,
    'member',_user_id,'role',_role);
  replay:=public.foundation_command_result('set_project_team_member',_request_id,payload);
  IF replay IS NOT NULL THEN RETURN replay; END IF;

  IF _role IS NULL THEN
    UPDATE public.work_context_memberships
      SET status='inactive'
      WHERE organization_id=_organization_id AND work_context_id=project_row.work_context_id
        AND user_id=_user_id AND status='active';
  ELSE
    INSERT INTO public.work_context_memberships(organization_id,work_context_id,user_id,role,status)
      VALUES(_organization_id,project_row.work_context_id,_user_id,_role,'active')
      ON CONFLICT(organization_id,work_context_id,user_id)
      DO UPDATE SET role=excluded.role,status='active';
  END IF;
  INSERT INTO public.command_receipts(actor_id,command,request_id,organization_id,payload,result_id)
    VALUES(actor,'set_project_team_member',_request_id,_organization_id,payload,_user_id);
  INSERT INTO public.audit_events(organization_id,actor_id,event_type,entity_id,request_id)
    VALUES(_organization_id,actor,CASE WHEN _role IS NULL THEN 'project.member_removed'
         ELSE 'project.member_role_updated' END,_user_id,_request_id);
  RETURN _user_id;
END $$;
REVOKE ALL ON FUNCTION public.set_project_team_member(uuid,uuid,uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_project_team_member(uuid,uuid,uuid,text,uuid) TO authenticated;
COMMIT;
