-- Run in a rollback transaction against a migrated isolated database.
INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES
 ('91000000-0000-4000-8000-000000000001','scope-owner@example.invalid',now(),'{}'),
 ('91000000-0000-4000-8000-000000000002','scope-client@example.invalid',now(),'{}'),
 ('91000000-0000-4000-8000-000000000003','scope-other@example.invalid',now(),'{}');
INSERT INTO public.workspaces(id,name,slug,type,owner_id) VALUES
 ('92000000-0000-4000-8000-000000000001','Agency one','scope-agency-one','agency','91000000-0000-4000-8000-000000000001'),
 ('92000000-0000-4000-8000-000000000002','Agency two','scope-agency-two','agency','91000000-0000-4000-8000-000000000003');
INSERT INTO public.projects(id,workspace_id,name,owner_id) VALUES
 ('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','Invited project','91000000-0000-4000-8000-000000000001'),
 ('93000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001','Another client project','91000000-0000-4000-8000-000000000001'),
 ('93000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000002','Other agency project','91000000-0000-4000-8000-000000000003');
INSERT INTO public.files(project_id,workspace_id,name,storage_path) VALUES
 ('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','Shared.pdf','93000000-0000-4000-8000-000000000001/shared.pdf'),
 ('93000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001','Private.pdf','93000000-0000-4000-8000-000000000002/private.pdf');
INSERT INTO public.deliverables(project_id,workspace_id,title,status) VALUES
 ('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','Shared review','submitted'),
 ('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','Agency draft','draft'),
 ('93000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001','Another client review','submitted');
INSERT INTO public.tasks(project_id,workspace_id,title) VALUES
 ('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','Internal task');
INSERT INTO storage.objects(bucket_id,name) VALUES
 ('project-files','93000000-0000-4000-8000-000000000001/shared.pdf'),
 ('project-files','93000000-0000-4000-8000-000000000002/private.pdf');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true),set_config('request.jwt.claim.role','authenticated',true);
DO $$ DECLARE first_id uuid; retry_id uuid; denied boolean:=false; BEGIN
 SELECT invitation_id INTO first_id FROM public.prepare_scoped_invitations('92000000-0000-4000-8000-000000000001',ARRAY[' SCOPE-CLIENT@example.invalid ','scope-client@example.invalid'],'client','93000000-0000-4000-8000-000000000001');
 SELECT invitation_id INTO retry_id FROM public.prepare_scoped_invitations('92000000-0000-4000-8000-000000000001',ARRAY['scope-client@example.invalid'],'client','93000000-0000-4000-8000-000000000001');
 IF first_id IS NULL OR first_id<>retry_id THEN RAISE EXCEPTION 'Scoped deduplication failed'; END IF;
 BEGIN PERFORM public.prepare_scoped_invitations('92000000-0000-4000-8000-000000000001',ARRAY['scope-client@example.invalid'],'client','93000000-0000-4000-8000-000000000003');
 EXCEPTION WHEN raise_exception THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Cross agency invitation accepted'; END IF;
 denied:=false;
 BEGIN PERFORM public.prepare_scoped_invitations('92000000-0000-4000-8000-000000000001',ARRAY['scope-client@example.invalid'],'manager','93000000-0000-4000-8000-000000000001');
 EXCEPTION WHEN raise_exception THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Project invitation granted internal role'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.role','service_role',true),set_config('request.jwt.claim.sub','',true);
