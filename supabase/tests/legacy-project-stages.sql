-- Run ONLY against an isolated, disposable clone of the legacy Ordo database,
-- after the additive legacy_project_stages migration is successfully applied.
-- This file is transaction-only, uses reserved fake UUIDs, and rolls back at end.
-- Never use it to validate the unrelated canonical foundation backend.
BEGIN;

INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES
 ('97000000-0000-4000-8000-000000000001','ordo-stage-owner@example.invalid',now(),'{}'),
 ('97000000-0000-4000-8000-000000000002','ordo-stage-manager@example.invalid',now(),'{}'),
 ('97000000-0000-4000-8000-000000000003','ordo-stage-client@example.invalid',now(),'{}'),
 ('97000000-0000-4000-8000-000000000004','ordo-stage-outsider@example.invalid',now(),'{}');
INSERT INTO public.workspaces(id,name,slug,type,owner_id) VALUES
 ('98000000-0000-4000-8000-000000000001','Legacy stages fixture','legacy-stages-fixture','agency',
  '97000000-0000-4000-8000-000000000001'),
 ('98000000-0000-4000-8000-000000000002','Legacy stages other studio','legacy-stages-other','agency',
  '97000000-0000-4000-8000-000000000004');
INSERT INTO public.workspace_members(workspace_id,user_id,role,status) VALUES
 ('98000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000001','owner','active'),
 ('98000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000002','manager','active'),
 ('98000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000003','client','active'),
 ('98000000-0000-4000-8000-000000000002','97000000-0000-4000-8000-000000000004','owner','active');

INSERT INTO public.projects(id,workspace_id,name,owner_id,status) VALUES
 ('99000000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000001','Stage fixture one',
   '97000000-0000-4000-8000-000000000001','active'),
 ('99000000-0000-4000-8000-000000000002','98000000-0000-4000-8000-000000000002','Stage fixture two',
   '97000000-0000-4000-8000-000000000004','active'),
 ('99000000-0000-4000-8000-000000000003','98000000-0000-4000-8000-000000000001','Destructive stage fixture',
   '97000000-0000-4000-8000-000000000001','active');

DO $$ BEGIN
  IF (SELECT count(*) FROM public.project_stages
      WHERE project_id='99000000-0000-4000-8000-000000000001')<>5 THEN
    RAISE EXCEPTION 'New projects were not seeded with exactly five legacy stages';
  END IF;
  IF EXISTS(SELECT 1 FROM public.project_stages s
       JOIN public.projects p ON p.id=s.project_id WHERE s.workspace_id<>p.workspace_id) THEN
    RAISE EXCEPTION 'Stage workspace does not match its project';
  END IF;
END $$;

-- Legacy inserts without an explicit stage use the first stage; status no longer positions work.
INSERT INTO public.tasks(id,project_id,workspace_id,title,status,position,archived_at) VALUES
 ('96000000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000001',
  '98000000-0000-4000-8000-000000000001','Stage fixture active','todo',0,NULL),
 ('96000000-0000-4000-8000-000000000002','99000000-0000-4000-8000-000000000001',
  '98000000-0000-4000-8000-000000000001','Stage fixture archived','todo',1,now()),
 ('96000000-0000-4000-8000-000000000003','99000000-0000-4000-8000-000000000003',
  '98000000-0000-4000-8000-000000000001','Delete fixture active','todo',0,NULL),
 ('96000000-0000-4000-8000-000000000004','99000000-0000-4000-8000-000000000003',
  '98000000-0000-4000-8000-000000000001','Delete fixture archived','todo',1,now()),
 ('96000000-0000-4000-8000-000000000005','99000000-0000-4000-8000-000000000003',
  '98000000-0000-4000-8000-000000000001','Preserved task in Done','done',0,NULL);

INSERT INTO public.task_assignees(task_id,user_id,project_id,workspace_id,created_by) VALUES
 ('96000000-0000-4000-8000-000000000003','97000000-0000-4000-8000-000000000002',
  '99000000-0000-4000-8000-000000000003','98000000-0000-4000-8000-000000000001',
  '97000000-0000-4000-8000-000000000001');
INSERT INTO public.project_comments(project_id,workspace_id,task_id,author_id,content) VALUES
 ('99000000-0000-4000-8000-000000000003','98000000-0000-4000-8000-000000000001',
  '96000000-0000-4000-8000-000000000003','97000000-0000-4000-8000-000000000001',
  'Fixture comment to be cascade-deleted');
