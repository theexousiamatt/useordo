-- Fail closed on anonymous callers and revoke project access with workspace membership.
-- Workspace owners retain access even when the redundant membership row is absent.
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT _user_id IS NOT NULL AND (
   EXISTS(SELECT 1 FROM public.workspaces WHERE id=_workspace_id AND owner_id=_user_id)
   OR EXISTS(SELECT 1 FROM public.workspace_members WHERE workspace_id=_workspace_id
     AND user_id=_user_id AND status='active'));
$$;
CREATE OR REPLACE FUNCTION public.has_workspace_role(_workspace_id uuid, _user_id uuid, _role public.workspace_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT _user_id IS NOT NULL AND (
   (_role='owner' AND EXISTS(SELECT 1 FROM public.workspaces WHERE id=_workspace_id AND owner_id=_user_id))
   OR EXISTS(SELECT 1 FROM public.workspace_members WHERE workspace_id=_workspace_id
     AND user_id=_user_id AND role=_role AND status='active'));
$$;
CREATE OR REPLACE FUNCTION public.get_workspace_role(_workspace_id uuid, _user_id uuid)
RETURNS public.workspace_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN EXISTS(SELECT 1 FROM public.workspaces WHERE id=_workspace_id AND owner_id=_user_id)
 THEN 'owner'::public.workspace_role ELSE
 (SELECT role FROM public.workspace_members WHERE workspace_id=_workspace_id AND user_id=_user_id AND status='active' LIMIT 1) END;
$$;
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.projects p WHERE p.id=_project_id
   AND public.is_workspace_member(p.workspace_id,_user_id)
   AND (p.owner_id=_user_id
     OR EXISTS(SELECT 1 FROM public.workspaces WHERE id=p.workspace_id AND owner_id=_user_id)
     OR EXISTS(SELECT 1 FROM public.project_members pm WHERE pm.project_id=p.id AND pm.workspace_id=p.workspace_id AND pm.user_id=_user_id)));
$$;
CREATE OR REPLACE FUNCTION public.has_project_role(_project_id uuid, _user_id uuid, _role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.project_members pm JOIN public.projects p ON p.id=pm.project_id
   WHERE pm.project_id=_project_id AND pm.workspace_id=p.workspace_id AND pm.user_id=_user_id AND pm.role=_role
   AND public.is_workspace_member(p.workspace_id,_user_id));
$$;
CREATE OR REPLACE FUNCTION public.is_project_client(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.projects p WHERE p.id=_project_id
   AND public.is_workspace_member(p.workspace_id,_user_id)
   AND (p.client_id=_user_id OR public.has_project_role(p.id,_user_id,'client')));
$$;
CREATE OR REPLACE FUNCTION public.can_manage_project(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.projects p WHERE p.id=_project_id
   AND public.is_workspace_member(p.workspace_id,_user_id)
   AND (p.owner_id=_user_id OR public.can_manage_workspace(p.workspace_id,_user_id)
     OR public.has_project_role(p.id,_user_id,'owner') OR public.has_project_role(p.id,_user_id,'manager')));
$$;
CREATE OR REPLACE FUNCTION public.shares_workspace_with(_profile_id uuid, _viewer uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.workspaces w
   WHERE public.is_workspace_member(w.id,_viewer) AND public.is_workspace_member(w.id,_profile_id));
$$;

-- Direct owner comparisons must not bypass revocation through an old project row.
DROP POLICY IF EXISTS "Delete projects" ON public.projects;
CREATE POLICY "Delete projects" ON public.projects FOR DELETE TO authenticated
 USING(public.is_workspace_member(workspace_id,auth.uid()) AND
   (owner_id=auth.uid() OR public.has_workspace_role(workspace_id,auth.uid(),'owner')));