DO $$ DECLARE t text; denied boolean:=false; BEGIN
 SELECT token INTO t FROM public.workspace_invitations WHERE email='scope-client@example.invalid';
 BEGIN PERFORM public.accept_workspace_invitation(t,'91000000-0000-4000-8000-000000000003');
 EXCEPTION WHEN raise_exception THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Wrong email accepted invitation'; END IF;
 PERFORM public.accept_workspace_invitation(t,'91000000-0000-4000-8000-000000000002');
 PERFORM public.accept_workspace_invitation(t,'91000000-0000-4000-8000-000000000002');
 IF NOT public.can_view_project('93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002') OR
  public.can_view_project('93000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002') OR
  public.can_view_project('93000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000002') THEN
   RAISE EXCEPTION 'Project scope not enforced'; END IF;
 IF (SELECT access_scope FROM public.workspace_members WHERE user_id='91000000-0000-4000-8000-000000000002')<>'project' THEN RAISE EXCEPTION 'Project access broadened'; END IF;
 IF public.can_contribute_project('93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Client can contribute'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000002',true),set_config('request.jwt.claim.role','authenticated',true);
DO $$ DECLARE denied boolean:=false; BEGIN
 IF (SELECT count(*) FROM public.deliverables)<>1 THEN RAISE EXCEPTION 'Client sees draft or unrelated deliverables'; END IF;
 IF (SELECT count(*) FROM public.tasks)<>0 THEN RAISE EXCEPTION 'Client sees internal tasks'; END IF;
 IF (SELECT count(*) FROM public.files)<>1 THEN RAISE EXCEPTION 'File metadata scope leaked'; END IF;
 IF (SELECT count(*) FROM storage.objects)<>1 THEN RAISE EXCEPTION 'Storage scope leaked'; END IF;
 DELETE FROM storage.objects;
 IF (SELECT count(*) FROM storage.objects)<>1 THEN RAISE EXCEPTION 'Client deleted shared storage'; END IF;
 DELETE FROM public.files;
 IF (SELECT count(*) FROM public.files)<>1 THEN RAISE EXCEPTION 'Client deleted shared files'; END IF;
 IF (SELECT count(*) FROM public.projects)<>1 THEN RAISE EXCEPTION 'Project RLS leaked another project'; END IF;
 IF (SELECT count(*) FROM public.workspace_members)<>1 THEN RAISE EXCEPTION 'Client can enumerate agency members'; END IF;
 BEGIN INSERT INTO public.projects(workspace_id,name) VALUES('92000000-0000-4000-8000-000000000001','Unauthorized');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Client created agency project'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
SELECT * FROM public.prepare_scoped_invitations('92000000-0000-4000-8000-000000000001',ARRAY['scope-client@example.invalid'],'client',NULL);
RESET ROLE;
SELECT set_config('request.jwt.claim.role','service_role',true),set_config('request.jwt.claim.sub','',true);
DO $$ DECLARE t text; denied boolean:=false; BEGIN
 SELECT token INTO t FROM public.workspace_invitations WHERE email='scope-client@example.invalid' AND project_id IS NULL;
 PERFORM public.accept_workspace_invitation(t,'91000000-0000-4000-8000-000000000002');
 IF (SELECT access_scope FROM public.workspace_members WHERE user_id='91000000-0000-4000-8000-000000000002')<>'workspace' THEN RAISE EXCEPTION 'Explicit workspace invitation not upgraded'; END IF;
 IF public.can_view_project('93000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Workspace invitation exposed unshared project'; END IF;
 UPDATE public.workspace_members SET status='inactive' WHERE user_id='91000000-0000-4000-8000-000000000002';
 BEGIN PERFORM public.accept_workspace_invitation(t,'91000000-0000-4000-8000-000000000002');
 EXCEPTION WHEN raise_exception THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Accepted invitation reactivated revoked access'; END IF;
 UPDATE public.workspace_members SET status='active' WHERE user_id='91000000-0000-4000-8000-000000000002';
 -- Renewal only notifies, deduplicates, and never extends access.
 INSERT INTO public.workspace_invitations(workspace_id,email,role,expires_at) VALUES
 ('92000000-0000-4000-8000-000000000001','scope-other@example.invalid','client',now()-interval '1 day') RETURNING token INTO t;
 IF NOT public.request_invitation_renewal(t) OR NOT public.request_invitation_renewal(t) THEN RAISE EXCEPTION 'Renewal request failed'; END IF;
 IF (SELECT count(*) FROM public.notifications WHERE entity_id=(SELECT id FROM public.workspace_invitations WHERE token=t))<>1 THEN RAISE EXCEPTION 'Renewal notification duplicated'; END IF;
 IF (SELECT expires_at FROM public.workspace_invitations WHERE token=t)>now() THEN RAISE EXCEPTION 'Renewal extended access without approval'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000002',true),set_config('request.jwt.claim.role','authenticated',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.my_pending_invitations()) THEN RAISE EXCEPTION 'Invitation inbox leaked another email'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF has_function_privilege('anon','public.prepare_scoped_invitations(uuid,text[],public.workspace_role,uuid)','EXECUTE') OR
 has_function_privilege('authenticated','public.accept_workspace_invitation(text,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Unsafe function permissions'; END IF;
END $$;
SELECT 'scoped invitation and project isolation checks passed; rollback required' AS verification;
