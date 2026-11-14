-- Ordo disposable QA: actual create/edit/move/complete/duplicate/delete,
-- stage customization, checklists, labels and progress.
-- Never apply to production. This commits ONLY into a disposable CI database;
-- a separate database connection verifies persistence after the commit.
\set ON_ERROR_STOP on
BEGIN;

INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data)
VALUES ('b7000000-0000-4000-8000-000000000001','ordo-qa-fixture@example.invalid',now(),'{}');
INSERT INTO public.workspaces(id,name,slug,type,owner_id)
VALUES ('b8000000-0000-4000-8000-000000000001','Ordo QA only','ordo-qa-fixture','agency',
'b7000000-0000-4000-8000-000000000001');
INSERT INTO public.workspace_members(workspace_id,user_id,role,status)
VALUES ('b8000000-0000-4000-8000-000000000001',
'b7000000-0000-4000-8000-000000000001','owner','active');
INSERT INTO public.projects(id,workspace_id,name,owner_id,status)
VALUES ('b9000000-0000-4000-8000-000000000001',
'b8000000-0000-4000-8000-000000000001','Lifecycle QA project',
'b7000000-0000-4000-8000-000000000001','active');

-- Customize any stage: rename and recolour it, and freely create a new stage.
UPDATE public.project_stages
SET name='Done but not complete',theme='lavender'
WHERE project_id='b9000000-0000-4000-8000-000000000001' AND category='done';
INSERT INTO public.project_stages(id,workspace_id,project_id,name,category,theme,position)
VALUES ('b5000000-0000-4000-8000-000000000001',
'b8000000-0000-4000-8000-000000000001',
'b9000000-0000-4000-8000-000000000001','Client review','todo','ocean',6);

-- Create two tasks in different, arbitrarily named stages.
INSERT INTO public.tasks(id,workspace_id,project_id,stage_id,title,status,position)
SELECT 'b6000000-0000-4000-8000-000000000001',
'b8000000-0000-4000-8000-000000000001',
'b9000000-0000-4000-8000-000000000001',
id,'Draft original','done',0 FROM public.project_stages
WHERE project_id='b9000000-0000-4000-8000-000000000001'
  AND name='Done but not complete';
INSERT INTO public.tasks(id,workspace_id,project_id,stage_id,title,status,position)
VALUES ('b6000000-0000-4000-8000-000000000002',
'b8000000-0000-4000-8000-000000000001',
'b9000000-0000-4000-8000-000000000001',
'b5000000-0000-4000-8000-000000000001',
'Second work item','todo',1);

DO $$
BEGIN
 IF (SELECT progress FROM public.projects
 WHERE id='b9000000-0000-4000-8000-000000000001')<>0 THEN
 RAISE EXCEPTION 'Task named Done should not auto-complete'; END IF;
END $$;

-- Update task content, then move the task across arbitrary stages.
UPDATE public.tasks SET title='Edited task',description='Saved details',
due_date='2026-12-03' WHERE id='b6000000-0000-4000-8000-000000000001';
UPDATE public.tasks SET stage_id='b5000000-0000-4000-8000-000000000001',position=3
WHERE id='b6000000-0000-4000-8000-000000000001';
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.tasks WHERE id='b6000000-0000-4000-8000-000000000001'
 AND title='Edited task' AND description='Saved details' AND due_date='2026-12-03'
 AND stage_id='b5000000-0000-4000-8000-000000000001' AND completed_at IS NULL) THEN
 RAISE EXCEPTION 'Task edit/move did not persist'; END IF;
END $$;

-- Explicit completion affects project progress, but stage placement does not.
UPDATE public.tasks SET completed_at=now()
WHERE id='b6000000-0000-4000-8000-000000000001';
DO $$
BEGIN
 IF (SELECT progress FROM public.projects
 WHERE id='b9000000-0000-4000-8000-000000000001')<>50 THEN
 RAISE EXCEPTION 'Expected 50 percent from one completed task out of two'; END IF;
END $$;

-- Add/toggle/rename/delete checklist items, independently of project completion.
INSERT INTO public.task_subtasks(id,project_id,task_id,title,position)
VALUES
('b4000000-0000-4000-8000-000000000001','b9000000-0000-4000-8000-000000000001',
'b6000000-0000-4000-8000-000000000001','First checklist item',0),
('b4000000-0000-4000-8000-000000000002','b9000000-0000-4000-8000-000000000001',
'b6000000-0000-4000-8000-000000000001','Second checklist item',1);
UPDATE public.task_subtasks SET completed=true
WHERE id='b4000000-0000-4000-8000-000000000001';
UPDATE public.task_subtasks SET title='Updated second item'
WHERE id='b4000000-0000-4000-8000-000000000002';
DO $$
DECLARE completed_count integer; total_count integer;
BEGIN
 SELECT count(*) FILTER(WHERE completed),count(*) INTO completed_count,total_count
 FROM public.task_subtasks WHERE task_id='b6000000-0000-4000-8000-000000000001';
 IF completed_count<>1 OR total_count<>2 THEN
 RAISE EXCEPTION 'Checklist should show 1 of 2 complete'; END IF;
 IF (SELECT progress FROM public.projects
 WHERE id='b9000000-0000-4000-8000-000000000001')<>50 THEN
 RAISE EXCEPTION 'Checklist unexpectedly changed project completion'; END IF;
