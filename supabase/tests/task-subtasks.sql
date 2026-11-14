-- Run only against an isolated disposable legacy Ordo schema.
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.task_subtasks') IS NULL THEN
    RAISE EXCEPTION 'Missing task_subtasks table';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.task_subtasks'::regclass) THEN
    RAISE EXCEPTION 'Subtasks table is missing RLS';
  END IF;
  IF has_table_privilege('anon','public.task_subtasks','SELECT') OR
     has_table_privilege('anon','public.task_subtasks','INSERT') OR
     has_table_privilege('anon','public.task_subtasks','UPDATE') OR
     has_table_privilege('anon','public.task_subtasks','DELETE') THEN
    RAISE EXCEPTION 'Anonymous caller has subtask access';
  END IF;
  IF NOT has_table_privilege('authenticated','public.task_subtasks','SELECT,INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'Missing authenticated subtask grants';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='task_subtasks') <> 4 THEN
    RAISE EXCEPTION 'Subtask table requires select, insert, update and delete RLS policies';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.task_subtasks'::regclass
      AND conname='task_subtasks_parent_task_fk'
      AND confdeltype='c' AND confupdtype='c'
  ) THEN
    RAISE EXCEPTION 'Subtask project/task FK is missing cascades';
  END IF;
END $$;
ROLLBACK;
