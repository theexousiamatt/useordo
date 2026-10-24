-- Legacy invitations remain workspace-scoped. A client membership is a portal
-- container; it NEVER grants access to unassigned agency projects.
ALTER TABLE public.workspace_invitations
 ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
 ADD COLUMN accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 ADD COLUMN renewal_requested_at timestamptz,
 ADD CONSTRAINT project_invitation_client_only CHECK (project_id IS NULL OR role='client');
ALTER TABLE public.workspace_members
 ADD COLUMN access_scope text NOT NULL DEFAULT 'workspace',
 ADD CONSTRAINT membership_access_scope CHECK (access_scope IN ('workspace','project'));
CREATE INDEX invitations_project_idx ON public.workspace_invitations(project_id) WHERE project_id IS NOT NULL;

-- Enforce same-workspace scope even for direct table writes from older clients.
CREATE FUNCTION public.validate_invitation_scope() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$ BEGIN
 IF NEW.project_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM public.projects WHERE id=NEW.project_id AND workspace_id=NEW.workspace_id
 ) THEN RAISE EXCEPTION 'Choose a project in this workspace'; END IF;
 IF TG_OP='UPDATE' AND (NEW.workspace_id<>OLD.workspace_id OR NEW.project_id IS DISTINCT FROM OLD.project_id
   OR NEW.email<>OLD.email OR NEW.role<>OLD.role OR NEW.token<>OLD.token) THEN
  RAISE EXCEPTION 'Invitation identity cannot be changed. Revoke it and send a new invitation.';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_invitation_scope BEFORE INSERT OR UPDATE ON public.workspace_invitations
 FOR EACH ROW EXECUTE FUNCTION public.validate_invitation_scope();

CREATE FUNCTION public.prepare_scoped_invitations(
 _workspace_id uuid, _emails text[], _role public.workspace_role, _project_id uuid DEFAULT NULL
) RETURNS TABLE(email text, invitation_id uuid, outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=auth.uid(); address text; pending public.workspace_invitations%ROWTYPE;
 existing_user uuid; existing_member public.workspace_members%ROWTYPE;
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=actor AND email_confirmed_at IS NOT NULL) THEN
  RAISE EXCEPTION 'A verified account is required'; END IF;
 IF public.can_manage_workspace(_workspace_id,actor) IS NOT TRUE THEN RAISE EXCEPTION 'Workspace access denied'; END IF;
 IF _role IS NULL OR _role='owner' THEN RAISE EXCEPTION 'Choose member, manager or client'; END IF;
 IF _project_id IS NOT NULL AND (_role<>'client' OR NOT EXISTS(
  SELECT 1 FROM public.projects WHERE id=_project_id AND workspace_id=_workspace_id AND archived_at IS NULL
 )) THEN RAISE EXCEPTION 'Choose an active project in this workspace for the client'; END IF;
 IF _emails IS NULL OR cardinality(_emails)<1 OR cardinality(_emails)>50 THEN RAISE EXCEPTION 'Invite between 1 and 50 people'; END IF;
 FOR address IN SELECT DISTINCT lower(trim(value)) FROM unnest(_emails) addresses(value) ORDER BY 1 LOOP
  IF address IS NULL OR length(address)>254 OR address !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
   RAISE EXCEPTION 'Enter valid email addresses'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_workspace_id::text||':'||address,0));
  SELECT u.id INTO existing_user FROM auth.users u WHERE lower(u.email)=address;
  SELECT * INTO existing_member FROM public.workspace_members m WHERE m.workspace_id=_workspace_id AND m.user_id=existing_user;
  IF FOUND AND existing_member.status<>'active' THEN RAISE EXCEPTION 'This account is inactive. Reactivate it from Team before inviting it.'; END IF;
  IF public.is_workspace_collaborator(_workspace_id,existing_user) OR
    (_project_id IS NOT NULL AND public.is_project_client(_project_id,existing_user)) OR
    (_project_id IS NULL AND existing_member.status='active' AND existing_member.access_scope='workspace') THEN
   RETURN QUERY SELECT address,NULL::uuid,'member'::text; CONTINUE;
  END IF;
  IF existing_member.status='active' AND existing_member.role<>_role THEN
   RAISE EXCEPTION 'This person has a different role. Manage their access from Team.'; END IF;
  SELECT i.* INTO pending FROM public.workspace_invitations i WHERE i.workspace_id=_workspace_id
    AND lower(trim(i.email))=address AND i.project_id IS NOT DISTINCT FROM _project_id
    AND i.status='pending' AND i.expires_at>now() ORDER BY i.created_at DESC LIMIT 1 FOR UPDATE;
  IF FOUND THEN
   IF pending.role<>_role THEN RAISE EXCEPTION 'An invitation with a different role already exists. Manage it from Team.'; END IF;
   RETURN QUERY SELECT address,pending.id,'pending'::text;
  ELSE
   INSERT INTO public.workspace_invitations(workspace_id,email,role,invited_by,project_id)
     VALUES(_workspace_id,address,_role,actor,_project_id) RETURNING * INTO pending;
   RETURN QUERY SELECT address,pending.id,'created'::text;
  END IF;
 END LOOP;
