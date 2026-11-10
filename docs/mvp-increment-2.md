# MVP Increment 2 — canonical writes

Implemented on the existing isolated branch, 10 November 2026. No production changes.

Working: create/rename boards, create/rename/category-edit columns, create/edit task titles/descriptions/priorities/date-only deadlines and multiple assignees. HeroUI editor retains failed drafts and request IDs, blocks duplicate submissions/pending dismissal, and uses actual server-authorized contributor options. Revoked assignments can be explicitly removed. Column category changes with existing tasks are rejected rather than breaking the task/column FK.

Backend: verified actor, canonical project→context resolution, active context/board, context write and configuration-role enforcement, active internal contribution eligibility for every assignee, preserved one-home-board task IDs, serialized context writes and append ordering, entity revision conflicts, transactional assignments/audit/receipts. No direct table writes granted. Existing board access is inherited from project/context; restricted-board ACLs are not added in this MVP slice.

Checks: 23 focused foundation UI tests; typecheck/focused lint/build; five SQL suites twice in fresh PostgreSQL; real two-connection idempotent create race, stale-write conflict and concurrent column ordering. `node scripts/verify-production-writes-local.mjs ../ordo` uses the original checkout's marker-verified loopback runtime and cleans only its own synthetic verification board/task rows. Original checkout files remain untouched.

Browser: created board and review column, created task with description, urgent priority, date and assignment; edited task and board; reload retained them; renamed column. Evidence: [saved workspace](evidence/mvp/increment2-saved-workspace.png). Multiple assignments additionally checked in SQL and UI tests. A browser-discovered ambiguous assignee lookup was corrected through a forward migration and added to SQL regression coverage.

Migrations were applied only to the marker-verified local stack. That local stack now includes the proof worktree's migrations; use this worktree's migration set when bootstrapping or resuming it. Existing original-checkout bootstrap correctly refuses unknown migration history; do not reset it to bypass this safeguard.

Checkpoint boundary: Increment 2 checks pass; proceed to Increment 3. Broad browser/device/release regression remains the release gate. No deployment authorized.
