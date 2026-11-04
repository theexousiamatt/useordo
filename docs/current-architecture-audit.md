# Ordo current architecture audit

Date: 3 November 2026. Scope: existing repository at HEAD `70f71a2` plus the current uncommitted changes. Requirements: the complete 18-section user brief and the earlier requirement for lasting client access to Figma/Drive submissions and final work.

This is a source and isolated-runtime audit. It does not certify the deployed database, production permissions, email receipt, external file access, browser journeys or restore readiness. No production records were changed. This records the pre-foundation baseline. Phase 1 was subsequently approved and implemented locally; see `phase-1-verification.md` for current evidence.

**Strategy amendment:** The user subsequently confirmed that current application records are disposable. Findings below remain evidence of the current code, but remediation no longer requires legacy data migration or backward-compatible schema paths. Retain useful code/design/behavior, initialize a clean isolated development schema and use synthetic fixtures. Production resets/deletions still require explicit confirmation. See `implementation-plan.md` and `phase-1-foundation.md`.

## 1. Foundations to retain

| Existing capability | Evidence | Assessment |
|---|---|---|
| React/TypeScript application and shared UI | `src/App.tsx`, `src/components/ordo/`, `src/index.css` | Retain the application, routes and established visual conventions. |
| Studio tenancy, authentication and active membership guards | `src/hooks/useAuth.tsx`, `src/hooks/useWorkspace.tsx`, migrations `20261024190000_access_contract.sql` and `20261025090000_scoped_client_invitations.sql` | Extend existing tenancy and scoped invitation infrastructure. |
| Project/assignment/production-board implementation | `src/hooks/useProjects.tsx`, `src/hooks/useProjectData.tsx`, `src/components/projects/ProjectBoard.tsx` | Reuse useful components, comments/labels/assignment behaviors, drawer and interaction patterns. Adapt to clean records; existing IDs/data do not need importing. |
| Deadline filters and personal tasks | `src/pages/Tasks.tsx`, `src/lib/taskDueDates.ts` | Local implementation covers My tasks, today/week/overdue/upcoming, custom dates and secondary assignees. Preserve it. Project/priority filters remain additional work. |
| Atomic task ordering with concurrency checks | `supabase/migrations/20261025130000_atomic_task_order.sql:14` | Useful uncommitted foundation, currently scoped to project and fixed status. Adapt for actual boards/columns; do not overwrite. |
| Client project entry and review transaction | `src/pages/ClientProjectDetail.tsx`, `supabase/migrations/20261008061000_client_reviews.sql:25` | Retain scoped entry and transaction pattern; review must evolve to immutable versions and designated approval capabilities. |
| Email delivery ledger and notifications | `supabase/migrations/20261008063000_smtp_delivery.sql`, `src/hooks/useNotifications.tsx` | Retain delivery tracking and deduplication. Couple business events to durable dispatch. |

## 2. Structural gaps

| Gap | Current evidence | Required change |
|---|---|---|
| Clients are primarily people/accounts | `projects.client_id` references `profiles` in migration `20260529121132_f999064e-9d92-45d2-8d39-1180e4c5522f.sql:31`; `src/pages/Clients.tsx:35` filters client-role members | Define clean client organizations, contacts and explicit library/project access grants. No legacy person-to-business mapping/import is required. |
| Ownership, discipline and lifecycle are not independent concepts | `src/integrations/supabase/types.ts:918` project shape | Define independent ownership, multiple discipline associations and lifecycle, with optional engagements and initiatives. No legacy classification/backfill is required. |
| Boards and columns are fixed | `src/lib/projectConstants.ts:3,36`, `src/lib/boardOrder.ts:12`, ordering RPC lines 41–44 | Add persisted boards, columns, templates and board permissions. Reuse status values as reporting categories rather than column identities. |
| Tasks require project scope | Initial tasks schema, `task_assignees` schema, `src/hooks/useProjectData.tsx:273` | Support lightweight operational contexts without fake projects. Update every related permission/query/assignment path before permitting projectless tasks. |
| Product planning capabilities are absent from the reviewed model | Generated table inventory in `src/integrations/supabase/types.ts` | Add optional task-backed feature/issue classification, sprints, releases, QA and roadmap associations. |
| Reviews target mutable deliverables | `20261008061000_client_reviews.sql:10,25`, `src/components/projects/DeliverablesTab.tsx:87` | Version assets and review packages; distinguish internal clearance, publication, feedback and client sign-off. |
| File authorization is project-wide | `20261025090000_scoped_client_invitations.sql:192–220`; `src/hooks/useTaskAttachments.tsx:26` | Add an explicit publication boundary to file metadata and object access. Internal task attachments currently share this infrastructure. Treat as a launch blocker for expanded client use. |
| Milestone completion has two representations | Internal `useProjectMilestones` reads `status`; client hooks and detail read `completed` | Define one authoritative state directly in the clean schema and update both experiences. No synchronization was found in reviewed migrations; no legacy completion backfill is required. |
| Creation/deletion spans unchecked or separate writes | `src/hooks/useProjects.tsx:166–223`; `supabase/functions/delete-workspace/index.ts:47` | Use authorized transactional commands for database changes and recoverable jobs for object cleanup. Preserve failure details. |
| Staff access remains broad within a studio | Current `can_view_project` and collaborator helpers; hardening docs | Define restricted collaborator/board access explicitly and enforce it in reads, writes, search and files. |