END $$;

-- Add and edit a project label; assign it without touching stage/theme/progress.
INSERT INTO public.project_labels(id,workspace_id,project_id,name,color,position)
VALUES ('b3000000-0000-4000-8000-000000000001',
'b8000000-0000-4000-8000-000000000001',
'b9000000-0000-4000-8000-000000000001','QA tag','blue',99);
INSERT INTO public.task_labels(workspace_id,project_id,task_id,label_id)
VALUES ('b8000000-0000-4000-8000-000000000001',
'b9000000-0000-4000-8000-000000000001',
'b6000000-0000-4000-8000-000000000001',
'b3000000-0000-4000-8000-000000000001');
UPDATE public.project_labels SET name='QA renamed tag',color='green'
WHERE id='b3000000-0000-4000-8000-000000000001';
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.task_labels tl JOIN public.project_labels l ON l.id=tl.label_id
 WHERE tl.task_id='b6000000-0000-4000-8000-000000000001'
 AND l.name='QA renamed tag' AND l.color='green') THEN
 RAISE EXCEPTION 'Label association or rename/recolour failed'; END IF;
END $$;

-- Simulate a copy with its checklist as performed by the current application.
-- This exercises the DB constraints; frontend duplicate fidelity is separately audited.
INSERT INTO public.tasks(id,workspace_id,project_id,stage_id,title,status,position,completed_at)
SELECT 'b6000000-0000-4000-8000-000000000003',workspace_id,project_id,
stage_id,title||' (Copy)',status,position+1,NULL FROM public.tasks
WHERE id='b6000000-0000-4000-8000-000000000001';
INSERT INTO public.task_subtasks(project_id,task_id,title,completed,position)
SELECT project_id,'b6000000-0000-4000-8000-000000000003',title,completed,position
FROM public.task_subtasks
WHERE task_id='b6000000-0000-4000-8000-000000000001';
DO $$
BEGIN
 IF (SELECT progress FROM public.projects
 WHERE id='b9000000-0000-4000-8000-000000000001')<>33 THEN
 RAISE EXCEPTION 'New uncompleted duplicate should change task-derived progress to 33 percent'; END IF;
 IF (SELECT count(*) FROM public.task_subtasks WHERE
 task_id='b6000000-0000-4000-8000-000000000003')<>2 THEN
 RAISE EXCEPTION 'Copied checklist items missing'; END IF;
END $$;

-- Delete a duplicated task: checklist cascades, project progress recalculates.
DELETE FROM public.tasks WHERE id='b6000000-0000-4000-8000-000000000003';
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.task_subtasks
 WHERE task_id='b6000000-0000-4000-8000-000000000003') THEN
 RAISE EXCEPTION 'Subtask cascade failed on task deletion'; END IF;
 IF (SELECT progress FROM public.projects
 WHERE id='b9000000-0000-4000-8000-000000000001')<>50 THEN
 RAISE EXCEPTION 'Expected 50 percent after deleting incomplete duplicate'; END IF;
END $$;

-- Reopen and recomplete, then check archive/restore progress.
UPDATE public.tasks SET completed_at=NULL
WHERE id='b6000000-0000-4000-8000-000000000001';
DO $$
BEGIN
 IF (SELECT progress FROM public.projects
 WHERE id='b9000000-0000-4000-8000-000000000001')<>0 THEN
 RAISE EXCEPTION 'Reopening task did not reset project progress'; END IF;
END $$;
UPDATE public.tasks SET completed_at=now()
WHERE id='b6000000-0000-4000-8000-000000000001';
UPDATE public.tasks SET archived_at=now()
WHERE id='b6000000-0000-4000-8000-000000000002';
DO $$
BEGIN
 IF (SELECT progress FROM public.projects
 WHERE id='b9000000-0000-4000-8000-000000000001')<>100 THEN
 RAISE EXCEPTION 'Archiving an incomplete task should leave 100 percent'; END IF;
END $$;
UPDATE public.tasks SET archived_at=NULL
WHERE id='b6000000-0000-4000-8000-000000000002';

COMMIT;
SELECT 'PASS: SQL lifecycle and label/checklist operations (committed to disposable DB)' AS result;
