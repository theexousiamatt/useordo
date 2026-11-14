-- Disposable test: completion-stage semantics, transactional project progress, and RPC grants.
BEGIN;

INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data)
VALUES ('a7000000-0000-4000-8000-000000000001','ordo-completion-fixture@example.invalid',now(),'{}');
INSERT INTO public.workspaces(id,name,slug,type,owner_id)
VALUES ('a8000000-0000-4000-8000-000000000001','Completion fixture','completion-fixture','agency',
'a7000000-0000-4000-8000-000000000001');
INSERT INTO public.workspace_members(workspace_id,user_id,role,status)
VALUES ('a8000000-0000-4000-8000-000000000001',
'a7000000-0000-4000-8000-000000000001','owner','active');
INSERT INTO public.projects(id,workspace_id,name,owner_id,status)
VALUES ('a9000000-0000-4000-8000-000000000001',
'a8000000-0000-4000-8000-000000000001','Completion test',
'a7000000-0000-4000-8000-000000000001','active');

DO $$
DECLARE p uuid := 'a9000000-0000-4000-8000-000000000001';
        w uuid := 'a8000000-0000-4000-8000-000000000001';
        done_id uuid; todo_id uuid; pct integer;
BEGIN
  SELECT id INTO done_id FROM public.project_stages WHERE project_id=p AND category='done';
  SELECT id INTO todo_id FROM public.project_stages WHERE project_id=p AND category='todo';
  IF done_id IS NULL OR todo_id IS NULL THEN RAISE EXCEPTION 'Missing default stages'; END IF;
  IF NOT (SELECT is_completion FROM public.project_stages WHERE id=done_id) THEN
    RAISE EXCEPTION 'New Done stage is not a completion stage'; END IF;
  IF (SELECT is_completion FROM public.project_stages WHERE id=todo_id) THEN
    RAISE EXCEPTION 'New To do stage should not be a completion stage'; END IF;
  INSERT INTO public.tasks(id,workspace_id,project_id,title,status,position) VALUES
    ('a6000000-0000-4000-8000-000000000001',w,p,'Incomplete','todo',0),
    ('a6000000-0000-4000-8000-000000000002',w,p,'Finished','done',1);
  SELECT progress INTO pct FROM public.projects WHERE id=p;
  IF pct <> 50 THEN RAISE EXCEPTION 'Expected 50%% after 1/2 tasks, got %',pct; END IF;

  UPDATE public.tasks SET stage_id=done_id, status='done' WHERE id='a6000000-0000-4000-8000-000000000001';
  SELECT progress INTO pct FROM public.projects WHERE id=p;
  IF pct <> 100 THEN RAISE EXCEPTION 'Expected 100%% after moving to completed stage, got %',pct; END IF;

  UPDATE public.project_stages SET is_completion=false WHERE id=done_id;
  SELECT progress INTO pct FROM public.projects WHERE id=p;
  IF pct <> 0 THEN RAISE EXCEPTION 'Stage semantics changed but progress did not recalculate'; END IF;

  UPDATE public.project_stages SET is_completion=true WHERE id=done_id;
  UPDATE public.tasks SET archived_at=now() WHERE id='a6000000-0000-4000-8000-000000000002';
  SELECT progress INTO pct FROM public.projects WHERE id=p;
  IF pct <> 100 THEN RAISE EXCEPTION 'Archived completed task incorrectly counted'; END IF;

  UPDATE public.tasks SET stage_id=todo_id,status='todo' WHERE id='a6000000-0000-4000-8000-000000000001';
  SELECT progress INTO pct FROM public.projects WHERE id=p;
  IF pct <> 0 THEN RAISE EXCEPTION 'Expected 0%% after reopening last active task, got %',pct; END IF;
END $$;

DO $$
BEGIN
  IF has_function_privilege('anon','public.set_project_stage_completion(uuid,uuid,boolean,integer)','EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous users can manage completion stages';
  END IF;
  IF NOT has_function_privilege('authenticated','public.set_project_stage_completion(uuid,uuid,boolean,integer)','EXECUTE') THEN
    RAISE EXCEPTION 'Manager RPC is not available to authenticated users';
  END IF;
END $$;
ROLLBACK;
SELECT 'PASS: stage semantics, task progress, archive and RPC security (rollback)' AS result;
