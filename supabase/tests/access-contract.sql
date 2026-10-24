-- Run inside a transaction with the migration already applied; caller must ROLLBACK.
-- Only synthetic reserved UUIDs are inserted; no emails or storage objects are created.
INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES
 ('91000000-0000-4000-8000-000000000001','ordo-security-owner@example.invalid',now(),'{}'),
 ('91000000-0000-4000-8000-000000000002','ordo-security-member@example.invalid',now(),'{}'),
 ('91000000-0000-4000-8000-000000000003','ordo-security-client@example.invalid',now(),'{}'),
 ('91000000-0000-4000-8000-000000000004','ordo-security-outsider@example.invalid',now(),'{}');
INSERT INTO public.workspaces(id,name,slug,type,owner_id) VALUES
 ('92000000-0000-4000-8000-000000000001','Security rollback fixture','ordo-security-rollback-fixture','agency','91000000-0000-4000-8000-000000000001');
INSERT INTO public.workspace_members(workspace_id,user_id,role,status) VALUES
 ('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','owner','active'),
 ('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','member','active'),
 ('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000003','client','active');
INSERT INTO public.projects(id,workspace_id,name,owner_id,client_id,status) VALUES
 ('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','Revocation fixture','91000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000003','active'),
 ('93000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001','Nullable owner fixture',NULL,NULL,'active');
INSERT INTO public.project_members(project_id,workspace_id,user_id,role) VALUES
 ('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','owner'),
 ('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000003','client');
INSERT INTO public.files(project_id,workspace_id,name,storage_path,uploaded_by) VALUES
 ('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','rollback.txt','93000000-0000-4000-8000-000000000001/rollback.txt','91000000-0000-4000-8000-000000000001');
DO $$ BEGIN
 IF has_function_privilege('anon','public.delete_project(uuid)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous deletion grant remains'; END IF;
 IF NOT has_function_privilege('authenticated','public.is_project_member(uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Member helper grant missing'; END IF;
 IF NOT has_function_privilege('authenticated','public.has_role(uuid,public.app_role)','EXECUTE') THEN RAISE EXCEPTION 'Role helper grant missing'; END IF;
END $$;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claim.role','anon',true);
DO $$ BEGIN
 BEGIN
  PERFORM public.delete_project('93000000-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'Anonymous deletion succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
-- Test the function's own guard as a privileged caller with no user identity.
DO $$ DECLARE denied boolean:=false; BEGIN
 BEGIN PERFORM public.delete_project('93000000-0000-4000-8000-000000000001');
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='Authentication required' THEN denied:=true; ELSE RAISE; END IF;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Null caller was not rejected'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000004',true),set_config('request.jwt.claim.role','authenticated',true);
DO $$ DECLARE denied boolean:=false; BEGIN
 BEGIN PERFORM public.delete_project('93000000-0000-4000-8000-000000000002');
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='Only the project owner can delete this project' THEN denied:=true; ELSE RAISE; END IF;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Null-owner project deletion was not rejected'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.files WHERE project_id='93000000-0000-4000-8000-000000000001')<>1 THEN RAISE EXCEPTION 'Owner file read failed'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000003',true);
DO $$ BEGIN
 IF NOT public.is_project_client('93000000-0000-4000-8000-000000000001',auth.uid()) THEN RAISE EXCEPTION 'Active client denied'; END IF;
 IF (SELECT count(*) FROM public.files WHERE project_id='93000000-0000-4000-8000-000000000001')<>1 THEN RAISE EXCEPTION 'Assigned client file read failed'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000002',true);
DO $$ DECLARE result jsonb; BEGIN
 BEGIN
  result:=public.delete_project('93000000-0000-4000-8000-000000000001');
  IF (result->>'deleted')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'Active project owner deletion failed'; END IF;
  RAISE EXCEPTION 'restore_synthetic_fixture';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'restore_synthetic_fixture' THEN RAISE; END IF;
 END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claim.role','service_role',true);
UPDATE public.workspace_members SET status='inactive' WHERE workspace_id='92000000-0000-4000-8000-000000000001' AND role IN ('client','member');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000003',true),set_config('request.jwt.claim.role','authenticated',true);
DO $$ BEGIN
 IF public.is_project_client('93000000-0000-4000-8000-000000000001',auth.uid()) THEN RAISE EXCEPTION 'Inactive client helper access remains'; END IF;
 IF (SELECT count(*) FROM public.projects WHERE id='93000000-0000-4000-8000-000000000001')<>0 THEN RAISE EXCEPTION 'Inactive client sees project'; END IF;
 IF (SELECT count(*) FROM public.files WHERE project_id='93000000-0000-4000-8000-000000000001')<>0 THEN RAISE EXCEPTION 'Inactive client sees files'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000002',true);
DO $$ DECLARE denied boolean:=false; BEGIN
 IF public.can_contribute_project('93000000-0000-4000-8000-000000000001',auth.uid()) THEN RAISE EXCEPTION 'Inactive project owner contribution remains'; END IF;
 IF public.can_manage_project('93000000-0000-4000-8000-000000000001',auth.uid()) THEN RAISE EXCEPTION 'Inactive project owner management remains'; END IF;
 BEGIN PERFORM public.delete_project('93000000-0000-4000-8000-000000000001');
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='Only the project owner can delete this project' THEN denied:=true; ELSE RAISE; END IF;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Inactive project owner deletion succeeded'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claim.role','service_role',true);
DELETE FROM public.workspace_members WHERE workspace_id='92000000-0000-4000-8000-000000000001' AND role IN ('client','member');
DO $$ BEGIN
 IF public.is_project_member('93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Removed member retains project access'; END IF;
 IF public.is_project_client('93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000003') THEN RAISE EXCEPTION 'Removed client retains access'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true),set_config('request.jwt.claim.role','authenticated',true);
DO $$ DECLARE result jsonb; BEGIN
 result:=public.delete_project('93000000-0000-4000-8000-000000000002');
 IF (result->>'deleted')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'Workspace owner deletion failed'; END IF;
END $$;
RESET ROLE;
SELECT 'access contract checks passed; rollback required' AS verification;
