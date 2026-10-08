-- All fixtures and changes are rolled back. No emails or real accounts are created.
BEGIN;
INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data)
VALUES
 ('10000000-0000-4000-8000-000000000001','ordo-audit-owner@example.invalid',now(),'{}'),
 ('10000000-0000-4000-8000-000000000002','ordo-audit-a@example.invalid',now(),'{}'),
 ('10000000-0000-4000-8000-000000000003','ordo-audit-b@example.invalid',now(),'{}');
INSERT INTO public.workspaces(id,name,slug,type,owner_id) VALUES
 ('20000000-0000-4000-8000-000000000001','Audit workspace','ordo-audit-rollback','agency','10000000-0000-4000-8000-000000000001');
INSERT INTO public.workspace_members(workspace_id,user_id,role) VALUES
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner'),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','client'),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','client');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
INSERT INTO public.projects(id,workspace_id,name,owner_id,status) VALUES
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Client A project','10000000-0000-4000-8000-000000000001','active'),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Client B project','10000000-0000-4000-8000-000000000001','active') RETURNING id;
INSERT INTO public.activity(workspace_id,project_id,actor_id,type,payload) VALUES
 ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','task_created','{"title":"Private task"}');
DO $$ BEGIN
 IF (SELECT count(*) FROM public.activity)<>1 THEN RAISE EXCEPTION 'Owner activity read failed'; END IF;
END $$;
RESET ROLE;
INSERT INTO public.project_members(project_id,workspace_id,user_id,role) VALUES
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','client'),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','client');
INSERT INTO public.tasks(project_id,workspace_id,title,status) VALUES
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Private task','todo');
INSERT INTO public.deliverables(id,project_id,workspace_id,title,status,requires_approval) VALUES
 ('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','A review','submitted',true),
 ('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','B review','submitted',true),
 ('40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Unshared draft','draft',true);
INSERT INTO public.workspace_invitations(workspace_id,email,role,token) VALUES
 ('20000000-0000-4000-8000-000000000001','ordo-audit-a@example.invalid','client','ordo-audit-token');
DO $$ DECLARE blocked boolean:=false; BEGIN
 BEGIN
  PERFORM public.accept_workspace_invitation('ordo-audit-token','10000000-0000-4000-8000-000000000003');
 EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Wrong-email invitation acceptance succeeded'; END IF;
 PERFORM public.accept_workspace_invitation('ordo-audit-token','10000000-0000-4000-8000-000000000002');
 blocked:=false;
 BEGIN
  PERFORM public.accept_workspace_invitation('ordo-audit-token','10000000-0000-4000-8000-000000000002');
 EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Invitation replay succeeded'; END IF;
END $$;
DO $$ DECLARE claim jsonb; BEGIN
 claim:=public.claim_smtp_delivery('test-mail-event','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','test@example.invalid','workspace-invitation');
 IF claim->>'state'<>'claimed' THEN RAISE EXCEPTION 'SMTP claim failed'; END IF;
 claim:=public.claim_smtp_delivery('test-mail-event','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','test@example.invalid','workspace-invitation');
 IF claim->>'state'<>'busy' THEN RAISE EXCEPTION 'Concurrent email deduplication failed'; END IF;
 UPDATE public.smtp_deliveries SET status='sent' WHERE event_key='test-mail-event';
 claim:=public.claim_smtp_delivery('test-mail-event','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','test@example.invalid','workspace-invitation');
 IF claim->>'state'<>'sent' THEN RAISE EXCEPTION 'Sent email deduplication failed'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
DO $$ DECLARE blocked boolean:=false; BEGIN
 IF (SELECT count(*) FROM public.projects)<>1 THEN RAISE EXCEPTION 'Client project isolation failed'; END IF;
 IF (SELECT count(*) FROM public.activity)<>0 THEN RAISE EXCEPTION 'Internal activity visible to client'; END IF;
 IF (SELECT count(*) FROM public.tasks)<>0 THEN RAISE EXCEPTION 'Internal tasks visible to client'; END IF;
 IF (SELECT count(*) FROM public.deliverables)<>1 THEN RAISE EXCEPTION 'Client sees draft or another client deliverable'; END IF;
 BEGIN
  PERFORM public.review_deliverable('40000000-0000-4000-8000-000000000002','approved');
 EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Other client review succeeded'; END IF;
 PERFORM public.review_deliverable('40000000-0000-4000-8000-000000000001','approved');
 IF (SELECT count(*) FROM public.deliverable_reviews)<>1 THEN RAISE EXCEPTION 'Review audit record missing'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.review_deliverable('40000000-0000-4000-8000-000000000001','rejected');
 EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Duplicate decision succeeded'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: client isolation, hidden tasks/drafts, authorized reviews, review replay, email-bound invite, invite replay and SMTP deduplication' AS result;
