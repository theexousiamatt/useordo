-- Stage-theme migration contract tests. Run only in a disposable local database.
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='project_stages' AND column_name='theme'
      AND column_default LIKE '%neutral%'
  ) THEN
    RAISE EXCEPTION 'Stage theme column with neutral default is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.project_stages'::regclass AND conname='project_stages_theme_allowed'
  ) THEN
    RAISE EXCEPTION 'Stage theme enum constraint is missing';
  END IF;
  IF has_function_privilege('anon', 'public.create_custom_stage(uuid,text,text,text,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.set_project_stage_theme(uuid,uuid,text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous caller can change a stage theme';
  END IF;
  IF NOT has_function_privilege('authenticated','public.create_custom_stage(uuid,text,text,text,uuid)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.set_project_stage_theme(uuid,uuid,text,integer)','EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated stage theme RPC grant is missing';
  END IF;
  IF has_table_privilege('authenticated','public.project_stages','UPDATE') THEN
    RAISE EXCEPTION 'Stage theme must not be changed through direct table updates';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.project_stages'::regclass) THEN
    RAISE EXCEPTION 'Stage RLS is disabled';
  END IF;
END $$;
ROLLBACK;
