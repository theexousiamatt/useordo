-- Run in a NEW psql process after project-lifecycle-qa.sql COMMIT.
-- Confirms the data survives a new database connection (refresh equivalent).
\set ON_ERROR_STOP on
DO $$
DECLARE
 p uuid := 'b9000000-0000-4000-8000-000000000001';
 t uuid := 'b6000000-0000-4000-8000-000000000001';
 task_count integer; pct integer; checked_count integer; total_count integer;
BEGIN
 SELECT count(*) INTO task_count FROM public.tasks
 WHERE project_id=p AND archived_at IS NULL;
 IF task_count<>2 THEN RAISE EXCEPTION 'Refresh: expected 2 active tasks, got %',task_count; END IF;
 SELECT progress INTO pct FROM public.projects WHERE id=p;
 IF pct<>50 THEN RAISE EXCEPTION 'Refresh: expected progress 50%%, got %',pct; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.tasks WHERE id=t AND title='Edited task'
   AND description='Saved details' AND due_date='2026-12-03'
   AND completed_at IS NOT NULL AND stage_id='b5000000-0000-4000-8000-000000000001') THEN
   RAISE EXCEPTION 'Refresh: task edit, move or explicit completion did not persist';
 END IF;
 SELECT count(*) FILTER(WHERE completed),count(*) INTO checked_count,total_count
 FROM public.task_subtasks WHERE task_id=t;
 IF checked_count<>1 OR total_count<>2 THEN
   RAISE EXCEPTION 'Refresh: expected 1/2 checklist, got %/%',checked_count,total_count; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.project_stages WHERE id='b5000000-0000-4000-8000-000000000001'
    AND name='Client review' AND theme='ocean') THEN
   RAISE EXCEPTION 'Refresh: custom stage name/theme missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.project_stages WHERE project_id=p
    AND name='Done but not complete' AND theme='lavender') THEN
   RAISE EXCEPTION 'Refresh: renamed stage/colour missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.task_labels tl JOIN public.project_labels l
    ON l.id=tl.label_id WHERE tl.task_id=t AND l.name='QA renamed tag' AND l.color='green') THEN
   RAISE EXCEPTION 'Refresh: label association, name or colour did not persist'; END IF;
 IF EXISTS(SELECT 1 FROM public.tasks WHERE id='b6000000-0000-4000-8000-000000000003') THEN
   RAISE EXCEPTION 'Refresh: deleted duplicate reappeared'; END IF;
END $$;

-- Restrict outsider users; this is a RLS check on isolated data.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','b7000000-0000-4000-8000-000000000099',true);
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.tasks WHERE project_id='b9000000-0000-4000-8000-000000000001') THEN
   RAISE EXCEPTION 'RLS: outside user can read QA tasks'; END IF;
 IF EXISTS(SELECT 1 FROM public.task_subtasks WHERE project_id='b9000000-0000-4000-8000-000000000001') THEN
   RAISE EXCEPTION 'RLS: outside user can read QA checklist'; END IF;
END $$;
ROLLBACK;

SELECT 'PASS: fresh-connection persistence and outsider isolation' AS result;