INSERT INTO public.files(project_id,workspace_id,task_id,name,storage_path) VALUES
 ('99000000-0000-4000-8000-000000000003','98000000-0000-4000-8000-000000000001',
  '96000000-0000-4000-8000-000000000004','Fixture attachment','test-fixtures/no-object-created');
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.tasks
    WHERE id IN ('96000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000002')
      AND (stage_id IS NULL OR status<>'todo')) THEN
    RAISE EXCEPTION 'Legacy status-only inserts failed to populate stage IDs';
  END IF;
  IF has_function_privilege('anon',
      'public.manage_project_stage(uuid,text,uuid,text,text,uuid,uuid,integer,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous stage management RPC remains executable';
  END IF;
  IF has_table_privilege('authenticated','public.project_stages','INSERT')
     OR has_table_privilege('authenticated','public.project_stages','DELETE') THEN
    RAISE EXCEPTION 'Direct client stage writes are unexpectedly permitted';
  END IF;
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true),
  set_config('request.jwt.claim.sub','97000000-0000-4000-8000-000000000003',true);
DO $$ DECLARE denied boolean:=false; BEGIN
  BEGIN
    PERFORM public.manage_project_stage(
      '99000000-0000-4000-8000-000000000001','create',NULL,'Client takeover','todo',
      NULL,NULL,NULL,'94000000-0000-4000-8000-000000000001');
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Client can configure project stages'; END IF;
END $$;

-- Destructive deletion is denied to clients, even when they can view a project.
DO $$ DECLARE denied boolean:=false; stage_id uuid; stage_rev integer; BEGIN
  SELECT id,revision INTO stage_id,stage_rev FROM public.project_stages
    WHERE project_id='99000000-0000-4000-8000-000000000003' AND category='todo';
  BEGIN
    PERFORM public.manage_project_stage('99000000-0000-4000-8000-000000000003',
      'delete',stage_id,NULL,NULL,NULL,NULL,stage_rev,gen_random_uuid());
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Client can delete a project stage'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub','97000000-0000-4000-8000-000000000004',true);
DO $$ DECLARE denied boolean:=false; BEGIN
  BEGIN
    PERFORM public.manage_project_stage(
      '99000000-0000-4000-8000-000000000001','create',NULL,'Other studio takeover','todo',
      NULL,NULL,NULL,'94000000-0000-4000-8000-000000000002');
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Cross-studio stage write succeeded'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub','97000000-0000-4000-8000-000000000002',true);
DO $$ DECLARE sid uuid; duplicate uuid; rev integer; target uuid; old_count integer;
BEGIN
  sid:=public.manage_project_stage('99000000-0000-4000-8000-000000000001',
      'create',NULL,'Client feedback','review',NULL,NULL,NULL,
      '94000000-0000-4000-8000-000000000003');
  duplicate:=public.manage_project_stage('99000000-0000-4000-8000-000000000001',
      'create',NULL,'Client feedback','review',NULL,NULL,NULL,
      '94000000-0000-4000-8000-000000000003');
  IF sid<>duplicate OR
    (SELECT count(*) FROM public.project_stages WHERE project_id='99000000-0000-4000-8000-000000000001')<>6 THEN
    RAISE EXCEPTION 'Stage command receipt was not idempotent';
  END IF;

  SELECT revision INTO rev FROM public.project_stages WHERE id=sid;
  PERFORM public.manage_project_stage('99000000-0000-4000-8000-000000000001',
     'rename',sid,'Awaiting approval',NULL,NULL,NULL,rev,
     '94000000-0000-4000-8000-000000000004');
  IF (SELECT name FROM public.project_stages WHERE id=sid)<>'Awaiting approval' THEN
    RAISE EXCEPTION 'Stage rename failed';
  END IF;
  BEGIN
    PERFORM public.manage_project_stage('99000000-0000-4000-8000-000000000001',
      'rename',sid,'Stale rename',NULL,NULL,NULL,rev,
      '94000000-0000-4000-8000-000000000005');
    RAISE EXCEPTION 'Stale revision was incorrectly accepted';
  EXCEPTION WHEN SQLSTATE '40001' THEN NULL; END;

  SELECT revision INTO rev FROM public.project_stages WHERE id=sid;
  PERFORM public.manage_project_stage('99000000-0000-4000-8000-000000000001',
    'reorder',sid,NULL,NULL,
    (SELECT id FROM public.project_stages WHERE project_id='99000000-0000-4000-8000-000000000001'
     AND category='backlog' ORDER BY position LIMIT 1),NULL,rev,
    '94000000-0000-4000-8000-000000000006');
  IF (SELECT position FROM public.project_stages WHERE id=sid)<>0 THEN
    RAISE EXCEPTION 'Moving the stage to the beginning failed';
  END IF;

  -- Moving stages does not mutate any legacy status or task completion.
  UPDATE public.tasks SET stage_id=sid
    WHERE id='96000000-0000-4000-8000-000000000001';
  IF (SELECT status FROM public.tasks WHERE id='96000000-0000-4000-8000-000000000001')<>'todo' THEN
    RAISE EXCEPTION 'Explicit stage move incorrectly changed legacy task status';
  END IF;

  SELECT id INTO target FROM public.project_stages
    WHERE project_id='99000000-0000-4000-8000-000000000001' AND category='done'
    ORDER BY position LIMIT 1;
  SELECT revision INTO rev FROM public.project_stages WHERE id=sid;
  PERFORM public.manage_project_stage('99000000-0000-4000-8000-000000000001',
    'remove',sid,NULL,NULL,NULL,target,rev,
    '94000000-0000-4000-8000-000000000007');
  IF EXISTS(SELECT 1 FROM public.tasks WHERE id='96000000-0000-4000-8000-000000000001'
      AND (stage_id<>target OR status<>'todo')) THEN
    RAISE EXCEPTION 'Populated stage removal did not move the task correctly';
  END IF;
  IF EXISTS(SELECT 1 FROM public.project_stages WHERE id=sid) THEN
    RAISE EXCEPTION 'Removed stage still exists';
  END IF;
  IF (SELECT count(*) FROM public.project_stages
      WHERE project_id='99000000-0000-4000-8000-000000000001')<>5 THEN
    RAISE EXCEPTION 'Removed stage count mismatch';
  END IF;
