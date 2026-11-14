-- Run only after migrations in a disposable local Supabase database.
-- Verify atomic copy fidelity, opt-out, authorization, and all-or-nothing rollback.
BEGIN;

INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES
 ('d7000000-0000-4000-8000-000000000001','ordo-copy-owner@example.invalid',now(),'{}'),
 ('d7000000-0000-4000-8000-000000000002','ordo-copy-member@example.invalid',now(),'{}'),
 ('d7000000-0000-4000-8000-000000000003','ordo-copy-outsider@example.invalid',now(),'{}');
INSERT INTO public.workspaces(id,name,slug,type,owner_id)
VALUES ('d8000000-0000-4000-8000-000000000001','Copy QA workspace','ordo-copy-qa','agency',
'd7000000-0000-4000-8000-000000000001');
INSERT INTO public.workspace_members(workspace_id,user_id,role,status) VALUES
 ('d8000000-0000-4000-8000-000000000001','d7000000-0000-4000-8000-000000000001','owner','active'),
 ('d8000000-0000-4000-8000-000000000001','d7000000-0000-4000-8000-000000000002','member','active');
INSERT INTO public.projects(id,workspace_id,name,owner_id,status)
VALUES ('d9000000-0000-4000-8000-000000000001',
'd8000000-0000-4000-8000-000000000001','Duplicate task QA',
'd7000000-0000-4000-8000-000000000001','active');

-- A completed task in a stage named Done, with two assignees, a checklist and a label.
INSERT INTO public.tasks(id,workspace_id,project_id,title,description,status,stage_id,
  position,due_date,completed_at,created_by,assignee_id)
SELECT 'd6000000-0000-4000-8000-000000000001',
'd8000000-0000-4000-8000-000000000001',
'd9000000-0000-4000-8000-000000000001',
'Client launch','Save final report','done',s.id,
0,'2026-12-04',now(),
'd7000000-0000-4000-8000-000000000001',
'd7000000-0000-4000-8000-000000000001'
FROM public.project_stages s
WHERE s.project_id='d9000000-0000-4000-8000-000000000001' AND s.name='Done';
INSERT INTO public.task_assignees(task_id,user_id,project_id,workspace_id,created_by) VALUES
 ('d6000000-0000-4000-8000-000000000001',
 'd7000000-0000-4000-8000-000000000001',
 'd9000000-0000-4000-8000-000000000001',
 'd8000000-0000-4000-8000-000000000001',
 'd7000000-0000-4000-8000-000000000001'),
 ('d6000000-0000-4000-8000-000000000001',
 'd7000000-0000-4000-8000-000000000002',
 'd9000000-0000-4000-8000-000000000001',
 'd8000000-0000-4000-8000-000000000001',
 'd7000000-0000-4000-8000-000000000001');
INSERT INTO public.project_labels(id,workspace_id,project_id,name,color) VALUES
 ('d3000000-0000-4000-8000-000000000001',
 'd8000000-0000-4000-8000-000000000001',
 'd9000000-0000-4000-8000-000000000001','Launch-critical','blue');
INSERT INTO public.task_labels(workspace_id,project_id,task_id,label_id) VALUES
 ('d8000000-0000-4000-8000-000000000001',
 'd9000000-0000-4000-8000-000000000001',
 'd6000000-0000-4000-8000-000000000001',
 'd3000000-0000-4000-8000-000000000001');
INSERT INTO public.task_subtasks(project_id,task_id,title,completed,position) VALUES
 ('d9000000-0000-4000-8000-000000000001',
 'd6000000-0000-4000-8000-000000000001','Take screenshots',true,0),
 ('d9000000-0000-4000-8000-000000000001',
 'd6000000-0000-4000-8000-000000000001','Send client email',false,1);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','d7000000-0000-4000-8000-000000000001',true);

