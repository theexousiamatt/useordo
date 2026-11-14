-- Disposable end-to-end test for stage-neutral task completion and project progress.
BEGIN;

INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data)
VALUES ('a7000000-0000-4000-8000-000000000001','ordo-explicit-completion@example.invalid',now(),'{}');
INSERT INTO public.workspaces(id,name,slug,type,owner_id)
VALUES ('a8000000-0000-4000-8000-000000000001','Neutral stages fixture','neutral-stages-fixture','agency',
'a7000000-0000-4000-8000-000000000001');
INSERT INTO public.workspace_members(workspace_id,user_id,role,status)
VALUES ('a8000000-0000-4000-8000-000000000001',
'a7000000-0000-4000-8000-000000000001','owner','active');
INSERT INTO public.projects(id,workspace_id,name,owner_id,status)
VALUES ('a9000000-0000-4000-8000-000000000001',
'a8000000-0000-4000-8000-000000000001','Neutral stage project',
'a7000000-0000-4000-8000-000000000001','active');

DO $$
DECLARE p uuid := 'a9000000-0000-4000-8000-000000000001';
        w uuid := 'a8000000-0000-4000-8000-000000000001';
        done_stage uuid; todo_stage uuid; pct integer; actual_stage uuid;
BEGIN
  SELECT id INTO done_stage FROM public.project_stages WHERE project_id=p AND name='Done';
  SELECT id INTO todo_stage FROM public.project_stages WHERE project_id=p AND name='To do';
  IF done_stage IS NULL OR todo_stage IS NULL THEN RAISE EXCEPTION 'Expected editable default stages'; END IF;

  INSERT INTO public.tasks(id,workspace_id,project_id,title,status,stage_id,position) VALUES
    ('a6000000-0000-4000-8000-000000000001',w,p,'Move freely','done',done_stage,0),
    ('a6000000-0000-4000-8000-000000000002',w,p,'Independent task','todo',todo_stage,1);
  SELECT progress INTO pct FROM public.projects WHERE id=p;
  IF pct<>0 THEN RAISE EXCEPTION 'Stage named Done must not complete tasks (got %)',pct; END IF;

  UPDATE public.tasks SET stage_id=todo_stage WHERE id='a6000000-0000-4000-8000-000000000001';
  UPDATE public.tasks SET stage_id=done_stage WHERE id='a6000000-0000-4000-8000-000000000002';
  SELECT progress INTO pct FROM public.projects WHERE id=p;
  IF pct<>0 THEN RAISE EXCEPTION 'Moving stages changed project progress (got %)',pct; END IF;

  UPDATE public.tasks SET status='done' WHERE id='a6000000-0000-4000-8000-000000000001';
  SELECT stage_id INTO actual_stage FROM public.tasks WHERE id='a6000000-0000-4000-8000-000000000001';
  IF actual_stage<>todo_stage THEN RAISE EXCEPTION 'Legacy status update moved a task unexpectedly'; END IF;

  UPDATE public.tasks SET completed_at=now() WHERE id='a6000000-0000-4000-8000-000000000001';
  SELECT progress INTO pct FROM public.projects WHERE id=p;
  IF pct<>50 THEN RAISE EXCEPTION 'Expected 50%% after explicit task completion (got %)',pct; END IF;

  UPDATE public.tasks SET stage_id=done_stage WHERE id='a6000000-0000-4000-8000-000000000001';
  UPDATE public.tasks SET stage_id=todo_stage WHERE id='a6000000-0000-4000-8000-000000000001';
  SELECT progress INTO pct FROM public.projects WHERE id=p;
  IF pct<>50 THEN RAISE EXCEPTION 'Moving a completed task changed completion'; END IF;

  UPDATE public.tasks SET archived_at=now() WHERE id='a6000000-0000-4000-8000-000000000002';
  SELECT progress INTO pct FROM public.projects WHERE id=p;
  IF pct<>100 THEN RAISE EXCEPTION 'Archived unfinished tasks should not lower active project progress'; END IF;

  UPDATE public.tasks SET completed_at=NULL WHERE id='a6000000-0000-4000-8000-000000000001';
  SELECT progress INTO pct FROM public.projects WHERE id=p;
  IF pct<>0 THEN RAISE EXCEPTION 'Reopening a task did not recalculate progress'; END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='project_stages' AND column_name='is_completion') THEN
    RAISE EXCEPTION 'Stage completion field must not exist';
  END IF;
  IF to_regprocedure('public.set_project_stage_completion(uuid,uuid,boolean,integer)') IS NOT NULL THEN
    RAISE EXCEPTION 'Obsolete stage-completion RPC still exists';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.project_stages'::regclass
    AND tgname='trg_ordo_stage_completion_progress') THEN
    RAISE EXCEPTION 'Obsolete stage-completion trigger exists';
  END IF;
  IF has_function_privilege('anon','public.recalculate_ordo_project_progress(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Progress recalculation is exposed anonymously';
  END IF;
END $$;
ROLLBACK;
SELECT 'PASS: stage-neutral movement, independent task completion, archive, security (rollback)' AS result;
