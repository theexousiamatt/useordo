# Legacy Ordo improvement track — retain production architecture

## Source of truth and safety

- Preserve the old React/Vite/shadcn/Ordo UI architecture and existing Supabase project `ilvqopsvyacegotplstw`.
- Legacy source branch: `codex/owned-supabase-backend`; incremental improvements branch: `codex/legacy-ordo-improvements`.
- The deployed static artifact branch `codex/hostinger-static` has a separate history and **must not** receive source changes. Build reviewed legacy source and publish compiled artifacts through the verified existing process.
- **Do not merge canonical foundation PR #1 into this branch.** Its migrations and new backend `afmclvqwejesxyzvizon` are unrelated to the legacy production schema.
- Current production already has real users/projects/tasks. No resets, destructive migrations, or project data replacements.

## Shipped to source branch (not live)

### Add teammates to an existing project

- `src/components/projects/ProjectTeamDrawer.tsx`: Select multiple existing active studio collaborators and add as project members.
- `src/pages/ProjectDetail.tsx`: Adds an **Add teammates** action alongside existing **Invite client**.
- `src/hooks/useProjects.tsx`: Workspace-members picker excludes inactive memberships.
- Writes go through existing `project_members` RLS. No new database tables, functions, grants, or backend changes.
- Uses a single atomic insert, avoiding duplicate entries already present and preserving project ownership. Each person can belong to multiple projects, and clients follow existing invitation flow.

### Known limits

- This slice **adds existing teammates only**; it does not offer role changes/removal or invite an entirely new email account. Those should be scoped separately around task-assignee integrity and server-side authorization.
- Failed/unconfirmed database insertion must be reviewed with a refreshed member list before retrying to avoid duplicate inserts.
- Neither a local build nor browser acceptance test has run yet. The change requires testing before a release.

## Codex verification tasks

1. Checkout `codex/legacy-ordo-improvements`, not `codex/heroui-v3-proof`.
2. Run `npm ci`, `npx tsc --noEmit`, `npm run test`, `npm run build`, and relevant lint. Fix issues on this branch.
3. With a non-production fixture, test UI with one/multiple teammates, duplicate selection, workspace owner, inactive teammate, client-role account, permissions denied, full project roster, retry after failed insert, and navigation/refresh.
4. Verify the existing production `project_members` RLS covers member insertion only for authorized project managers, prevents cross-workspace additions, protects client visibility, and does not allow unrelated users to join projects.
5. Confirm a project can have multiple members and each user can belong to several projects. Verify task-assignable member pickers refresh.
6. Deploy to a controlled preview, test with safe fixture accounts and mobile/desktop. Then use the existing artifact deployment method to promote a validated build, with rollback and backups.

## Customizable Trello-style project stages (source implemented; NOT deployed)

**New migration**: `supabase/migrations/20261112040000_legacy_project_stages.sql`

This additive migration creates `project_stages` with independent stage IDs, names, reporting categories and position for each project. Existing projects are seeded with the five familiar stages. Existing tasks receive `stage_id` with their current `status` preserved. An insert trigger seeds newly created projects. A compatibility trigger maps legacy status-only task writes to a matching or fallback stage and maps explicit stage moves back to the legacy reporting category. An authenticated, project-manager-guarded `manage_project_stage` RPC handles create/rename/reorder/remove, revision conflicts and idempotency. Removal moves **all** tasks, including archived ones, to an explicitly chosen destination within the same project before deleting a stage.

**Modified frontend**:
- `src/hooks/useProjectStages.ts`: project-scoped stage reads and commands.
- `src/lib/legacyStageBoard.ts`: pure helpers to map legacy tasks, reorder stage positions, and move cards.
- `src/lib/legacyStageBoard.test.ts`: unit tests for multiple stages of the same category, reordering, cross-stage moves, preserving archived task fields, and old-task mapping.
- `src/components/projects/ProjectBoard.tsx`: dynamic sortable columns, drag handles, add/rename/delete controls, safe removal dialog, custom stage navigation, and task persistence.
- `src/components/ordo/OrdoColumnContextMenu.tsx`: use stage IDs for column actions.
- `src/components/ordo/OrdoCardContextMenu.tsx` and `OrdoBulkActionMenu.tsx`: list real named stages under Move, separate reporting status action.
- `src/hooks/useProjectData.tsx` and `src/integrations/supabase/types.ts`: preserve stage identity during create, duplicate, reorder and type-safe updates.
- `src/pages/ProjectDetail.tsx`: pass existing project management permissions to stage UI.
- `supabase/functions/duplicate-project/index.ts`: clone source stages into a newly seeded project and remap copied task stage IDs. **Deploy this Edge Function only after the migration has been validated and applied to the appropriate preview/live environment.**