DROP POLICY IF EXISTS "Delete tasks" ON public.tasks;
CREATE POLICY "Delete tasks" ON public.tasks FOR DELETE TO authenticated
 USING(public.can_contribute_project(project_id,auth.uid()) AND
   (public.has_project_role(project_id,auth.uid(),'owner') OR public.has_workspace_role(workspace_id,auth.uid(),'owner')
     OR EXISTS(SELECT 1 FROM public.projects p WHERE p.id=tasks.project_id AND p.owner_id=auth.uid())));
DROP POLICY IF EXISTS "Manage project members" ON public.project_members;
CREATE POLICY "Manage project members" ON public.project_members FOR ALL TO authenticated
 USING(public.can_manage_project(project_id,auth.uid()))
 WITH CHECK(public.can_manage_project(project_id,auth.uid())
   AND EXISTS(SELECT 1 FROM public.projects p WHERE p.id=project_members.project_id AND p.workspace_id=project_members.workspace_id)
   AND public.is_workspace_member(workspace_id,user_id));

-- Policies execute as the requesting role. Grant only reviewed boolean/role guards,
-- never all SECURITY DEFINER functions. Anonymous users cannot call these helpers.
DO $$ DECLARE fn regprocedure; BEGIN
 FOREACH fn IN ARRAY ARRAY[
   'public.is_workspace_member(uuid,uuid)'::regprocedure,
   'public.has_workspace_role(uuid,uuid,public.workspace_role)'::regprocedure,
   'public.get_workspace_role(uuid,uuid)'::regprocedure,
   'public.is_project_member(uuid,uuid)'::regprocedure,
   'public.has_project_role(uuid,uuid,text)'::regprocedure,
   'public.is_project_client(uuid,uuid)'::regprocedure,
   'public.can_manage_project(uuid,uuid)'::regprocedure,
   'public.can_view_project(uuid,uuid)'::regprocedure,
   'public.can_contribute_project(uuid,uuid)'::regprocedure,
   'public.is_workspace_collaborator(uuid,uuid)'::regprocedure,
   'public.can_manage_workspace(uuid,uuid)'::regprocedure,
   'public.shares_workspace_with(uuid,uuid)'::regprocedure,
   'public.has_role(uuid,public.app_role)'::regprocedure
 ] LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon',fn);
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role',fn);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.delete_project(_project_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ws uuid;
  v_owner uuid;
  v_report jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT workspace_id, owner_id INTO v_ws, v_owner FROM public.projects WHERE id = _project_id;
  IF v_ws IS NULL THEN
    RAISE EXCEPTION 'Project not found';
  END IF;
  IF NOT public.is_workspace_member(v_ws,v_uid) OR
    (v_owner = v_uid OR EXISTS (SELECT 1 FROM public.workspaces WHERE id = v_ws AND owner_id = v_uid)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Only the project owner can delete this project';
  END IF;

  SELECT jsonb_build_object(
    'tasks',        (SELECT count(*) FROM public.tasks WHERE project_id = _project_id),
    'milestones',   (SELECT count(*) FROM public.milestones WHERE project_id = _project_id),
    'deliverables', (SELECT count(*) FROM public.deliverables WHERE project_id = _project_id),
    'members',      (SELECT count(*) FROM public.project_members WHERE project_id = _project_id),
    'comments',     (SELECT count(*) FROM public.project_comments WHERE project_id = _project_id),
    'files',        (SELECT count(*) FROM public.project_files WHERE project_id = _project_id)
                    + (SELECT count(*) FROM public.files WHERE project_id = _project_id),
    'activity',     (SELECT count(*) FROM public.project_activity WHERE project_id = _project_id)
                    + (SELECT count(*) FROM public.activity WHERE project_id = _project_id)
  ) INTO v_report;

  DELETE FROM public.projects WHERE id = _project_id;

  RETURN jsonb_build_object('project_id', _project_id, 'deleted', true, 'records', v_report);
END;
$$;


REVOKE ALL ON FUNCTION public.delete_project(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_project(uuid) TO authenticated, service_role;
