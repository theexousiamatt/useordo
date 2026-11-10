# Ordo MVP execution checklist

Priority changed by the user on 10 November 2026. This supersedes nonessential Phase 2 polish and the requirement to pause before starting core production work. Preserve the working Phase 2.0 branch. Deployment was subsequently authorized subject to safety checks on 10 November 2026; the release is blocked. See [CHATGPT-HANDOFF.md](CHATGPT-HANDOFF.md) for current release status.

## Working

- [x] Real authentication and account-scoped caches.
- [x] Studio, independent client-business, client/internal project creation and saved overview.
- [x] Canonical tenant/context schema, one-home-board task constraints, backend permissions, private storage and isolation checks.
- [x] React 19/Tailwind 4/HeroUI foundation; project-creation form family.
- [x] Existing reusable task/card, dnd-kit, deadline/date helpers and behavior tests (legacy views are not canonical production completion).
- [x] MVP increment 1: read canonical project boards/columns/tasks and switch boards from the saved project overview. Resolve context through the authorized project; explicit organization/context query scope and existing RLS remain authoritative. Independent account/project query keys; no legacy task hooks or copied task records.

## Shortest safe route

- [x] Increment 2: authorized create/edit board and column commands, create/edit task, priority/date and multiple assignments. Add transactional ordering and revision/concurrency guards. Prove permission denial and retry behavior before UI writes.
- [x] Increment 3: same-task drag/menu movement within/across home boards, persisted order and reload. Archive/restore; prevent task loss on board/column removal. Safe archive can precede a destructive-removal UI; never silently cascade tasks.
- [x] Increment 4: canonical My Tasks across projects, Due Today/This Week/Overdue/Upcoming and date/project/priority filters using existing date-only semantics. Include open tasks from archived boards.
- [ ] Increment 5: basic client sign-in/project visibility, explicitly published submissions/links, feedback and version-specific approval. One owner may review and approve. Preserve published work on project archive.
- [ ] MVP release gate: broaden regression/browser/device checks; verify client isolation through API/RLS/storage as well as UI; verify persistence/recovery and production configuration. Obtain deployment approval.

## Frozen / post-MVP

Dark mode, nonblocking cosmetic differences, broad component migration, visual perfection, templates, advanced views, product roadmaps/sprints/releases, advanced automation/notification delivery and optional workflow enhancements. Address UI/platform issues only when they block essential work. No new dependencies for this increment.

## Increment 1 handoff

Source: `src/features/foundation/ProductionWorkspace.tsx`, canonical reader in `api.ts`, and opt-in Open production board control in the saved project overview. Uses persisted names and column UUIDs, not fixed Kanban stage labels. Empty/loading/error/retry states included. This increment deliberately exposes no unimplemented task-edit controls and makes no database/schema changes.

Verification: 15 focused workspace tests passed (`npx vitest run src/features/foundation/ProductionWorkspace.test.tsx src/features/foundation/FoundationWorkspace.test.tsx`); typecheck, focused ESLint and diff whitespace checks passed. New tests cover correct home-board rendering and failed/denied-read recovery. Existing SQL/RLS is unchanged; prior isolation verification remains applicable, but this is not new end-to-end mutation or browser certification.

Increments 2 and 3 are implemented: see [write verification](mvp-increment-2.md) and [movement/recovery verification](mvp-increment-3.md). Safe archive is provided; permanent deletion and board/column reordering remain deferred. Increment 4 is implemented: [verification](mvp-increment-4.md). Next action: begin slice 1 from [Increment 5 preparation](mvp-increment-5-preparation.md). Do not repeat the architecture audit or resume cosmetic work. Keep later UI work on canonical readers/commands; never feed canonical IDs into legacy hooks.