END $$;
-- Regression: a project can go from five stages to two (and even one).
-- Archived tasks must be reassigned without changing their archived flag.
DO $$ DECLARE
  project_uuid uuid:='99000000-0000-4000-8000-000000000001';
  removing record;
  destination uuid;
  stage_count integer;
  attempt integer;
  rejected boolean:=false;
BEGIN
  FOR attempt IN 1..3 LOOP
    SELECT s.id,s.revision INTO removing FROM public.project_stages s
      WHERE s.project_id=project_uuid ORDER BY s.position DESC,s.id DESC LIMIT 1;
    SELECT s.id INTO destination FROM public.project_stages s
      WHERE s.project_id=project_uuid AND s.id<>removing.id
      ORDER BY s.position,s.id LIMIT 1;
    PERFORM public.manage_project_stage(project_uuid,'remove',removing.id,
      NULL,NULL,NULL,destination,removing.revision,gen_random_uuid());
  END LOOP;
  SELECT count(*) INTO stage_count FROM public.project_stages WHERE project_id=project_uuid;
  IF stage_count<>2 THEN RAISE EXCEPTION 'Project cannot be reduced to two stages: %',stage_count; END IF;
  IF EXISTS(SELECT 1 FROM public.project_stages WHERE project_id=project_uuid AND position NOT IN (0,1)) THEN
    RAISE EXCEPTION 'Two-stage layout positions were not normalized'; END IF;

  -- Remove a populated stage holding an archived task; the sole survivor keeps all tasks.
  SELECT s.id,s.revision INTO removing FROM public.project_stages s
    WHERE s.project_id=project_uuid AND s.category='todo' LIMIT 1;
  SELECT s.id INTO destination FROM public.project_stages s
    WHERE s.project_id=project_uuid AND s.id<>removing.id LIMIT 1;
  IF removing.id IS NULL OR destination IS NULL THEN
    RAISE EXCEPTION 'Two-stage fixture is missing expected stages'; END IF;
  PERFORM public.manage_project_stage(project_uuid,'remove',removing.id,
    NULL,NULL,NULL,destination,removing.revision,gen_random_uuid());
  IF (SELECT count(*) FROM public.project_stages WHERE project_id=project_uuid)<>1 THEN
    RAISE EXCEPTION 'Reducing two stages to one unexpectedly failed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.tasks t
      WHERE t.id='96000000-0000-4000-8000-000000000002'
        AND t.stage_id=destination AND t.status='todo' AND t.archived_at IS NOT NULL) THEN
    RAISE EXCEPTION 'An archived task was lost or not moved during stage removal'; END IF;

  SELECT s.id,s.revision INTO removing FROM public.project_stages s
    WHERE s.project_id=project_uuid LIMIT 1;
  BEGIN
    PERFORM public.manage_project_stage(project_uuid,'remove',removing.id,
      NULL,NULL,NULL,NULL,removing.revision,gen_random_uuid());
  EXCEPTION WHEN SQLSTATE '22023' THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'The final stage must not be removable'; END IF;
  IF (SELECT count(*) FROM public.tasks WHERE project_id=project_uuid)<>2 THEN
    RAISE EXCEPTION 'Stage removal changed the number of active or archived tasks'; END IF;
