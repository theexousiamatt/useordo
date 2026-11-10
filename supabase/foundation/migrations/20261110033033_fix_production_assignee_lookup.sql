BEGIN;
CREATE OR REPLACE FUNCTION public.list_production_assignees(_organization_id uuid,_project_id uuid) RETURNS TABLE(id uuid,name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ctx uuid;
BEGIN
 SELECT p.work_context_id INTO ctx FROM public.projects p WHERE p.organization_id=_organization_id AND p.id=_project_id;
 IF ctx IS NULL OR NOT public.foundation_can_write_context(_organization_id,ctx) THEN RAISE EXCEPTION 'Project access denied' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT p.id,coalesce(nullif(p.full_name,''),'Team member '||left(p.id::text,8)) FROM public.profiles p
 WHERE public.production_assignee_eligible(_organization_id,ctx,p.id) ORDER BY p.full_name,p.id;
END $$;
COMMIT;
