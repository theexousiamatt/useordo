# Workspace Boundary RLS Verification Checklist

Run this before **every release** to guarantee no project data leaks across
workspaces. Two layers: an automated runner and a manual sign-off.

## 1. Automated check (required)

```bash
# Direct Postgres connection string from Lovable Cloud backend settings
SUPABASE_DB_URL="postgres://..." node scripts/verify-rls.mjs
```

- Exit code `0` → all boundary checks pass, safe to ship.
- Non-zero → **release blocked**; fix the reported policy before continuing.

Prefer raw SQL output? Run the audit instead:

```bash
psql "$SUPABASE_DB_URL" -f scripts/verify-rls.sql
```

Any row under a `FAILURE` heading is a blocker.

## 2. What the runner validates

For every project-related table
(`projects`, `tasks`, `milestones`, `deliverables`, `files`, `project_files`,
`project_comments`, `project_activity`, `project_members`, `activity`,
`activity_logs`, `ai_plans`, `ai_plan_items`, `approvals`):

- [ ] **RLS is enabled** — no table relies on grants alone.
- [ ] **A read policy exists** — direct reads are impossible without one.
- [ ] **No `anon` / `public` role** appears in any policy.
- [ ] **Every policy expression is scoped** — references one of
      `is_project_member`, `is_workspace_member`, `has_workspace_role`,
      `is_project_client`, `has_project_role`, `has_role`, or a direct
      `workspace_id` / `owner_id` / `auth.uid()` comparison.

## 3. Manual sign-off (per release)

- [ ] New table added this cycle? Add it to `TABLES` in `scripts/verify-rls.mjs`
      **and** to `WORKSPACE_SCOPED_TABLES` in `src/lib/workspaceScope.ts`.
- [ ] All client-side reads of scoped tables go through `scopedSelect(...)`
      (which forces `.eq("workspace_id", workspaceId)`), not raw
      `supabase.from(...)`.
- [ ] Cross-workspace smoke test: sign in as a member of Workspace A and
      confirm Workspace B's projects/tasks/files never appear in the UI or
      search results.
- [ ] Edge functions accessing these tables use `service_role` intentionally
      and re-check workspace membership where needed.

## 4. When a new scoped table is introduced

1. Add `workspace_id` (non-null) to the table.
2. Enable RLS + add policies using the security-definer guards above.
3. Register it in both `TABLES` (runner) and `WORKSPACE_SCOPED_TABLES` (client).
4. Re-run `node scripts/verify-rls.mjs` until green.
