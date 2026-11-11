-- Limit canonical production RPC entrypoints to signed-in users.
-- The environment identity RPC remains anonymously readable by design; it returns
-- only the public environment, project ref and fixed schema marker.
BEGIN;
DO $$
DECLARE fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'change_production_item',
        'list_context_assignees',
        'list_production_assignees',
        'list_unified_tasks',
        'production_assignee_eligible',
        'production_permissions',
        'save_operational_task',
        'save_production_item'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
  END LOOP;
END $$;
COMMIT;
