-- ============================================================================
-- Workspace Boundary RLS Verification
-- ----------------------------------------------------------------------------
-- Run this before every release to confirm that every project-related table
-- has Row Level Security enabled and is protected by workspace/project-scoped
-- policies. Any row returned in the "FAILURES" sections is a release blocker.
--
-- Usage:
--   psql "$SUPABASE_DB_URL" -f scripts/verify-rls.sql
-- ============================================================================

\echo '== 1. RLS must be ENABLED on every project-related table =='
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname = ANY (ARRAY[
    'projects','tasks','milestones','deliverables','files','project_files',
    'project_comments','project_activity','project_members','activity',
    'activity_logs','ai_plans','ai_plan_items','approvals'
  ])
ORDER BY c.relname;

\echo ''
\echo '== FAILURE: tables WITHOUT RLS enabled (must be empty) =='
SELECT c.relname AS table_missing_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity = false
  AND c.relname = ANY (ARRAY[
    'projects','tasks','milestones','deliverables','files','project_files',
    'project_comments','project_activity','project_members','activity',
    'activity_logs','ai_plans','ai_plan_items','approvals'
  ])
ORDER BY c.relname;

\echo ''
\echo '== 2. Each table must have at least one SELECT policy =='
WITH expected(table_name) AS (
  VALUES ('projects'),('tasks'),('milestones'),('deliverables'),('files'),
         ('project_files'),('project_comments'),('project_activity'),
         ('project_members'),('activity'),('activity_logs'),('ai_plans'),
         ('ai_plan_items'),('approvals')
)
SELECT e.table_name
FROM expected e
LEFT JOIN pg_policies p
  ON p.schemaname = 'public'
 AND p.tablename = e.table_name
 AND (p.cmd = 'SELECT' OR p.cmd = 'ALL')
WHERE p.policyname IS NULL
ORDER BY e.table_name;
\echo '(rows above = tables missing a read policy -> FAILURE if non-empty)'

\echo ''
\echo '== 3. Policies must NOT be permissive to anon / public =='
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = ANY (ARRAY[
    'projects','tasks','milestones','deliverables','files','project_files',
    'project_comments','project_activity','project_members','activity',
    'activity_logs','ai_plans','ai_plan_items','approvals'
  ])
  AND ('anon' = ANY (roles) OR 'public' = ANY (roles))
ORDER BY tablename, policyname;
\echo '(rows above = anon/public exposure -> FAILURE if non-empty)'

\echo ''
\echo '== 4. Policies must reference a workspace/project scoping function =='
-- Every USING/CHECK expression should mention one of the security-definer
-- guards (is_project_member, is_workspace_member, has_workspace_role,
-- is_project_client, has_role) or compare workspace_id/owner_id directly.
SELECT tablename, policyname, cmd,
       coalesce(qual, '') AS using_expr,
       coalesce(with_check, '') AS check_expr
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = ANY (ARRAY[
    'projects','tasks','milestones','deliverables','files','project_files',
    'project_comments','project_activity','project_members','activity',
    'activity_logs','ai_plans','ai_plan_items','approvals'
  ])
  AND coalesce(qual, '') !~* '(is_project_member|is_workspace_member|has_workspace_role|is_project_client|has_role|has_project_role|workspace_id|owner_id|auth\.uid)'
  AND coalesce(with_check, '') !~* '(is_project_member|is_workspace_member|has_workspace_role|is_project_client|has_role|has_project_role|workspace_id|owner_id|auth\.uid)'
ORDER BY tablename, policyname;
\echo '(rows above = unscoped policy -> FAILURE if non-empty)'

\echo ''
\echo '== 5. Full policy inventory (manual review) =='
SELECT tablename, policyname, cmd, roles, permissive
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = ANY (ARRAY[
    'projects','tasks','milestones','deliverables','files','project_files',
    'project_comments','project_activity','project_members','activity',
    'activity_logs','ai_plans','ai_plan_items','approvals'
  ])
ORDER BY tablename, cmd, policyname;
