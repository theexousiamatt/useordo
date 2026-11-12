# Ordo — Trello-style stages: Codex verification handoff

**Branch:** `codex/trello-stages-release`  
**Base:** `codex/heroui-v3-proof`  
**Scope:** Canonical project board stages and assigning multiple existing studio members to a project. No live deploy and no hosted SQL changes have been made.

## Implemented

- Existing canonical configurable board/column model retained; separate column names and reporting categories.
- Draggable stage headers, including keyboard-accessible drag handle and isolated collision logic.
- Correct left/right stage reordering, persisted through a new authorized SQL RPC.
- Add/edit stage using existing canonical editor.
- Safe stage removal, requiring an explicit destination if any tasks (including archived) exist.
- Server-side atomic task relocation preserves IDs, assignees, description, due dates, archive state and other task data.
- Column positions compacted and idempotency receipts/audit events recorded.
- React tests for stage order, populated and last-stage safeguards, and failed command retries.

## Changes

- `src/features/foundation/ProductionWorkspace.tsx`
- `src/features/foundation/ProductionDrag.tsx`
- `src/features/foundation/productionDragSensors.ts`
- `src/features/foundation/api.ts`
- `src/features/foundation/ProductionWorkspace.test.tsx`
- `supabase/foundation/migrations/20261111220000_trello_stages.sql`

## Multi-member project team addition

- `src/features/foundation/ProjectTeamPanel.tsx` adds a roster panel to the canonical project board, with multiple selection, project-specific Manager/Contributor/Viewer roles, edits and confirmed removal.
- `src/features/foundation/ProjectTeamPanel.test.tsx` covers selecting multiple existing studio members, role edits and removal confirmation.
- `src/features/foundation/api.ts` now calls `list_project_team` and `set_project_team_member` with scoped, authenticated RPCs.
- `supabase/foundation/migrations/20261112030000_project_team_members.sql` adds the canonical project-team functions. It requires the verified canonical database, not the legacy production database.
- Project owners are protected. A manager cannot assign other managers or remove their own access; an owner can assign project managers. Existing assigned tasks must be reassigned before project membership is removed or lowered to Viewer. Only existing active internal studio accounts appear; **new-account invitations are not implemented in this slice**.
- Multiple projects under the same client business remain supported by the current canonical project model. Client-facing portal publishing and invitations remain outside this code change.

### Additional Codex verification

1. Run the new ProjectTeamPanel tests and the full frontend suite. Address TypeScript and lint problems.
2. Apply the project-team migration after the stage migration to a clean isolated canonical database, and run authenticated integration tests with two or more existing studio users.
3. Test owner, manager, contributor, viewer, unrelated studio user and client-role denial. Confirm a project manager cannot promote another manager or revoke the project owner, and someone from another studio cannot be added.
4. Verify each person can belong to several projects and one project can contain multiple people, with permissions isolated by project.
5. Verify role downgrade and removal are rejected when tasks remain assigned, including archived tasks; reassign first.
6. Verify multi-add retries after partial failure avoid duplicates and successful additions are still visible after refresh.
7. Confirm task assignment menus refresh after changing project members and never expose unauthorized people.

## What Codex should do

1. Check out `codex/trello-stages-release`. **Do not check out `main` or push the artifact branch.**
2. Review the diff against `codex/heroui-v3-proof`, including SQL transaction safety and role-scoped RPC authorization.
3. Run `npm ci`, `npm run typecheck`, `npm run lint:foundation`, `npm test -- --maxWorkers=2`, `npm run test:foundation:safety`, `npm run verify:foundation:local`, and `npm run build:foundation`. Fix any failures on the feature branch.
4. On a **fresh dedicated local canonical Supabase instance**, verify the original six canonical migrations then the new stage migration are applied in the correct order. Do not reset production or replay the legacy migration set. Reconcile the existing hosted migration ledger before **any** hosted application.
5. Execute live database tests as owner, manager, ordinary member, unrelated tenant, and unauthenticated client. Denied users must not reorder or remove stages; no cross-project/tenant mutation must be possible.
6. Test stages: create any number, rename, drag left/right and to end, keyboard reorder, refresh persistence; drag tasks across stages. Test removal of empty, populated, last populated, and archived-task stages, and concurrent edits / stale revisions. Verify the destination category and archived visibility in unified tasks.
7. Test UI desktop/mobile plus task focus, drag handles, error feedback, and retry with original idempotency key.
8. Explicitly confirm the current business/project relationship already allows multiple projects for one client business. **Do not claim the canonical client portal is finished**; the client-only projection and grants are still separate release work.
9. Inspect GitHub Actions runner-start failures before relying on CI. Address dependency advisories and do not ship preview artifacts with placeholder keys.
10. Report pass/fail evidence and exact blockers. Use isolated preview deployment only after release gates pass. Do not modify live `ordo.inspirarestudio.com`, the existing live Supabase project, or `codex/hostinger-static` without a verified cutover plan.

## Known limitations

- The changes were authored via connected GitHub source editing, not by executing a local worktree; **no tests, SQL migrations or builds have yet been run for this branch**.
- SQL function follows the existing canonical authorized SECURITY DEFINER RPC pattern. Validate permissions with actual database tests and Supabase Security Advisor before release.
- The canonical client portal is not implemented in this branch; workflow templates and inviting brand-new studio accounts are deliberately deferred.
- The canonical release continues to be blocked by its existing hosted production safety and CI gates.