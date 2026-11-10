# MVP Increment 3 — movement and recovery

Implemented on the existing isolated branch, 10 November 2026. Increment 2 checkpoint: `905fcf4`. No production changes or deployment.

## Working

- dnd-kit pointer and keyboard movement between canonical columns, including empty columns; movement before/after siblings and Up/Down ordering buttons.
- Cross-board movement through the task editor's Board/Column controls. The task ID, details and assignments are retained; the destination board opens after saving.
- Task and board archive/restore. Archived boards keep all tasks and assignments; archiving a board never marks its tasks complete or archives them. Explicit archive filters provide recovery. Restored tasks append safely to their current home column.
- Authorized transactional movement with revisions, context serialization, order updates, request receipts and audit events. Concurrent stale moves fail instead of overwriting newer work.
- Failed movement retries retain the exact original command/request ID. No optimistic copy of a task is created. Unknown create outcomes freeze editing until the unchanged draft is retried or saved work is explicitly reloaded, avoiding changed-payload retry duplication.

Permanent deletion/removal and board/column reordering remain unavailable. Safe archive is the MVP removal path; no cascade deletion or task-losing shortcut was introduced. This is the approved small core, not the whole original Phase 2 feature list.

## Checks

- **28 focused foundation/editor/drag tests passed**; typecheck, focused lint, foundation build and `git diff --check` passed. The existing large-bundle warning remains deferred; no new dependencies or cosmetic work.
- Six SQL suites passed twice in fresh isolated PostgreSQL instances: schema/ACL, transactions, role/tenant isolation, relational integrity, production writes and production movement/recovery. Includes contributor/configuration separation, multiple eligible assignees, client/cross-context denial, idempotency, stale revisions and archive preservation.
- Real two-connection local PostgreSQL tests passed for concurrent create/edit/move retries, stale edit/move conflicts, concurrent column append ordering, retained assignments and single task identity. Command: `node scripts/verify-production-writes-local.mjs ../ordo` while using the original checkout's guarded loopback runtime. Only the harness's own synthetic verification rows are cleaned up.
- Browser: real saved task moved with pointer and keyboard into empty columns; cross-board move retained the exact task UUID; task archive/restore and board archive/restore retained assignment, priority and deadline; reload preserved the resulting task. Column/board/task editing was also checked for Increment 2.
- Browser evidence: [persisted recovery](evidence/mvp/increment3-persisted-recovery.png). Physical touch devices and broader supported-browser qualification remain release checks; previous PointerSensor touch-event tests are not hardware certification.

Migrations were applied only to the marker-verified loopback stack. Use the proof worktree's canonical migration set to resume that stack; the untouched original checkout's bootstrap deliberately rejects the additional migration history. No remote database action occurred.

## Next

Increment 4: canonical My Tasks, Due Today/This Week/Overdue/Upcoming, project/priority/date filters, retaining open assignments on archived boards. Basic contributor onboarding/project-team management and the client publication/review flow remain MVP work; assignment eligibility is enforced rather than silently granting access.
