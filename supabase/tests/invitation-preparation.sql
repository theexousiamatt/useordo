-- Requires access-contract and prepare-invitations migrations; caller wraps BEGIN/ROLLBACK.
INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES
 ('81000000-0000-4000-8000-000000000001','ordo-invite-owner@example.invalid',now(),'{}'),
 ('81000000-0000-4000-8000-000000000002','ordo-invite-outsider@example.invalid',now(),'{}');
INSERT INTO public.workspaces(id,name,slug,type,owner_id) VALUES
 ('82000000-0000-4000-8000-000000000001','Invitation rollback fixture','ordo-invitation-rollback-fixture','agency','81000000-0000-4000-8000-000000000001');
INSERT INTO public.workspace_members(workspace_id,user_id,role,status) VALUES
 ('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002','member','inactive');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true),set_config('request.jwt.claim.role','authenticated',true);
DO $$ DECLARE first_id uuid; retry_id uuid; result record; denied boolean:=false; BEGIN
 SELECT invitation_id INTO first_id FROM public.prepare_workspace_invitations('82000000-0000-4000-8000-000000000001',ARRAY['  recipient@example.invalid ','RECIPIENT@example.invalid'],'client');
 IF first_id IS NULL THEN RAISE EXCEPTION 'Invitation was not created'; END IF;
 SELECT invitation_id INTO retry_id FROM public.prepare_workspace_invitations('82000000-0000-4000-8000-000000000001',ARRAY['recipient@example.invalid'],'client');
 IF retry_id IS DISTINCT FROM first_id THEN RAISE EXCEPTION 'Retry did not reuse invitation'; END IF;
 IF (SELECT count(*) FROM public.workspace_invitations WHERE workspace_id='82000000-0000-4000-8000-000000000001')<>1 THEN RAISE EXCEPTION 'Duplicate invitations created'; END IF;
 SELECT * INTO result FROM public.prepare_workspace_invitations('82000000-0000-4000-8000-000000000001',ARRAY['ordo-invite-owner@example.invalid'],'member');
 IF result.outcome<>'member' OR result.invitation_id IS NOT NULL THEN RAISE EXCEPTION 'Existing member was invited'; END IF;
 BEGIN PERFORM public.prepare_workspace_invitations('82000000-0000-4000-8000-000000000001',ARRAY['recipient@example.invalid'],'manager');
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'An invitation with a different role%' THEN denied:=true; ELSE RAISE; END IF;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Pending invitation role changed silently'; END IF;
 denied:=false;
 BEGIN PERFORM public.prepare_workspace_invitations('82000000-0000-4000-8000-000000000001',ARRAY['ordo-invite-outsider@example.invalid'],'member');
 EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'This account is inactive.%' THEN denied:=true; ELSE RAISE; END IF; END;
 IF NOT denied THEN RAISE EXCEPTION 'Inactive member was sent an unusable invitation'; END IF;
 denied:=false;
 BEGIN PERFORM public.prepare_workspace_invitations('82000000-0000-4000-8000-000000000001',ARRAY['another@example.invalid','zz-invalid'],'member');
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Enter valid email addresses' THEN denied:=true; ELSE RAISE; END IF; END;
 IF NOT denied THEN RAISE EXCEPTION 'Invalid email accepted'; END IF;
 IF (SELECT count(*) FROM public.workspace_invitations WHERE workspace_id='82000000-0000-4000-8000-000000000001')<>1 THEN RAISE EXCEPTION 'Failed batch was not atomic'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000002',true);
DO $$ DECLARE denied boolean:=false; BEGIN
 BEGIN PERFORM public.prepare_workspace_invitations('82000000-0000-4000-8000-000000000001',ARRAY['recipient@example.invalid'],'client');
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Workspace access denied' THEN denied:=true; ELSE RAISE; END IF; END;
 IF NOT denied THEN RAISE EXCEPTION 'Outsider prepared invitations'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF has_function_privilege('anon','public.prepare_workspace_invitations(uuid,text[],public.workspace_role)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous invitation execution allowed'; END IF;
END $$;
SELECT 'invitation preparation checks passed; rollback required' AS verification;
