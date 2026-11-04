INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('81000000-0000-4000-8000-000000000001','board-owner@example.invalid',now()),
 ('81000000-0000-4000-8000-000000000002','board-outsider@example.invalid',now());
INSERT INTO public.workspaces(id,name,slug,type,owner_id) VALUES
 ('82000000-0000-4000-8000-000000000001','Board agency','board-agency','agency','81000000-0000-4000-8000-000000000001');
INSERT INTO public.projects(id,workspace_id,name,owner_id) VALUES
 ('83000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','Board project','81000000-0000-4000-8000-000000000001');
INSERT INTO public.tasks(id,workspace_id,project_id,title,status,position) VALUES
 ('84000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','First','todo',0),
 ('84000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','Second','todo',1),
 ('84000000-0000-4000-8000-000000000003','82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','Third','in_progress',0);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true),set_config('request.jwt.claim.role','authenticated',true);
DO $$
DECLARE payload jsonb; denied boolean := false;
BEGIN
 SELECT jsonb_agg(jsonb_build_object('id',id,'status',
  CASE WHEN id='84000000-0000-4000-8000-000000000002' THEN 'in_progress' ELSE status END,
  'position',CASE WHEN id='84000000-0000-4000-8000-000000000002' THEN 1 ELSE 0 END,
  'expected_updated_at',updated_at)) INTO payload FROM public.tasks;
 PERFORM public.reorder_project_tasks('83000000-0000-4000-8000-000000000001',payload);
 IF (SELECT status FROM public.tasks WHERE title='Second') <> 'in_progress' OR
    (SELECT position FROM public.tasks WHERE title='Second') <> 1 OR
    (SELECT count(*) FROM public.tasks WHERE status='todo') <> 1 THEN
  RAISE EXCEPTION 'Atomic move did not persist'; END IF;
 BEGIN PERFORM public.reorder_project_tasks('83000000-0000-4000-8000-000000000001',payload);
 EXCEPTION WHEN serialization_failure THEN denied := true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Stale board version was accepted'; END IF;
 denied := false;
 BEGIN PERFORM public.reorder_project_tasks('83000000-0000-4000-8000-000000000001',
   (SELECT jsonb_agg(jsonb_build_object('id',id,'status',status,'position',4,'expected_updated_at',updated_at)) FROM public.tasks));
 EXCEPTION WHEN invalid_parameter_value THEN denied := true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Nonconsecutive order was accepted'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000002',true);
DO $$ DECLARE denied boolean := false; BEGIN
 BEGIN PERFORM public.reorder_project_tasks('83000000-0000-4000-8000-000000000001','[{"id":"84000000-0000-4000-8000-000000000001","status":"done","position":0,"expected_updated_at":"2026-01-01"}]'::jsonb);
 EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Outsider reordered project tasks'; END IF;
END $$;
SELECT 'atomic task ordering checks passed; rollback required' AS verification;
