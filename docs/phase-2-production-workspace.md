# Phase 2 — Customizable Boards and Unified Task Management

Status: proposed for approval, updated 4 November 2026. Planning only: no Phase 2 application code, migrations, database records or runtime configuration have been changed. Production remains outside this scope.

## Outcome and scope

Turn the verified canonical foundation into a usable studio production workspace:

**Open a project → configure its boards → create and assign work → move and complete the same tasks → find those assignments in My Tasks and deadline views.**

This phase combines configurable boards from the original Phase 2 with the first operational part of the former Phase 3. Both internal and external projects use the same infrastructure. Include lightweight operational assignments without fake projects so Unified Tasks also accommodates studio work. Deliver the phase through small implementation increments, but do not declare it complete at the point where boards merely render.

HeroUI v3 adoption has a prerequisite platform gate at **2.0**, before increments 2.1–2.5. The [compatibility audit](frontend/heroui-v3-compatibility.md) identifies the current React 18/Tailwind 3 application as incompatible with a drop-in installation. An isolated React 19/Tailwind 4 package proof is under evaluation in a separate worktree; it does not establish that the main application has been upgraded or authorize a broad primitive replacement. Review that evidence and the bounded adoption scope before changing the application's platform.

Included:

- Board/column configuration, ordering, duplication, archive/restore, safe removal and reusable private/studio board templates.
- Canonical task creation, editing, multiple assignees, priority, date-only deadlines, workflow position, task/issue/feature kind and individual task archive/restore.
- Task movement within and between boards of the same work context; pointer, keyboard and menu controls; checked bulk movement/assignment/archive for authorized selections.
- Shared project Board/List views, canonical task detail and Unified Tasks with My Tasks, deadline, project/context, priority, assignee and category filters.
- Minimal project-team assignment of existing studio members, scoped board access, transactional commands, history and concurrency protection.
- Basic operational-context creation by authorized studio managers and unboarded operational tasks using the same task records and deadline queries.

Not included in this increment: cross-project/context task transfers; secondary home boards; copying tasks when duplicating boards; full invitation/account administration; comments, labels and attachment upload workflows; dependencies/submissions; client publication/review; automated email delivery; recurrence; sprints/releases; Calendar/Timeline/Roadmap; workflow automations or WIP limits. Keep unimplemented controls absent from the canonical slice. Existing legacy functionality remains in its current mode until deliberately adapted; canonical IDs must never enter incompatible legacy hooks.

## 1. Findings and code to retain

| Existing foundation | Phase 2 treatment |
|---|---|
| Canonical organizations, work contexts, boards, columns, tasks and assignees | Extend these tables. Preserve composite tenant/context keys and the requirement that project tasks have one home board and column. Operational tasks may remain unboarded. |
| Stable task categories and column UUIDs | Keep identity separate from category. Two different columns may both map to review. Editable titles never drive status logic. |
| Read-only RLS plus authorized creation commands, verified actors, receipts and audit events | Add narrowly authorized mutation commands and narrower board/task read policies. Retain direct-write denial. |
| Applied Phase 1 migration/checksum ledger and private Storage policy | Add forward canonical migrations. Do not edit the applied baseline, reset production, or replay historical legacy migrations. |
| Foundation organization selection, Auth/cache isolation and environment gate | Extract a shared canonical workspace context/layout. Add routes for real production views without mounting legacy WorkspaceProvider or task repositories. Include work_context_id in project read types. |
| ProjectBoard, OrdoTaskCard, task drawer and Ordo menus/form controls | Reuse composition, appearance, drafts, selection, drop indicators and error patterns. Extract presentation contracts from legacy TaskRow, fixed TASK_COLUMNS and embedded data hooks. |
| Existing dnd-kit, React Query, date-fns and test tooling | Retain the domain/query/date tooling and verify it against the platform selected at 2.0. HeroUI supplies reusable controls, not a board implementation. No third-party board UI kit, new state framework or ranking service. |
| boardOrder, boardFilters, taskDueDates, useLocalDateKey and existing tests | Preserve useful behavior and assertions. Ordering uses actual board/column IDs; deadline matching uses canonical category through one shared adapter, not editable column names. |