**Verification recorded 12 November 2026**

- Verified source branch: `codex/legacy-ordo-improvements`.
- Targeted isolated TypeScript check for the extracted `legacyStageBoard.ts` helper **passed** using TypeScript 5.8.3 and stubbed type-only imports. It is not a whole-project typecheck.
- Seven deterministic runtime helper assertions and an additional 800-case randomized cross-stage data preservation test **passed** using a locally transcribed copy of the helper and the global TypeScript transpiler. This is not the Vitest suite.
- Added `.github/workflows/legacy-ordo-verify.yml` to request `npm ci`, `npx tsc --noEmit`, `npm run test`, `npm run build` and targeted ESLint. Its GitHub Actions runs failed **before a runner was allocated** (`runner_id:0`, zero executed steps); CI application results remain unknown, not failed tests.
- Added `supabase/tests/legacy-project-stages.sql` with transaction-only synthetic project/auth fixtures, grant checks, RPC access denial, idempotency, revision checks, stage operations, and task preservation. **It has not run** because no isolated clone/branch of the old Supabase project is available, and the execution environment has no local PostgreSQL server.
- Improved migration safety: explicitly revoke inherited table write privileges on `project_stages`, and make the task-stage foreign key DEFERRABLE so project cascade deletion remains possible.
- Confirmed old Supabase still has four user accounts, three projects, four tasks and **no `project_stages` table**. The live database remains untouched.
- **Release remains BLOCKED** on actual CI runner execution, real full-project checks, disposable legacy-schema integration tests, authentic user-role tests and preview acceptance.

**Before any real migration or deployment**:

1. Use a **disposable isolated copy of the legacy schema** to execute the new SQL (not the canonical foundation schema, and not the live legacy database). Verify the stage backfill doesn't modify any existing task status, project, assignment, or archived flag, and that new project creation seeds stage rows.
2. Test manager/owner and denied member/client/anonymous/cross-workspace RPC calls. Inspect the authenticated and anonymous grants and Supabase security advisor findings.
3. Test column rename, create, duplicate, move left/right/to end, delete empty, delete populated, delete the only stage, archived task migration, race conditions, and replay with the same `requestId`.
4. Test task status-only updates from legacy screens, explicit stage moves (including same-category stages), task creation/duplication, bulk moves, cross-project moves, and recent activity/reporting.
   Verify `duplicate-project` Edge Function with blank, skeleton and full-copy modes: stage names/positions and task IDs must map to the new project, with no foreign stage references. Test failure handling and partially completed copies.
5. Run `npm ci`, `npx tsc --noEmit`, `npm run test`, `npm run build`, targeted eslint, then desktop/mobile authenticated browser checks. **These checks have not been executed in this chat.**
6. Repair any code/SQL failures on the legacy feature branch; do not apply the migration to production until tests, backup and recovery checks pass. Launch from a verified build with a rollback plan.

**Compatibility notes**:
- Task `status` still has the original reporting categories; the user-facing stage name/order is customizable. Two or more stages may share a reporting category.
- Previous category-oriented reports and actions are retained, but categories with no corresponding user-facing stage require explicit verification for the fallback behavior.
- A failed/unconfirmed stage RPC must retry the *same* command/request identity or reload before changing inputs.
- Stage drag-and-drop currently uses the existing task reordering mechanism, which writes task positions across multiple calls. Verify failure reconciliation and improve atomicity if testing reveals partial writes.

## Next features, separate incremental legacy changes

- **Multiple projects per client:** legacy `projects.client_id` and `project_members` support multiple projects. Validate client portal visibility for every assigned project and invitation assignment separately. Avoid granting workspace-wide internal task access.

**No production environment was changed in preparing this branch.**