DO $$
DECLARE copy_id uuid; no_assignee_copy uuid; p uuid:='d9000000-0000-4000-8000-000000000001';
BEGIN
  copy_id := public.duplicate_ordo_task('d6000000-0000-4000-8000-000000000001',true);
  IF copy_id IS NULL THEN RAISE EXCEPTION 'Copy RPC returned no task ID'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.tasks copy JOIN public.tasks original
      ON original.id='d6000000-0000-4000-8000-000000000001'
    WHERE copy.id=copy_id AND copy.title='Client launch (Copy)'
      AND copy.description=original.description AND copy.due_date=original.due_date
      AND copy.stage_id=original.stage_id AND copy.status=original.status
      AND copy.workspace_id=original.workspace_id AND copy.project_id=original.project_id
      AND copy.completed_at IS NULL AND copy.archived_at IS NULL
      AND copy.assignee_id=original.assignee_id
  ) THEN RAISE EXCEPTION 'Task fields or explicit completion copied incorrectly'; END IF;
  IF (SELECT count(*) FROM public.task_subtasks WHERE task_id=copy_id)<>2
    OR (SELECT count(*) FROM public.task_subtasks WHERE task_id=copy_id AND completed)<>1
    THEN RAISE EXCEPTION 'Checklist copy did not preserve 1/2 progress'; END IF;
  IF (SELECT count(*) FROM public.task_labels
    WHERE task_id=copy_id AND label_id='d3000000-0000-4000-8000-000000000001')<>1
    THEN RAISE EXCEPTION 'Project label assignment missing'; END IF;
  IF (SELECT count(DISTINCT user_id) FROM public.task_assignees WHERE task_id=copy_id)<>2
    THEN RAISE EXCEPTION 'Multiple assignees not copied'; END IF;
  IF (SELECT progress FROM public.projects WHERE id=p)<>50
    THEN RAISE EXCEPTION 'Copied task incorrectly inherited completion'; END IF;

  no_assignee_copy := public.duplicate_ordo_task('d6000000-0000-4000-8000-000000000001',false);
  IF EXISTS(SELECT 1 FROM public.task_assignees WHERE task_id=no_assignee_copy)
    OR EXISTS(SELECT 1 FROM public.tasks WHERE id=no_assignee_copy AND assignee_id IS NOT NULL)
    THEN RAISE EXCEPTION 'copyAssignee=false still assigned someone'; END IF;
  IF (SELECT count(*) FROM public.task_labels WHERE task_id=no_assignee_copy)<>1
    OR (SELECT count(*) FROM public.task_subtasks WHERE task_id=no_assignee_copy)<>2
    THEN RAISE EXCEPTION 'Opt-out dropped unrelated labels/checklist'; END IF;
  IF (SELECT progress FROM public.projects WHERE id=p)<>33
    THEN RAISE EXCEPTION 'Project progress did not count two new incomplete tasks'; END IF;
END $$;

-- Unrelated users must not invoke or learn anything from the RPC.
SELECT set_config('request.jwt.claim.sub','d7000000-0000-4000-8000-000000000003',true);
DO $$
DECLARE blocked boolean:=false;
BEGIN
  BEGIN
    PERFORM public.duplicate_ordo_task('d6000000-0000-4000-8000-000000000001',true);
  EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Outsider could duplicate a restricted task'; END IF;
END $$;

RESET ROLE;
DO $$
BEGIN
 IF has_function_privilege('anon','public.duplicate_ordo_task(uuid,boolean)','EXECUTE') THEN
  RAISE EXCEPTION 'Anonymous role must not have RPC privilege'; END IF;
END $$;

-- Simulate a failed downstream label insert. The entire RPC must roll back:
-- not even an empty placeholder task may remain.
CREATE OR REPLACE FUNCTION public.qa_abort_task_label_copy()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $qa$
BEGIN
 RAISE EXCEPTION 'qa-copy-label-failure';
END; $qa$;
CREATE TRIGGER qa_abort_task_label_copy BEFORE INSERT ON public.task_labels
FOR EACH ROW EXECUTE FUNCTION public.qa_abort_task_label_copy();
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','d7000000-0000-4000-8000-000000000001',true);
DO $$
DECLARE prior_count integer; later_count integer; prevented boolean:=false;
BEGIN
 SELECT count(*) INTO prior_count FROM public.tasks
 WHERE project_id='d9000000-0000-4000-8000-000000000001';
 BEGIN
   PERFORM public.duplicate_ordo_task('d6000000-0000-4000-8000-000000000001',true);
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='qa-copy-label-failure' THEN prevented:=true; ELSE RAISE; END IF;
 END;
 SELECT count(*) INTO later_count FROM public.tasks
 WHERE project_id='d9000000-0000-4000-8000-000000000001';
 IF NOT prevented OR prior_count<>later_count THEN
   RAISE EXCEPTION 'Failed downstream copy left a partial task'; END IF;
END $$;
RESET ROLE;
DROP TRIGGER qa_abort_task_label_copy ON public.task_labels;
DROP FUNCTION public.qa_abort_task_label_copy();

ROLLBACK;
SELECT 'PASS: atomic task copy, checklist, labels, all assignees, opt-out, RLS and failure rollback' AS result;