The current schema does not yet provide task writes, board configuration commands, board ACLs, templates or concurrency revisions. Its task/column foreign key also requires a deliberate migration for atomic remapping of a populated column's category. This includes replacing immediate RESTRICT update behavior with a deferrable NO ACTION relationship and deferring its validation only inside the remap transaction. PostgreSQL documents that distinction in its [foreign-key constraint reference](https://www.postgresql.org/docs/17/ddl-constraints.html#DDL-CONSTRAINTS-FK). Existing task-assignee validation checks studio membership but must additionally check eligible context/board access.

## 2. Production rules

### One authoritative task

A task has one stable ID and one immutable tenant/context. For project tasks, board_id and column_id identify exactly one home workflow; category is derived from that column by the server. My Tasks, Board, List and deadline views reference this record. Assignees are associated with this task ID; they are not task copies.

A cross-board move changes placement, derived category and order together. Preserve description, priority, deadline, assignees, history and future child references. Do not implement cross-project/context moves in this phase: those also change access, assignments and contextual references.

An unboarded operational task can change its canonical category directly through an authorized command. A boarded task cannot change category independently of its actual column. A generic task patch cannot change organization, work context, board, column or category.

### Configurable workflows

Keep the five existing categories: backlog, todo, in_progress, review and done. Names such as Testing, Internal Review and Published are independent column labels. Multiple columns may share a category; projects need not instantiate every category. Task review status is a production stage, not client approval or an immutable review decision.

Allow a blank board/zero-column empty state with a real Add column action. Task creation requires an active destination column. If no active boards remain, show Create board rather than inventing a hidden board. No populated last board/column can be removed without an explicit valid destination.

Changing a column title leaves category, task IDs and completion unchanged. Changing the category of a populated column requires an affected-task/completion preview and one authorized transaction updating the column and all its tasks, including archived tasks. No two independent frontend updates.

A task's completion control respects actual configuration. With one eligible done column it may move there; with several it asks which one; with none it offers an explicit move to an available done column on another authorized board or explains the required board configuration. Reopening chooses a real non-done column. Never hardcode a column title/ID or update category alone.

### Archive, delete and recovery

| Action | Required behavior |
|---|---|
| Archive board | Preserve the board, columns and every task. Hide it from default board navigation; make its board view read-only. Open tasks remain in My Tasks and deadline views with an Archived board indicator. Task details remain readable, but ordinary edits/assignment/completion/reordering are blocked until the task is explicitly moved to an active authorized board or a manager restores the board. The authorized move-out command is the deliberate exception to the frozen source board. Explain this before archiving. |
| Restore board | Restore the same IDs, configuration, access rules and task placement. Resolve navigation order transactionally. Do not revive tasks that were individually archived. |
| Duplicate board | Copy configuration into new board/column IDs with zero tasks, assignments or private references copied. Default the new board to the same access mode; for a restricted board, require an explicit member selection, initially the creator only. Preview access before save. |
| Remove populated column | Require a destination column in the same board. Preview category/completion effects and include individually archived tasks. Reassign every task atomically, then mark the old column deleted. Reject stale mappings and inaccessible/archived destinations. |
| Delete populated board | Require a complete mapping of its occupied columns to active authorized destination columns in the same context. Preserve every task, including individually archived tasks. Validate destination assignees/access, move the records and mark the board deleted in one transaction. Retain its columns under the deleted parent; previously removed columns keep their own removal state. Offer Archive as the simpler alternative. Cancel/failure changes nothing. |
| Delete empty board/column | Confirm removal, verify the authoritative count includes archived tasks and pass dependency checks. No task deletion or cascading cleanup. |
| Retention | Use deleted_at tombstones for removed configuration in Phase 2. No hard purge command. Keep IDs/history recoverable. Managers can restore a deleted board from Recently deleted into the archived collection; its retained, non-deleted columns return with it. Restore an individually removed column as an empty column on an active board, or restore its parent first. Restoring configuration never moves tasks back, clears an earlier column removal, or undoes later work. |
| Archive/restore task | Preserve the task ID, assignments and history. Individual archive removes it from open-work filters; explicit Archived tasks access supports recovery. Restore requires a valid active home column, choosing a replacement when necessary. |

