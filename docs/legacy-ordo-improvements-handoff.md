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

## Next features, separate incremental legacy changes

- **Trello-like custom project stages:** current `src/components/projects/ProjectBoard.tsx` renders fixed `TASK_COLUMNS` and `TaskStatus` enum from `src/lib/projectConstants.ts`. To enable arbitrary labels/order/number, create a project-scoped stage identity (not merely rename the enum). Review all task mutations, filtering, reporting, automation and database checks/RLS before schema change. Backfill existing projects without changing their tasks; test rollback and status migration; retain cross-project drag/drop and archive behavior.
- **Multiple projects per client:** legacy `projects.client_id` and `project_members` support multiple projects. Validate client portal visibility for every assigned project and invitation assignment separately. Avoid granting workspace-wide internal task access.

**No production environment was changed in preparing this branch.**
