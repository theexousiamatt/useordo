# Revised Phase 1 — isolated clean foundation

Status: approved in this conversation and implemented locally, 3 November 2026. The isolated development slice is verified. Production has not been reset, migrated or deployed. See `phase-1-verification.md` for acceptance evidence and remaining release work.

## Outcome

Deliver one usable foundation inside the existing Ordo application:

**Sign in → enter an authorized studio workspace → create a client or internal project → reopen its saved overview.**

Use a clean canonical database in an isolated nonproduction environment. Preserve useful components, Auth integration, layouts and interaction behavior. Existing records are disposable and will not be imported.

## Scope

1. **Environment separation.** Verify a dedicated local/development Supabase target with separate database, Auth configuration, credentials and private storage. Record target identifiers without exposing secrets. Identify production so reset tooling can reject it. If no isolated target is available, establish one before executing any reset or schema command.
2. **Canonical schema blueprint.** Define organizations/memberships/capabilities, client businesses/contacts/access grants, internal initiatives, optional engagements, independent ownership/discipline/lifecycle, shared work contexts and board/column/task relationships. Define tenant-consistent keys and one authoritative milestone completion state. Include the later publication/material/product modules in the relationship blueprint so the foundation fits the final architecture.
3. **Executable core baseline.** Create the core tables, necessary constraints, RLS/grants and authorized commands required by this slice. Establish the work-context and foundational board/task references directly. Implement later workflow modules in subsequent ordered migrations when their capabilities are built; do not expose unused commands or create duplicate legacy structures.
4. **Adapt existing application code.** Update Auth/workspace data access, organization selection, client-business/internal-initiative selection, progressive project creation, project list and saved overview. Reuse the current design system, form components and error/recovery patterns. Create the project, work context and essential memberships/configuration atomically.
5. **Private storage foundation.** Establish private buckets and asset metadata with organization/context authorization. Test permission boundaries using synthetic files. Actual submission/publication interfaces belong to later phases.
6. **Development lifecycle and CI.** Provide verified-development-only reset/bootstrap and deterministic seeds. Start or adapt canonical schema/security and frontend regression checks. Preserve useful assertions from existing tests without preserving obsolete schema shapes. Maintain a route/action register for current placeholders and incomplete controls.

## Schema decisions fixed in this phase

- A studio is an organization; UI terminology can remain workspace.
- A client business/contact is independent of a login account.
- Ownership, multiple disciplines and lifecycle are independent project fields/relations.
- Internal work has no required client, invoice or external approver.
- Tasks/issues/features share one authoritative record.
- Project and operational work share a work-context parent; boards/tasks refer to that parent.
- A boarded task has one home board/column, with a stable reporting category.
- Sensitive commercial data and internal assets do not become readable merely because a client can see a project.

No legacy IDs, client-person mappings, statuses, memberships, decisions or file records need backfilling. No old/new dual writes or compatibility views are part of this phase.

## Acceptance criteria

| ID | Must pass | Evidence |
|---|---|---|
| P1.1 — Target isolation | Development and production targets are distinguishable by verified project reference/host. Reset/bootstrap rejects production and unknown targets. | Target manifest plus dry-run/negative tests that fail before any destructive operation. |
| P1.2 — Reproducibility | A fresh isolated database can be initialized and seeded, reset and initialized again, producing the same logical fixtures without duplicates. | Canonical migration/seed run logs and deterministic fixture assertions; no imported current records. |
| P1.3 — Real authentication | Sign-in resolves only authorized organizations. Account switching/sign-out clears prior account data. Roles cannot be escalated through user-editable profile metadata or direct membership writes. | Local/dedicated-development Supabase Auth journey and allow/deny tests. Mocked auth alone is insufficient. |
| P1.4 — Correct setup | An internal Lora project can be created without a client/commercial record. An external Devine project links to a real client-business record; contacts need no login. Ownership, disciplines and lifecycle vary independently. | Authenticated create/list/overview checks; invalid ownership/parent combinations rejected by the database. |
| P1.5 — Atomic persistence | Project/context/membership creation succeeds together or rolls back together. Results survive reload and a fresh sign-in. | Success, injected-failure and idempotent-retry tests; no partial project or false success message. |
| P1.6 — Tenant and role isolation | Organization A cannot read or mutate organization B's rows, grants or files. Clients cannot enumerate internal projects, tasks, commercial data or unpublished assets. Anonymous privileged commands fail. | Two-studio/two-client matrix against table queries and RPCs, including tampered IDs and inactive membership. |
| P1.7 — Storage isolation | Private object bytes, listings and new signed-download authorization enforce asset scope. Unpublished test assets cannot be opened by clients or outsiders. | Actual nonproduction Storage tests, with signed-URL lifetime behavior stated accurately. |
| P1.8 — Functional core UI | Sign-in, studio selection, project creation/list/overview, validation and retry work on desktop/mobile with keyboard focus. The new slice contains no dummy success buttons or Coming Soon destinations. | Browser checks with synthetic fixtures. Later board/client capabilities remain clearly unexposed in the development slice until their integration is complete. |
| P1.9 — Code quality | TypeScript, build, relevant frontend regressions and canonical schema/security checks pass. Changed/reused foundation files pass lint. Unrelated existing lint defects remain itemized for resolution before release. | CI/local verification output and the route/action/defect register; no claim that older passing tests alone certify the new schema. |
| P1.10 — Scope integrity | Useful code and design are retained; obsolete development schema is replaced rather than emulated. No production data, users, object bytes, secrets or migration ledger is modified. | Reviewed code/schema diff and environment execution log. |

## First-phase boundaries

Full board customization, operational task screens, calendar/timeline/roadmap, release planning, recurring-work automation, material requests, client messages, exact-version approval and the persistent client work library remain in subsequent phases. Their relationships are designed now; their interfaces ship when complete.

Existing board/deadline components remain useful code to integrate and verify against the new model in Phases 2–3. This phase does not claim the entire current app is already functional on the new database.

Preserving future client work, approval history and task identity through normal operations remains a product requirement. The disposable-current-data clarification removes an import project; it does not authorize accidental loss of new work once the system is used.

## Authorization boundary

The user approved this isolated foundation build and its criteria, then instructed implementation to continue. A guarded reset of local synthetic application records was exercised. Auth identities and object bytes were retained. This approval does not authorize production reset/cutover, changing live secrets, rewriting a hosted production migration ledger or deploying the new architecture live. Those operations require separate explicit confirmation identifying their target and scope.