Board archive is not task archive or task completion. In particular, do not hide overdue work merely because its board is archived.

### Assignments and access changes

A new assignee must be an active internal studio member with contribution access to the context and board. View-only membership is insufficient for new production assignment. Later access revocation preserves historical assignment records but removes visibility and prevents new task writes; affected work is flagged for managers to reassign. Assignment does not grant access. A project manager can add existing studio members to the project as contributors/viewers through a scoped command before assignment; this does not change studio roles or send account invitations.

For a move into a restricted board, preserve assignments if everyone remains eligible. Otherwise reject with an actionable validation result; a manager must explicitly resolve membership/assignment changes. Never silently drop assignees or grant new access. Broader visibility requires a clear access preview and management authority over both source and destination; ordinary moves between equally visible boards need normal task-write authority.

## 3. Proposed database changes

All names below are proposed contracts, to be finalized in implementation review. Add ordered migrations under supabase/foundation/migrations; leave the applied 20261103000100 baseline unchanged.

| Batch | Changes and reason |
|---|---|
| P2-A — Configuration and access | Add work_contexts.board_revision; boards.revision, updated_at, deleted_at, access_mode and optional template-version origin; board_columns.deleted_at/updated_at. Add tenant/context-consistent board_memberships with viewer/contributor/manager scope. Add configuration-only board_templates, immutable board_template_versions and ordered template columns. Templates are private by default; studio publication is explicit. Extend the existing capability catalog with operations.create (owner/admin/manager by default) and templates.publish (owner/admin by default), using existing scoped grants rather than new studio roles. |
| P2-B — Task integrity and commands | Add tasks.revision and completed_at, constraints tying completion to category, immutable tenant/context identity guards for production entities, stable order uniqueness and lookup/filter indexes. Adapt the existing task-column/category FK for one controlled transaction that can remap a populated category without an inconsistent committed state. Derive completion on create/move/remap; preserve its timestamp on done-to-done moves, clear it on reopening, record every transition. |
| P2-C — History, queries and security | Extend existing audit_events with bounded, server-generated change details and tenant-consistent context/board/task scope. Task events follow current task read permission; board configuration events require board permission. Never allow a broad context fallback to disclose restricted task events. Historical source/destination IDs do not constrain a task to its former board. Extend command_receipts with the committed acknowledgment needed for retries. Add eligibility/board/task/asset helpers and replace context-only board/task/assignee/event policies with the appropriate narrower predicates. Add optional task_id to assets with a composite context/task FK so task-bound private files follow task authorization; general project assets retain context scope. No upload UI is added. |
| P2-D — Local tooling and fixtures | Update canonical types, schema identity/gate, verified bootstrap/reset expectations, new-table reset allowlist and fixture/test contracts together. Recognize the known v1 ledger only for a verified local forward upgrade; require the new schema identity for Phase 2 operation. Repeated bootstrap/seed must remain safe. Expand fixtures with Lora Design/Development/Marketing, Devine branding/web work, operational assignments, multiple assignees and restricted boards. |

Ordering remains integer-based. Reindex affected collections transactionally; do not introduce fractional ranking infrastructure without evidence it is needed. Defer applicable unique checks while changing order and validate them before commit. Retained archived/deleted configuration can occupy distinct order slots; visible gaps are harmless. Give every task row, including individually archived rows, a distinct stable position within its home column. Unboarded operational tasks share a separate ordered collection within their operational context. Server reindexing accounts for retained rows; visible gaps are harmless. Reordering active board/column collections also accounts for retained configuration slots. Do not use partial unique indexes as though they were deferrable constraints.

Templates store only validated names, column order, category mappings and supported defaults. They contain no task bodies, IDs, files, assignees or board membership grants. Saving a private template and explicitly publishing a studio template use separate permissions. Applying/duplicating configuration creates fresh IDs. A later template version never rewrites an existing board automatically.

