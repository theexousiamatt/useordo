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
   '97000000-0000-4000-8000-000000000004','active');

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

-- Existing status-only clients must continue mapping to a new stage ID.
INSERT INTO public.tasks(id,project_id,workspace_id,title,status,position,archived_at) VALUES
 ('96000000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000001',
  '98000000-0000-4000-8000-000000000001','Stage fixture active','todo',0,NULL),
 ('96000000-0000-4000-8000-000000000002','99000000-0000-4000-8000-000000000001',
  '98000000-0000-4000-8000-000000000001','Stage fixture archived','todo',1,now());
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

  -- Updating stage identity maps to the new reporting category, not the old one.
  UPDATE public.tasks SET stage_id=sid
    WHERE id='96000000-0000-4000-8000-000000000001';
  IF (SELECT status FROM public.tasks WHERE id='96000000-0000-4000-8000-000000000001')<>'review' THEN
    RAISE EXCEPTION 'Explicit stage move did not synchronize task reporting status';
  END IF;

  SELECT id INTO target FROM public.project_stages
    WHERE project_id='99000000-0000-4000-8000-000000000001' AND category='done'
    ORDER BY position LIMIT 1;
  SELECT revision INTO rev FROM public.project_stages WHERE id=sid;
  PERFORM public.manage_project_stage('99000000-0000-4000-8000-000000000001',
    'remove',sid,NULL,NULL,NULL,target,rev,
    '94000000-0000-4000-8000-000000000007');
  IF EXISTS(SELECT 1 FROM public.tasks WHERE id='96000000-0000-4000-8000-000000000001'
      AND (stage_id<>target OR status<>'done')) THEN
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
RESET ROLE;

DO $$ BEGIN
  IF (SELECT count(*) FROM public.tasks WHERE project_id='99000000-0000-4000-8000-000000000001')<>2
     OR (SELECT count(*) FROM public.tasks WHERE id='96000000-0000-4000-8000-000000000002'
         AND archived_at IS NOT NULL)<>1 THEN
    RAISE EXCEPTION 'Tasks or archived state lost during stage management';
  END IF;
END $$;

ROLLBACK;
SELECT 'PASS: isolated legacy stage CRUD, access, compatibility, task preservation (rollback)' AS result;