END $$;

-- Manager can explicitly delete a stage and all its active/archived tasks.
-- Other stages and their tasks remain unchanged; related task rows cascade.
DO $$ DECLARE
  project_uuid uuid:='99000000-0000-4000-8000-000000000003';
  deleting_stage_id uuid; stage_rev integer; done_stage uuid;
  request_uuid uuid:=gen_random_uuid(); deleted_id uuid; refused boolean:=false;
BEGIN
  SELECT id,revision INTO deleting_stage_id,stage_rev FROM public.project_stages
    WHERE project_id=project_uuid AND category='todo';
  SELECT id INTO done_stage FROM public.project_stages
    WHERE project_id=project_uuid AND category='done';
  deleted_id:=public.manage_project_stage(project_uuid,'delete',deleting_stage_id,
    NULL,NULL,NULL,NULL,stage_rev,request_uuid);
  IF deleted_id<>deleting_stage_id OR
     public.manage_project_stage(project_uuid,'delete',deleting_stage_id,
       NULL,NULL,NULL,NULL,stage_rev,request_uuid)<>deleting_stage_id THEN
    RAISE EXCEPTION 'Destructive stage command was not idempotent';
  END IF;
  IF EXISTS(SELECT 1 FROM public.tasks WHERE id IN
    ('96000000-0000-4000-8000-000000000003','96000000-0000-4000-8000-000000000004')) THEN
    RAISE EXCEPTION 'Active or archived tasks survived stage deletion'; END IF;
  IF EXISTS(SELECT 1 FROM public.project_stages WHERE id=deleting_stage_id) THEN
    RAISE EXCEPTION 'Deleted stage still exists'; END IF;
  IF (SELECT count(*) FROM public.project_stages WHERE project_id=project_uuid)<>4 THEN
    RAISE EXCEPTION 'Incorrect stage count after destructive deletion'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.tasks t WHERE t.id='96000000-0000-4000-8000-000000000005'
    AND t.stage_id=done_stage AND t.status='done') THEN
    RAISE EXCEPTION 'Task outside deleted stage was affected'; END IF;
  IF EXISTS(SELECT 1 FROM public.task_assignees
      WHERE task_id='96000000-0000-4000-8000-000000000003')
     OR EXISTS(SELECT 1 FROM public.project_comments
      WHERE task_id='96000000-0000-4000-8000-000000000003')
     OR EXISTS(SELECT 1 FROM public.files
      WHERE task_id='96000000-0000-4000-8000-000000000004') THEN
    RAISE EXCEPTION 'Task dependencies did not cascade on delete'; END IF;

  -- A project cannot lose its final stage, not even via the new delete command.
  SELECT id,revision INTO deleting_stage_id,stage_rev FROM public.project_stages
    WHERE project_id='99000000-0000-4000-8000-000000000001' LIMIT 1;
  BEGIN
    PERFORM public.manage_project_stage('99000000-0000-4000-8000-000000000001',
      'delete',deleting_stage_id,NULL,NULL,NULL,NULL,stage_rev,gen_random_uuid());
  EXCEPTION WHEN SQLSTATE '22023' THEN refused:=true; END;
  IF NOT refused THEN RAISE EXCEPTION 'Final stage was deleted'; END IF;
END $$;

RESET ROLE;

DO $$ BEGIN
  IF (SELECT count(*) FROM public.tasks WHERE project_id='99000000-0000-4000-8000-000000000001')<>2
     OR (SELECT count(*) FROM public.tasks WHERE id='96000000-0000-4000-8000-000000000002'
         AND archived_at IS NOT NULL)<>1 THEN
    RAISE EXCEPTION 'Tasks or archived state lost during stage management';
  END IF;
END $$;

ROLLBACK;
SELECT 'PASS: legacy stage transfers, explicit stage/task delete, archive and FK cascades, permissions, idempotency (rollback)' AS result;