### Authorized command surface

| Area | Commands |
|---|---|
| Board lifecycle | create_board, rename_board, reorder_boards, duplicate_board_configuration, archive_board, restore_board, delete_board_with_reassignment, restore_deleted_board_configuration |
| Columns | create_column, rename_column, reorder_columns, remap_column_category, remove_column_with_reassignment, restore_deleted_column_configuration |
| Task work | create_task, update_task_fields, set_task_assignees, move_task, archive_task, restore_task; bounded atomic bulk equivalents where exposed |
| Team/access | list_eligible_assignees, set_context_member for existing internal members, set_board_member and set_board_access_mode; no studio-role self-promotion |
| Templates/operations | save_board_template_version, publish_studio_template, create_board_from_template; create_operational_context and canonical unboarded-task creation |
| Reads | Permission-scoped project/context board queries, task detail/history, paginated unified-task query and matching authorized counts |

Mutations accept a request ID, relevant expected revisions and typed/bounded fields. A move supplies destination column and neighboring task IDs for placement. The server derives tenant, context, destination board and category from trusted rows; it never trusts a client-supplied status/tenant mapping or full client reorder of an incompletely loaded board.

Commands return authoritative affected IDs, placements/revisions and a committed acknowledgment. A missing or unauthorized target is an error, not a success toast. An authorized operation that already matches the requested state can return an explicit no_change acknowledgment without a revision/history increment; it must not claim a new mutation occurred. Assignment success confirms the saved assignment, not delivery of a notification. No browser-originated legacy email dispatch or generic authenticated UPDATE/DELETE grants.

### Concurrency and retry protocol

1. Validate the verified caller and normalized command payload; take the actor/command/request idempotency lock.
2. Lock the work-context aggregate, then affected boards and tasks in deterministic ID order. All Phase 2 structural, task and context/board membership commands use this protocol. Keep each transaction short and single-context.
3. Recheck current permissions, active/archive/deleted state, assignee eligibility and expected revisions after acquiring locks. Organization-membership revocation must serialize appropriately with authorized writes; a completed revocation cannot leave a later command using stale authorization.
4. Apply placement/category/completion/order/assignment changes atomically. Increment task revisions for task changes and board revisions for configuration/access/placement changes; increment the context collection revision for board lifecycle/order changes. Write history and the receipt in the same transaction.
5. Return a distinct conflict result for stale state without partial changes. The UI refreshes authoritative placement and retains unsaved text. It never automatically overwrites another person's edit.
6. An identical lost-response retry returns the original acknowledgment without duplicate tasks/history/revision increments, after rechecking present access. A changed destination, payload or expected revision needs a new request ID. Undo is another checked command using current revisions, never a stale snapshot restore.

Tests must prove opposite-direction board moves and simultaneous reorder/archive/delete cannot deadlock or leave partial state. Start with correctness and modest per-context serialization; optimize only if measured contention warrants it.

## 4. Permission model

Board permissions narrow parent-context access. A board grant never creates project access, and a task assignment never creates either. Owner/admin studio-wide authority remains explicit. Role labels alone do not replace effective capability checks.

| Actor | Read | Task work | Board configuration/access |
|---|---|---|---|
| Studio owner/admin | Studio production, including restricted boards | Manage | Manage; team/access administration |
| Context owner/manager | Their managed context and its boards | Manage eligible assignments and production | Configure, archive, restore, safely delete and manage existing-member access within the context; no studio-role escalation |
| Context contributor | Inherited boards and explicitly granted restricted boards | Create/edit/assign/move visible tasks where effective write access allows | Only with an explicit board-manager grant; context-wide creation/order stays with context owner/manager or studio administrators. Access administration is separate from configuration. |
| Context viewer | Authorized read scope | None | None |
| Restricted collaborator | Active internal membership plus parent scope and explicit board grant | Only granted contribution scope | None by default |
| Client/anonymous/inactive/revoked | No internal production rows or commands | None | None |