END $$;
-- Older onboarding and deployed clients use the same checked implementation.
CREATE OR REPLACE FUNCTION public.prepare_workspace_invitations(_workspace_id uuid,_emails text[],_role public.workspace_role)
 RETURNS TABLE(email text,invitation_id uuid,outcome text) LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT * FROM public.prepare_scoped_invitations(_workspace_id,_emails,_role,NULL);
$$;
REVOKE ALL ON FUNCTION public.prepare_scoped_invitations(uuid,text[],public.workspace_role,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prepare_scoped_invitations(uuid,text[],public.workspace_role,uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.accept_workspace_invitation(_token text,_user_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE inv public.workspace_invitations%ROWTYPE; address text; verified timestamptz; membership public.workspace_members%ROWTYPE;
BEGIN
 SELECT email,email_confirmed_at INTO address,verified FROM auth.users WHERE id=_user_id;
 IF address IS NULL OR verified IS NULL THEN RAISE EXCEPTION 'Verify your email before accepting an invitation'; END IF;
 SELECT * INTO inv FROM public.workspace_invitations WHERE token=_token FOR UPDATE;
 IF NOT FOUND OR lower(trim(inv.email))<>lower(trim(address)) THEN
  RAISE EXCEPTION 'Sign in with the email address this invitation was sent to'; END IF;
 -- Serialize invitations for the same person across different scopes.
 PERFORM pg_advisory_xact_lock(hashtextextended(inv.workspace_id::text||':'||lower(trim(address)),0));
 IF inv.status NOT IN ('pending','accepted') OR (inv.status='pending' AND inv.expires_at<=now()) THEN
  RAISE EXCEPTION 'Invitation is invalid or expired'; END IF;
 IF inv.role='owner' THEN RAISE EXCEPTION 'Ownership cannot be granted by invitation'; END IF;
 SELECT * INTO membership FROM public.workspace_members WHERE workspace_id=inv.workspace_id AND user_id=_user_id FOR UPDATE;
 IF FOUND AND membership.status<>'active' THEN RAISE EXCEPTION 'Your access was deactivated. Ask the agency to restore it.'; END IF;
 IF inv.status='accepted' THEN
  IF (inv.accepted_by IS NOT NULL AND inv.accepted_by<>_user_id) OR
   NOT public.is_workspace_member(inv.workspace_id,_user_id) OR
   (inv.project_id IS NOT NULL AND NOT public.can_view_project(inv.project_id,_user_id)) THEN
    RAISE EXCEPTION 'Your access has changed. Ask the agency for a new invitation'; END IF;
  RETURN inv.workspace_id;
 END IF;
 IF inv.project_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.projects WHERE id=inv.project_id AND workspace_id=inv.workspace_id AND archived_at IS NULL) THEN
  RAISE EXCEPTION 'This project is unavailable. Contact the agency'; END IF;
 INSERT INTO public.workspace_members(workspace_id,user_id,role,invited_by,status,access_scope)
 VALUES(inv.workspace_id,_user_id,inv.role,inv.invited_by,'active',CASE WHEN inv.project_id IS NULL THEN 'workspace' ELSE 'project' END)
 ON CONFLICT(workspace_id,user_id) DO UPDATE SET access_scope=CASE
  WHEN inv.project_id IS NULL THEN 'workspace' ELSE workspace_members.access_scope END;
 -- Never downgrade an existing internal role or broaden a project-only invite.
 IF inv.project_id IS NOT NULL THEN
  INSERT INTO public.project_members(project_id,workspace_id,user_id,role)
   VALUES(inv.project_id,inv.workspace_id,_user_id,'client') ON CONFLICT(project_id,user_id) DO NOTHING;
 END IF;
 UPDATE public.workspace_invitations SET status='accepted',accepted_at=now(),accepted_by=_user_id WHERE id=inv.id;
 RETURN inv.workspace_id;
END $$;
REVOKE ALL ON FUNCTION public.accept_workspace_invitation(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invitation(text,uuid) TO service_role;

-- Legacy client_id assignment remains valid; stale internal project roles cannot
-- turn an agency client into a contributor or project manager.
CREATE OR REPLACE FUNCTION public.has_project_role(_project_id uuid,_user_id uuid,_role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.project_members pm JOIN public.projects p ON p.id=pm.project_id
  WHERE pm.project_id=_project_id AND pm.workspace_id=p.workspace_id AND pm.user_id=_user_id AND pm.role=_role
  AND public.is_workspace_member(p.workspace_id,_user_id)
  AND (_role='client' OR public.get_workspace_role(p.workspace_id,_user_id)<>'client'));
$$;
CREATE OR REPLACE FUNCTION public.can_view_project(_project_id uuid,_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.projects p WHERE p.id=_project_id
  AND public.is_workspace_collaborator(p.workspace_id,_user_id))
  OR public.is_project_member(_project_id,_user_id) OR public.is_project_client(_project_id,_user_id);
$$;
CREATE OR REPLACE FUNCTION public.can_manage_project(_project_id uuid,_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.projects p WHERE p.id=_project_id
  AND public.is_workspace_member(p.workspace_id,_user_id)
  AND public.get_workspace_role(p.workspace_id,_user_id)<>'client'
  AND (p.owner_id=_user_id OR public.can_manage_workspace(p.workspace_id,_user_id)
    OR public.has_project_role(p.id,_user_id,'owner') OR public.has_project_role(p.id,_user_id,'manager')));
$$;

-- A client cannot enumerate the agency's other clients or internal activity.
DROP POLICY IF EXISTS "Members can view co-members" ON public.workspace_members;
CREATE POLICY "Members can view co-members" ON public.workspace_members FOR SELECT TO authenticated
 USING(user_id=auth.uid() OR public.is_workspace_collaborator(workspace_id,auth.uid()));
CREATE OR REPLACE FUNCTION public.shares_workspace_with(_profile_id uuid,_viewer uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.workspaces w WHERE public.is_workspace_member(w.id,_profile_id)
  AND public.is_workspace_collaborator(w.id,_viewer));
$$;

CREATE FUNCTION public.my_pending_invitations() RETURNS TABLE(token text,workspace_name text,project_name text,role public.workspace_role)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT i.token,w.name,p.name,i.role FROM public.workspace_invitations i
 JOIN auth.users u ON lower(trim(u.email))=lower(trim(i.email)) AND u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL
 JOIN public.workspaces w ON w.id=i.workspace_id LEFT JOIN public.projects p ON p.id=i.project_id
 WHERE i.status='pending' AND i.expires_at>now() ORDER BY i.created_at DESC LIMIT 50;
$$;
REVOKE ALL ON FUNCTION public.my_pending_invitations() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.my_pending_invitations() TO authenticated,service_role;

-- Expired-link recovery requests notify the agency in-app. They do not renew
-- access automatically or send an unverified email. Token-bound, hourly dedup.
CREATE FUNCTION public.request_invitation_renewal(_token text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE inv public.workspace_invitations%ROWTYPE; recipient uuid;
BEGIN
 SELECT * INTO inv FROM public.workspace_invitations WHERE token=_token FOR UPDATE;
 IF NOT FOUND OR inv.status<>'pending' OR inv.expires_at>now() THEN RETURN false; END IF;
 IF inv.renewal_requested_at>now()-interval '1 hour' THEN RETURN true; END IF;
 SELECT CASE WHEN public.can_manage_workspace(inv.workspace_id,inv.invited_by) THEN inv.invited_by ELSE w.owner_id END INTO recipient FROM public.workspaces w WHERE w.id=inv.workspace_id;
 IF recipient IS NULL THEN RETURN false; END IF;
 INSERT INTO public.notifications(user_id,workspace_id,type,title,body,url,entity_type,entity_id)
 VALUES(recipient,inv.workspace_id,'invitation_renewal','A new invitation was requested',
  inv.email||' requested a new invitation link. Review and resend it from Team.','/team','invitation',inv.id);
 UPDATE public.workspace_invitations SET renewal_requested_at=now() WHERE id=inv.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.request_invitation_renewal(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.request_invitation_renewal(text) TO service_role;

DROP POLICY IF EXISTS "Create projects" ON public.projects;
CREATE POLICY "Create projects" ON public.projects FOR INSERT TO authenticated
 WITH CHECK(public.is_workspace_collaborator(workspace_id,auth.uid()));
DROP POLICY IF EXISTS "Members can view activity" ON public.activity_logs;
CREATE POLICY "Members can view activity" ON public.activity_logs FOR SELECT TO authenticated
 USING(public.is_workspace_collaborator(workspace_id,auth.uid()));
DROP POLICY IF EXISTS "Members can insert activity" ON public.activity_logs;
CREATE POLICY "Members can insert activity" ON public.activity_logs FOR INSERT TO authenticated
 WITH CHECK(actor_id=auth.uid() AND public.is_workspace_collaborator(workspace_id,auth.uid()));

-- Clients read shared assets; upload/replacement/deletion remains agency work.
DROP POLICY IF EXISTS "Project members can view files" ON public.files;
DROP POLICY IF EXISTS "Project members can upload files" ON public.files;
DROP POLICY IF EXISTS "Admins delete files" ON public.files;
DROP POLICY IF EXISTS "Uploaders can delete their own files" ON public.files;
CREATE POLICY "Project members can view files" ON public.files FOR SELECT TO authenticated
 USING(public.can_view_project(project_id,auth.uid()));
CREATE POLICY "Project members can upload files" ON public.files FOR INSERT TO authenticated
 WITH CHECK(public.can_contribute_project(project_id,auth.uid()) AND EXISTS(
  SELECT 1 FROM public.projects p WHERE p.id=files.project_id AND p.workspace_id=files.workspace_id));
CREATE POLICY "Agency collaborators delete files" ON public.files FOR DELETE TO authenticated
 USING(public.can_contribute_project(project_id,auth.uid()));
DROP POLICY IF EXISTS "Project members can view files" ON storage.objects;
DROP POLICY IF EXISTS "Project members can read files" ON storage.objects;
DROP POLICY IF EXISTS "Project members read project files" ON storage.objects;
DROP POLICY IF EXISTS "Project members upload project files" ON storage.objects;
DROP POLICY IF EXISTS "Project members update project files" ON storage.objects;
DROP POLICY IF EXISTS "Project members delete project files" ON storage.objects;
DROP POLICY IF EXISTS "Project members can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Project members can update project files" ON storage.objects;
DROP POLICY IF EXISTS "Project members can delete project files" ON storage.objects;
CREATE POLICY "Project members can view files" ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='project-files' AND public.can_view_project((storage.foldername(name))[1]::uuid,auth.uid()));
CREATE POLICY "Project members can upload files" ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='project-files' AND public.can_contribute_project((storage.foldername(name))[1]::uuid,auth.uid()));
CREATE POLICY "Project members can update project files" ON storage.objects FOR UPDATE TO authenticated
 USING(bucket_id='project-files' AND public.can_contribute_project((storage.foldername(name))[1]::uuid,auth.uid()))
 WITH CHECK(bucket_id='project-files' AND public.can_contribute_project((storage.foldername(name))[1]::uuid,auth.uid()));
CREATE POLICY "Project members can delete project files" ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='project-files' AND public.can_contribute_project((storage.foldername(name))[1]::uuid,auth.uid()));
DROP POLICY IF EXISTS "Manage files" ON public.project_files;
CREATE POLICY "Manage files" ON public.project_files FOR ALL TO authenticated
 USING(public.can_contribute_project(project_id,auth.uid()))
 WITH CHECK(public.can_contribute_project(project_id,auth.uid()) AND EXISTS(
  SELECT 1 FROM public.projects p WHERE p.id=project_files.project_id AND p.workspace_id=project_files.workspace_id));
-- Raw activity payloads are internal; clients see the dedicated review/milestone UI.
DROP POLICY IF EXISTS "View activity" ON public.project_activity;
CREATE POLICY "View activity" ON public.project_activity FOR SELECT TO authenticated
 USING(public.can_contribute_project(project_id,auth.uid()));

DROP POLICY IF EXISTS "Delete projects" ON public.projects;
CREATE POLICY "Delete projects" ON public.projects FOR DELETE TO authenticated
 USING(public.get_workspace_role(workspace_id,auth.uid())<>'client' AND public.is_workspace_member(workspace_id,auth.uid())
 AND (owner_id=auth.uid() OR public.has_workspace_role(workspace_id,auth.uid(),'owner')));
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
  IF public.get_workspace_role(v_ws,v_uid)='client' OR NOT public.is_workspace_member(v_ws,v_uid) OR
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
