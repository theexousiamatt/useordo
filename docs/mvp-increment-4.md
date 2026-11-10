# MVP Increment 4 — Unified My Tasks

Completed in the isolated worktree, 10 November 2026. Production untouched.

## Working

- `/tasks` lists canonical assignments across the selected studio's client projects, internal projects/initiatives and operational contexts. Me is the default; assignee options come only from tasks the current account may read.
- Due Today, Due This Week, Overdue, Upcoming and No Due Date reuse the existing date utilities and midnight refresh hook. Weeks are Monday–Sunday; dates stay local date-only strings. Upcoming retains the existing utility's inclusive-today behavior.
- Context/project, priority, underlying status category and assignee filters persist in the URL. Counts apply the same filters and count a task once even when it has multiple assignees.
- Individually archived tasks are excluded. Completed work is excluded by default and from every open deadline bucket; it is available explicitly under Completed/All statuses with the All deadline view. Open assignments on archived boards remain visible.
- Titles open the existing canonical editor. Read-only assignments open disabled details without a save command. Archived home boards remain visible; saving requires an active destination board or restoring the home board first.
- Unboarded operational tasks edit through a context-authorized command with assignment eligibility, revisions and receipts; they never require a fake project/client/board. Operational task creation/onboarding is outside this increment.
- Saved changes invalidate the account/studio's canonical board, My Tasks and context caches together. No legacy task hooks or duplicate task tables were connected.
- Loading, empty, denied/error, retry and saved states are functional. Layout uses existing Ordo controls and surfaces; no new dependencies or cosmetic migration.

## Verification

- **60 focused frontend tests passed** across foundation/editor/filter/cache and existing date tests; typecheck, focused lint, foundation build and whitespace checks passed.
- **Seven canonical SQL suites passed twice** in fresh isolated PostgreSQL. New coverage includes project/context/tenant read isolation; clients denied internal unified reads; operational revision/idempotency and assignment checks; read-only assignments; archived-board visibility and individual archive exclusion.
- Real local browser verified client and internal project assignments plus an unboarded operational assignment, combined filters after reload and a fresh sign-out/sign-in, completed/open separation, archived-board visibility, project deadline edits changing counts, identical task UUID across board/My Tasks, board-to-My Tasks priority updates, and operational title/status edits surviving reload.
- Desktop 1280px and mobile 390px layouts were inspected. At 390px the document width was 390px: no horizontal page overflow. [Desktop evidence](evidence/mvp/increment4-my-tasks-desktop.png), [mobile evidence](evidence/mvp/increment4-my-tasks-mobile.png).
- Browser verification uses clearly labelled synthetic `MVP ...` records in the marker-verified loopback database. The migration was applied only there. Existing original-checkout bootstrap continues to reject additional migration history until it has the full canonical migration set; do not reset to bypass this safeguard.

Existing large-chunk warning and physical-device/cross-browser release qualification remain deferred release items. There is no new blocking failure in the verified Increment 4 scope.

## Next

Increment 5 preparation is recorded in [the client-experience handoff](mvp-increment-5-preparation.md). No new architecture audit or wider design-system work is required.