Context managers may add/remove existing internal contributors/viewers; transferring project ownership or promoting new managers is outside this increment. Granting board-configuration/access authority is limited to the context owner/manager or studio administrator. Board-specific managers may configure their authorized boards/columns but cannot change ACLs, broaden visibility, create unrelated boards or grant themselves broader parent/studio rights. They cannot reorder the global board collection from a partially visible list.

Apply the same task predicate to task rows, assignee rows, counts, search/filter results, detail/deep links, history and task-linked asset bytes/new signed URLs. Board and board-membership queries must require board access; template version/column queries inherit template privacy, including direct ID requests. Assignment pickers return only eligible members and the limited profile fields needed for assignment. Do not provide a context-level fallback that leaks a restricted board's rows. Current project-level files remain project-level files, not implicitly private task attachments. Previously issued signed URLs retain their documented expiry behavior.

## 5. Frontend tasks and user journeys

### A. Project production workspace

- Extend the foundation project page with functional Overview, Board and List navigation. Board selection uses saved board IDs, with account/organization/context-scoped preferences and safe fallback if a board becomes unavailable.
- Reuse Ordo's current card surfaces, typography, menus, drawers, spacing, icons and motion conventions. Extract a presentation-only board/card/drawer API; canonical controllers use their own typed repository and commands.
- Offer blank board, duplicate configuration and saved template creation. Supply real board/column rename/order/archive/restore/delete controls and management previews. Keep active, archived and recently deleted collections clearly separate.
- Use a shared task drawer from Board, List, Unified Tasks and a canonical /tasks/:id deep link. Validate access before rendering data. Opening operational work must not assume project_id or invent a project route.
- Show exact fields supported in this phase: title, description, kind, assignees, priority, due date, home board/column, canonical category and recorded task history. Preserve drafts and dirty-close protection. Do not mount legacy comments/attachments/labels tabs with canonical IDs.

### B. Movement and ordering

- Reuse installed dnd-kit pointer/keyboard mechanics and existing drop indicators. Persist within-column and cross-column moves, including empty destinations, using canonical IDs and the same command path as menu moves.
- Provide Move to board/column, Move up/down and Top/bottom without dragging. Provide board/column order controls and touch-friendly select mode for bulk actions.
- Permit manual reorder only with manual sort and no task filter hiding intervening work. In filtered/sorted views, keep explicit Move to available and append according to the authoritative server order. Never renumber only the visible subset.
- Paginate server reads and expose Load more/complete counts honestly. Anchor-based server placement must remain valid when not all tasks are loaded; do not silently lose tasks at the API row limit.
- Optimistic movement uses a pending marker and a snapshot confined to affected cached data. On failure, roll back only if that cache still represents this pending operation; if another fetch/mutation has advanced it, refetch/reconcile instead of overwriting newer state with a snapshot. Confirm success only after acknowledgment. Reconcile returned placement/revisions and invalidate the shared task detail, project/list, My Tasks and counts.
- Refresh visible queries on focus/reconnect and at a bounded interval (proposed 15 seconds); do not add Realtime infrastructure as a dependency of this phase. Clear unavailable data after authorization failure. Backend revocation is immediate regardless of frontend refresh timing.

### C. Unified Tasks

One canonical task repository serves both project views and the workspace task list. Default My Tasks matches the current account in any assignee position across authorized client/internal/operational work in the selected studio. Clearly label an authorized All Tasks scope; it does not imply access to the whole studio for contributors.

Provide My Tasks, Due Today, Due This Week, Overdue, Upcoming, No due date and custom date ranges. Combine them with project/context, board, assignee (including Unassigned), priority and category filters, search and supported sorting. Status category and actual column are separate filter concepts. Keep counts and pagination aligned with the exact authorized filter, including more than 1,000 matching records in the verification fixture.

Preserve the established date-only semantics:

- Today follows the user's local calendar; deadlines are YYYY-MM-DD, not UTC midnight instants.
- Due This Week is the inclusive Monday–Sunday calendar week, including earlier dates in the current week.
- Overdue is before today. Upcoming includes today onward, matching current behavior.
- Custom date ranges are inclusive and may be open-ended; reject reversed ranges. No due date is separate.
- Dated open-work filters exclude done and individually archived tasks. Board archive alone does not exclude open assignments. Include a deliberate completed/archived-work view rather than losing recoverability.
- Keep midnight/focus refresh and timezone/DST boundary regression tests.

### D. Accessible states

Every exposed action has validation, pending, success and recoverable failure states. Distinguish a genuinely empty board/list from a loading or failed query. Retain cached content with an error notice on background-refresh failure; retain failed creation/edit drafts. Announce conflicts and keep a useful retry path.

Keyboard users can create/configure/move/assign/archive/restore without a pointer. Maintain visible focus, accessible menu/dialog names, dialog focus containment/return and live announcements for movement/cancellation/failure. Restore focus to the moved task, or a stable list/column control if filtering removes it. Touch scrolling must not accidentally drag; support reduced motion, zoom and narrow layouts without requiring drag gestures.

## 6. Implementation sequence and reviewable checkpoints

### 2.0 — HeroUI compatibility and control foundation

Review the isolated proof against the [HeroUI v3 compatibility audit](frontend/heroui-v3-compatibility.md) before beginning the main-app platform upgrade. The reviewed scope must identify the React/DOM/type and Tailwind/style-engine changes, incompatible peer-package decisions, browser support and the first control families. A package demo alone is insufficient, and whole-application primitive replacement is separate scope. Retain the existing Ordo composition, feature controllers, permissions, request IDs and persistence logic.

For an approved adoption slice:

- Pin the tested HeroUI React/styles, React/DOM/types, Tailwind/plugin and affected peer versions in the lockfile. Record the official v3 [agent guide](https://github.com/heroui-inc/heroui/blob/v3/skills/heroui-react/SKILL.md) and component documentation used, including retrieval date and source revision where available. Follow the current v3 compound/control APIs; this application is not a HeroUI v2 migration. Resolve peers normally rather than using force or legacy-peer-deps.
- Establish namespaced Ordo full-color tokens and an explicit adapter for incumbent HSL consumers, HeroUI components and portal roots. Preserve Auth/root and light workspace themes, typography, spacing, dimensions, focus treatments and reduced motion. Do not mount two Tailwind resets in one document.
- Prove the core button, text/password/textarea, selection and drawer/dialog contracts before building production feature screens. Preserve single-submit behavior, controlled IDs/values, labels/errors/refs, disabled/pending states, failed drafts, request-ID reuse and dirty/pending dismissal guards. Test a HeroUI selector inside a retained Radix sheet for focus containment/return, Escape, outside click, portal colors and scroll lock. Verify menu interaction and dnd-kit pointer/keyboard transforms together.
- Run application TypeScript, touched-file lint, the current frontend regressions, foundation safety/SQL checks and both builds. Recheck real isolated sign-in → authorized studio → client/internal creation → saved overview after reload/fresh sign-in, account switching/client denial, and retained deadline/drawer behavior. Capture desktop/mobile and supported-theme evidence. A synthetic package proof cannot replace these main-application checks.
- Preserve the current dirty source checkout and index through a reviewed checkpoint/worktree, as specified in the audit. Keep platform/dependency changes, the token/theme bridge and each feature/control family in separate commits. Record exact checkpoint and tested revisions; rollback reverts only the adoption commits with their matching lockfile/source, without stash/reset/clean of existing work.

Complete and review this gate before progressing to 2.1–2.5. It adds a UI-platform prerequisite; every business-integrity criterion below remains required.

| Increment | Tasks | Exit check |
|---|---|---|
| 2.0 HeroUI platform and controls | Review the isolated React 19/Tailwind 4 proof; approve a bounded adoption slice; establish compatible peers, Ordo tokens/portal theme, core controls and overlay/drag behavior with pinned versions | The reviewed main-app adoption passes platform/control, real foundation and retained interaction regressions, both builds and a recorded rollback plan before 2.1–2.5 begin. No whole-app primitive migration is assumed. |
| 2.1 Schema and command contract | Forward migrations; revisions/order/category invariants; scoped board/task reads; team eligibility; receipt/history changes; local bootstrap/gate/allowlist upgrade | Empty bootstrap and v1→v2 development upgrade pass; rollback/idempotency/role tests prove invariants before UI writes are enabled. |
| 2.2 Board configuration | Canonical board repository/controller; blank/template/duplicate flows; columns, access, archive/restore and safe removal previews | A PM configures three different Lora boards and survives reload; removal/recovery preserves every task. |
| 2.3 Canonical task work | Shared editor/detail route; CRUD/assignment/priority/date/category semantics; team selection; task archive/restore/history | A PM assigns Devine and Lora work to the same creative; changes persist and do not call legacy hooks. |
| 2.4 Movement and unified work | Actual drag/drop and non-drag movement; Board/List; shared filters/counts/pagination; My Tasks; lightweight operations | One task ID appears consistently across its home board, project list, drawer and deadline views. |
| 2.5 Qualification | Simultaneous editors, fault injection, permission revocation, archive/delete/recovery, responsive/keyboard/touch checks; focused lint/types/builds/CI | Every acceptance criterion below passes with recorded evidence. No decorative or Coming Soon controls. |

Keep each increment testable. The Phase 2 proposal includes the 2.0 prerequisite and increments 2.1–2.5. Main-app platform adoption proceeds only after review of the isolated proof and its bounded migration scope; approval does not imply replacing every existing primitive. No production cutover or unrelated rewrite is included.

## 7. Acceptance criteria

| ID | Required result |
|---|---|
| P2.0 HeroUI integration gate | A reviewed, pinned compatible platform and bounded core-control adoption preserve Ordo tokens/themes and real Phase 1/Auth/task interactions; nested overlays, keyboard/pointer behavior, drafts/retry and pending guards pass. Current automated checks and both builds pass with desktop/mobile evidence and separate platform/token/feature rollback commits. The isolated proof alone does not satisfy this criterion. |
| P2.1 Configuration | Create/rename/reorder multiple boards and custom columns; changes survive reload and fresh sign-in. Blank states have functional setup actions. |
| P2.2 Independent columns | Two differently named columns sharing review remain distinct. Renaming/reordering never changes task identity or completion. Populated category remapping updates all affected tasks atomically with explicit impact confirmation. |
| P2.3 Templates/duplication | Duplicate/save/apply configuration with fresh IDs and zero copied tasks, assignees, grants or private references. Private/studio template access and immutable versions work; existing boards are not silently updated. |
| P2.4 Task work | Title, description, kind, multiple assignees, priority, date, placement and completion/reopening persist. A secondary assignee sees the task in My Tasks. Assignment never silently grants access. |
| P2.5 Movement | Same-column order, cross-column and same-context cross-board moves persist with the same task ID and retained data/history. Empty destinations work; foreign tenant/context IDs and archived/deleted destinations fail. |
| P2.6 Safe removal | Populated-board/column removal requires a complete disposition, including archived tasks. Reassignment and removal succeed together or not at all. No command deletes underlying tasks; deleted configuration has explicit recovery. |
| P2.7 Board/task archival | Board archive preserves task IDs and open deadline visibility with an indicator. Board restore recovers configuration. Individual task archive/restore is distinct; completed tasks never become active accidentally. |
| P2.8 Unified workspace | Client/internal/operational tasks use shared canonical queries and commands. A task edited from Board, List, detail or My Tasks changes everywhere; operational tasks need no fake client/project. |
| P2.9 Deadline filters | Today/week/overdue/upcoming/no-date/custom, project/context, priority and assignee filters/counts match agreed semantics across month/year/DST/midnight boundaries and secondary assignments. No silent API-row truncation. |
| P2.10 Concurrency | Two simultaneous drags/edits, opposite-direction moves, reorder vs create and archive/delete vs move produce a valid complete result or an explicit conflict, with no lost updates or partial rows. |
| P2.11 Reliable retries | Lost-response replay creates one result/event set; changed payload/revision is rejected. Failed saves preserve drafts; optimistic failure rolls back; Undo cannot overwrite intervening work. |
| P2.12 Permissions | Two studios, owners/admins, context managers, contributors, viewers, scoped collaborators, two clients, anonymous and revoked members get correct table/RPC access. Restricted task content/counts/history/assets never leak through another view. Current access is checked on replays. |
| P2.13 Accessible UI | Required workflows pass keyboard-only, menu alternatives, touch selection, 390px mobile, desktop, zoom/reduced-motion and focus/error-announcement checks. Preserve Ordo styling and responsive reading order. |
| P2.14 Regression/environment | Phase 1 scenarios and existing deadline behavior pass alongside new tests; touched/extracted code passes lint, TypeScript and both builds. Applied baseline checksum and production files/resources remain unchanged. |

## 8. Verification plan

| Layer | Evidence |
|---|---|
| HeroUI/platform prerequisite | Reviewed isolated proof plus the 2.0 main-app gate: pinned normal peer resolution, official v3 documentation, token/portal comparison, core form/event/overlay contracts, retained task/dnd-kit behavior, real foundation journeys, all current frontend regressions and both builds. Record supported browsers/themes, unexercised cases and checkpoint/rollback revisions. |
| Pure/unit | Column/category identity, generalized ordering/anchors, completion/reopening, draft/request-ID behavior, date boundaries and combined filters. Adapt existing meaningful deadline/order tests; do not duplicate implementation assertions. |
| Canonical SQL | Fresh chain twice; v1 forward upgrade without resetting fixture data; RLS/ACL and tenant/context/column constraints; all command success/denial, idempotency, stale revisions, failed reassignment, archival/deletion, assignment eligibility and rollback of history/receipts/revisions. Reset allowlist and marker guards include new tables/version. |
| Real local Supabase | Real Auth sessions and REST/RPC calls as the full role matrix; direct writes denied; private board task/assignee/history/count queries and deep IDs; revoked access without token refresh; task-linked Storage download/new signed URL denial with a prior positive control. Never substitute PGlite stubs for these checks. |
| Independent concurrent sessions | Synchronize two database/API sessions to exercise same-task moves, opposite-direction board moves, different-task edits, category remap, ordering, revocation and delete/move races. Check final unique order, task/assignee IDs, revision/history counts and rollback. |
| Frontend integration | Canonical repositories/controllers, shared invalidation, account/workspace/board switching, filters/pagination, empty/error states, preserved drafts, conflicts, filtered movement, keyboard alternatives, unavailable tasks and no legacy-hook execution. |
| Browser journeys | Lora Design/Development/Marketing; Devine PM assigns/updates work; a creative finds internal/client/operational assignments due today/week; populated column/board reassignment plus restore; restricted collaborator and client denial. Reload and sign out/in after changes. Capture desktop/mobile evidence. |
| CI/local quality | Extend the existing foundation workflow for the new SQL/frontend/safety checks, touched-file lint, types and standard/foundation builds. Record real-runtime browser/concurrency evidence separately; CI configuration alone is not a passing run. |

Known Phase 1 repository-wide lint and dependency findings remain tracked in phase-1-verification.md. No implementation tests were run for this planning-only document update. Resolve violations in files changed/extracted for this phase; do not hide them or claim the entire repo is clean. Broader release remediation stays explicit. Do not mix forced dependency upgrades or production operations into Phase 2.

## Approval requested

Approve the complete Phase 2 scope, including the reviewed 2.0 compatibility prerequisite, operational rules, forward database changes, acceptance criteria and verification plan above. The proposed defaults include configuration templates, restricted board access, same-context moves, explicit reassignment before deletion, retained configuration recovery, and basic projectless operational assignments. The isolated HeroUI proof remains evidence for review; a broad main-app migration or whole-application primitive replacement is not implicitly authorized. Approval authorizes the explicitly reviewed development implementation and testing only against the isolated verified foundation. It does not authorize resetting/deploying production, editing its migration ledger, deleting live users/files, or implementing the deferred modules.