## 3. Visible unfinished controls

| Surface | Finding | Required outcome |
|---|---|---|
| Client Deliverables | `src/App.tsx:80` routes to `ClientComingSoon` | Implement the persistent work library and real submission detail; this is required scope. |
| Client Messages | `src/App.tsx:91` routes to the same placeholder | Implement scoped project conversations and an inbox of shared threads; messages are required by the complete brief. |
| Client Settings/Profile | `src/App.tsx:102`; `UserProfileMenu.tsx` points Profile and Settings to the same route | Supply functional personal account/preferences surfaces, separate from owner-only studio administration. |
| Workspace search | `src/components/client/WorkspaceSearch.tsx:7` has an input with no search state, handler or results | Implement permission-scoped search across supported records, including client library results, or keep the control unexposed until complete. |
| Team View profile | `src/pages/Team.tsx:95–102` displays a toast containing the member's name/email | Open meaningful authorized profile details or remove this action from the shipped menu until implemented. |
| Studio account menu | `OrdoTopBar.tsx` passes `/settings` as both profile/settings destination; `Settings.tsx:34` only allows owners | Give all signed-in users a personal account destination; retain separate owner-only workspace controls. |
| Project milestones | `src/components/projects/MilestonesTab.tsx:8` only reads/displays existing rows | Provide authorized create/edit/complete actions with accurate errors and shared completion state. |
| Approval detail | `ApprovalCard.tsx:79` contains a View button without a handler | Replace with a real version detail/review action. This particular branch is currently dormant because `useActionItems` maps submitted items to awaiting approval. |
| Notification rows | `NotificationButton.tsx:39` renders every row as a button, even if URL is missing | Render information as information, and make actionable notifications open valid authorized destinations. |
| Copy invitation link | `Team.tsx:81` announces success without awaiting clipboard completion | Report success only after the operation completes; show recoverable failure. |

Do not equate every disabled control with a defect: pending saves, permission restrictions and invalid form states are legitimate when communicated clearly. This inventory is source-based, not an exhaustive live click audit.

## 4. Verification baseline

These results describe the audited application and its existing schema, before the clean foundation is implemented. The canonical schema and adapted application must earn their own passing checks; these figures are historical and are superseded for the new slice by `phase-1-verification.md`.

- Frontend tests: 16 files, 89 tests passed.
- TypeScript app check: passed.
- Production build: passed. Existing bundle-size, ambiguous Tailwind duration and Browserslist-age warnings remain.
- Repository lint: failed, 45 errors and 27 warnings. Findings include conditional hook calls in shared form components, explicit-any typing and existing board expression errors. Establish and resolve this baseline before release.
- `npm run verify:access:local`: all repository migrations applied in isolated PGlite with unavailable queue-transport extensions excluded. Access-contract, invitation-preparation, scoped-invitations and atomic-task-order suites passed in rollback transactions.
- Isolated tests represent auth/storage platform tables locally. They do not exercise Supabase Storage bytes, JWT gateways, SMTP, pg_net/cron/vault/pgmq transport, live RLS metadata or provider permissions.
- Prior desktop/mobile checks cover local task/deadline previews with synthetic data. Full application role journeys and production behavior still need verification.

## 5. Release rule

Every visible action must have a complete, authorized and persisted outcome where applicable, plus loading, empty, error and recovery states. A success toast alone is not completion. Verify results after reload and sign-out/sign-in, using the appropriate roles.

Required features receive complete implementations. Optional later capabilities remain absent from navigation until ready. Do not replace Coming Soon with another dead destination or silently remove required workflows.

## 6. Recommended execution order

Approve revised Phase 1; establish verified environment isolation and a clean canonical foundation with synthetic fixtures; adapt the existing Auth/workspace/project setup/list experiences; implement configurable boards and unified operational work; complete publication, materials, conversations and the lasting client library; add product/recurrence capabilities; pass all acceptance scenarios before a separately reviewed production rollout. Normal board moves/deletion must preserve new-system task identity/history; there is no old-data import requirement.

See `implementation-plan.md` for the domain diagram, board rules, permissions, journeys, proposed migration batches, roadmap and verification matrix. Current runtime code and production configuration were not changed by this audit.
