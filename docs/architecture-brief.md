# Ordo architecture brief

Prepared for Inspirare Studio · 3 November 2026

**Status:** Target architecture and implementation brief, expanded against the complete 18-section requirements received on 3 November 2026. The existing React/Supabase application is the starting point. Due-date filters are implemented locally; the broader model remains implementation work. Significant architectural changes await user approval of [the implementation plan](implementation-plan.md). The [current audit](current-architecture-audit.md) records reuse, gaps, unfinished actions and verification limits.

**Database clarification:** Current application records are disposable. Use a clean canonical development schema and synthetic fixtures, with no legacy import, data backfill or compatibility layers. Preserve useful code, components, design and functionality. Development and production are separate targets; production reset/deletion requires explicit confirmation. The [revised first phase](phase-1-foundation.md) is proposed for approval before implementation.

## Purpose

Build one dependable system for client delivery, internal products, creative production and studio operations. Ordo connects agreed objectives and scope with tasks, people, files, reviews, releases and delivery decisions. Preserve the existing application and its design conventions.

Give each client a lasting home for their relationship with Inspirare. They can sign in whenever needed to find authorized current and past projects, submissions, Figma/Drive links, approved versions and final files, including when they have no active project.

Serve Inspirare and its invited clients first. Preserve explicit studio ownership and memberships so another studio can be introduced later without restructuring the core data model.

## Independent work dimensions

Keep work ownership (client or studio), discipline (branding/strategy, web, product/software, content, growth, operations) and lifecycle (fixed-scope, recurring, continuous development, ongoing operations) independent. A project can involve multiple disciplines.

Devine Apartments can be an external branding/website engagement. Lora can be an internal product with continuous development. Inspirare Content can use recurring operational assignments. All use shared task infrastructure with appropriate optional workflows.

Project creation starts with Client Project or Internal Studio Project, then Blank or Template. Use progressive setup for relevant scope, boards, milestones, people and optional capabilities. Internal work does not require client records, commercial agreements, external approvers or a client portal.

## People and experiences

| Person | Primary responsibility | Experience |
|---|---|---|
| Studio owner/admin | Manage the studio, people, access and overall delivery | Studio-wide oversight and administration |
| Project manager | Coordinate scope, assignments, deadlines, client communication and publication | Complete view of the projects they manage |
| Creative lead | Check quality against the approved brief and clear work for presentation | Internal reviews and creative direction |
| Designer, motion designer or writer | Produce and revise assigned work | My tasks, project context, references, versions and feedback |
| Client reviewer | Supply information and give feedback | Shared project progress and published review packages |
| Client approver | Make the accountable client decision | Approve a specific version or request changes |

One person can hold several responsibilities. A small business owner can be both reviewer and approver; a studio lead can also manage a project. Restricted collaborators receive deliberate project access.

## Core records

- **Studio:** An organization is the tenant root for business data, settings and memberships; existing UI can continue to call it a workspace.
- **Client organization:** The business relationship, independent of whether any contact has an account. Brands or business units are optional groupings.
- **Client access grant:** Deliberate authorization connecting a person to a client library or selected projects. A nominated client owner can receive access to all published work for that business; other contacts can receive narrower access.
- **Internal initiative:** A studio-owned objective or product such as Ordo, Lora or Velmont, optionally grouping multiple internal projects.
- **Operational context:** Lightweight studio work such as recurring content, administration or business development, without mandatory project creation.
- **Work context:** Shared parent of a project or operational context, used by boards/tasks to enforce a single work scope without competing nullable parent references.
- **Engagement:** Agreed brief, scope, commercial references, revision allowance and change requests. It can support a defined project or an ongoing relationship.
- **Project:** Production plan, team, deadlines, independent work dimensions and configurable lifecycle stages. Client engagements and internal initiatives can each group projects where applicable.
- **Board and column:** Persisted workflow configuration, custom names/order, canonical status mappings, access rules and reusable templates. A project may have several boards.
- **Milestone:** An agreed checkpoint with explicit completion requirements.
- **Task or issue:** One authoritative work record, with description, assignees, status, priority, due date, dependencies, references, attachments, comments, review submissions and completion criteria. Its primary scope is a project or operational context; deliverable links are optional.
- **Deliverable:** A promised output with an accountable owner and acceptance requirements.
- **Deliverable version:** An immutable description of the exact artifacts prepared for review, including stable exports or identifiable external versions.
- **Review round and decision:** Feedback and approval tied to a specific version, with actor, time and outcome.
- **Asset and publication:** Working material, client-provided inputs and intentionally shared review/handover packages, each with explicit access rules.
- **Shared resource:** A named external reference such as a Figma file/prototype, Drive file/folder or live website, connected to a client, project and relevant deliverable/version. Store the provider, URL, purpose, publication date, author and visibility; keep history when a submission reference changes.
- **Product and recurrence records:** Optional task-linked sprints, releases, QA, release notes, roadmap targets and uniquely tracked recurring occurrences.
- **Material request and submission:** Requested, Submitted, Under Review, Accepted and Changes Required states for client input, with review history and accepted assets.

People can participate in multiple projects and organizations. A business relationship alone does not grant portal access. An explicit client-library grant lets a designated owner discover existing and future published projects for their own business without a new invitation for each project. Selected-project contacts retain their narrower scope. Neither scope exposes internal work or another client's records.

## Delivery workflow

Agreed scope → kickoff and client inputs → production → internal review → publication of a version → client review → revision or approval → final handover → archive or next engagement.

The broader client lifecycle can start at Lead/Discovery and include Engagement, Project Setup and Planning. These are configurable stages. Internal products and operational work can use their own stages, internal reviews, publication schedules, QA and releases without adopting client delivery requirements.

The creative submits work for internal review. The creative lead clears its quality. An authorized project manager publishes a specific package to the client. The nominated client approver records a decision against that version.

A new version requires a new review and preserves earlier decisions. Additional work outside the agreed scope becomes a change request with its proposed cost and timeline impact. Approval of that change updates the project plan.

## Creative workspace

Provide My tasks across projects and an accessible project brief, production board, deliverables, files/references and contextual discussions. Designers, motion designers and writers share these structures, with discipline-specific requirements on their assignments.

Keep internal review deadlines distinct from client presentation dates. Provide Due today, Due this week, Overdue, No due date and inclusive custom date-range filters. Weekly filters run Monday–Sunday and combine with assignment and other task filters. Due-date shortcuts count open work and exclude completed/archived tasks. The current local implementation uses the viewer's local calendar for today/week boundaries.

Extend unified tasks with Upcoming, project/context and priority filters while preserving current deadline behavior. Designers, writers, developers and restricted collaborators use the same task model with appropriate capabilities.

## Configurable boards and shared views

Support board creation, renaming, reordering, configuration duplication, archive/restore, safe deletion, templates and saved reusable templates. Support column creation, renaming, reordering/removal, stage configuration, access restrictions and task movement between columns/boards. Column names map to stable reporting categories.

The proposed first implementation gives each task one home board/column, with one canonical reporting status. Other views refer to that task; they do not create competing records or statuses. Board deletion cannot cascade into task deletion. Populated boards/columns require safe reassignment or explicit archival handling. Template duplication copies configuration by default.

Board, List, Calendar, Timeline and capability-dependent Roadmap views share authorized queries and commands. Implement views incrementally based on the existing codebase and project priorities. Each visible view must be functional before appearing in navigation.

## Client portal

Center the portal on four questions: Where are we? What do you need from me? What happens next? Where is the work we have already done together?

Provide invitation-based entry, a prepared project overview, guided input requests, published work, version-specific feedback, clear review/approval actions and final handover materials. Support a mobile-friendly owner-only journey with minimal setup. Larger engagements can add reviewers and stages using the same records and permissions.

Include material-request status, client updates and shared project messages. Personal account settings are separate from studio administration. A single owner can submit materials, comment and approve versions.

The invitation establishes access; returning clients use ordinary sign-in rather than relying on the original invitation URL. Project completion and archiving preserve client-library access to published results. Completed projects are normally read-only, with links, previews, approval history and final downloads still available. Access revocation, retention and deletion are separate deliberate operations.

Provide a client home with Current projects, Past projects and a searchable Work library. Organize the library by client/brand, project, deliverable, type and date. A project submission shows its title, description, version, submission/approval dates, review state and clearly named actions such as Open in Figma, Open Drive folder, View website and Download final files. Clients can browse history without waiting for a new email or review request. Later manual entry of historical work may be supported with provenance and visibility; importing current application records is not required.

Internal tasks, discussions, drafts and working attachments stay private until deliberately published. Client intake uploads are a separate, authorized flow. Search, notifications, previews, activity and downloads must respect the same visibility boundary.

## Persistent work library and external sources

Ordo is the authoritative record of what Inspirare shared, when it was shared, which version was reviewed, what was approved and where the results can be found. Figma and Drive remain the source tools for editable working material. Store ordinary source URLs and issue fresh authorized download links for privately stored assets when requested; expiring download URLs are not permanent library records.

Publishing a URL does not grant access to the provider's underlying file. The studio verifies the intended recipient's Figma/Drive permissions before publishing, without automatically making files public. If an external resource becomes unavailable, show its recorded context and a recovery action rather than hiding the submission. Automated permission checks or synchronization require explicit provider integrations and authorization.

Preserve an export or stable provider version reference for each formal review. Preserve final exports and handover packages in backed-up storage alongside their source links, so the client record survives changes to a working document. Retain earlier published versions and decisions when a new version is added. Completing a project does not erase or silently replace its results; deletion follows a separate documented policy.

Provider access references: [Figma sharing and permissions](https://help.figma.com/hc/en-us/articles/1500007609322-Guide-to-sharing-and-permissions) and [Google Drive sharing](https://support.google.com/drive/answer/2494822).

## Technical foundation

Retain React, TypeScript and the existing Hostinger frontend deployment. Use Supabase Auth, PostgreSQL and private object storage as the shared backend foundation.

Organize one application into business modules: Identity and access; Clients/engagements and internal initiatives; Production/boards/operations; Reviews and delivery, including the persistent client work library; Optional product/recurrence capabilities; Communication and background operations.

Use scoped reads for each experience. Route business transitions through authorized backend commands such as Create project, Publish version, Record review decision and Accept scope change. SQL functions provide transactional database operations; Edge Functions handle authenticated orchestration and external providers. Frontend hooks request operations and display results.

Enforce active membership, project capabilities and asset publication in database and storage policies. Enforce studio/project relationships with database constraints. Keep privileged credentials on the server. Scope frontend caches to the account and studio.

Board restrictions must also apply through dashboards, alternate views, search, notifications and file access. Support administrator, project manager, creative lead, creative/developer, restricted collaborator, client reviewer and client approver responsibilities through scoped capabilities.

Commit database changes and pending notification events together. Background workers process email, previews, integration work and cleanup with idempotency, retries and visible delivery outcomes. Treat uploads and deletion as recoverable workflows across database metadata and object storage.

Keep creative source tools connected through references and integrations. Ordo owns scope, delivery status, review packages and decision history. Initially, commercial documents and invoice/payment references can link to existing business tools.

## Reliability and rollout

Use isolated staging, controlled test recipients, repeatable migrations and automated permission/workflow checks. Track failed jobs, unavailable assets and delivery errors. Back up and test restoration of both database records and stored files; preserve a project export and handover path.

Every visible control must have a complete, authorized outcome and appropriate loading, empty, error and recovery states. Implement required Deliverables/library, Messages, account settings, reviews and search; optional deferred features remain unexposed until ready. Do not ship dead buttons or Coming Soon destinations. Preserve the established premium typography, spacing, responsive patterns, accessibility and purposeful motion.

Evolve the existing application incrementally while designing the new database directly for the final architecture. Retain useful Auth integration, components, board/deadline behaviors and uncommitted code; adapt their data access to the canonical schema. Start from an isolated clean development database with deterministic synthetic identities/data as appropriate, without importing old application records or maintaining dual schema paths. Use ordered forward migrations after the baseline and retire obsolete development structures. Production Auth users, records, storage, configuration and migration history remain untouched until a separately confirmed cutover/reset.

Verify reset targets by explicit project reference/host and reject production or unknown targets. Application migrations must not implicitly drop managed Auth/Storage schemas or erase users/object bytes. In normal use after implementation, task history and published client materials retain their agreed preservation guarantees. Disposable current records do not change that behavior.

## First release acceptance

Prove one controlled Inspirare engagement end to end: prepare the client and scope; invite the owner; enter the correct project; assign creative work; produce and internally review a version; publish it; collect a client decision; revise it; approve the final version; and deliver the final package.

Verify that another client cannot access it, internal attachments remain private, revoked memberships lose new access, stale decisions cannot approve a superseded version, and retries do not duplicate decisions or accepted notifications. Validate the client journey on mobile and desktop.

Also prove return access: the client signs out, returns through normal sign-in and finds both an active and a completed project. Published Figma/Drive resources, approved versions and retained final files remain discoverable after completion/archiving. Test full client-library scope against selected-project access, preserve old submission history after a replacement, show a useful unavailable-resource state and recover stored final files in a restore check. Include the client with no active projects in this journey.

Public studio acquisition, SaaS billing, general-purpose workflow builders, elaborate approval chains and comprehensive accounting remain future scope, introduced when studio use demonstrates a need.

## Complete acceptance package

The approved implementation must satisfy all seven scenarios from the complete brief: A Devine Apartments; B Lora; C Inspirare Content; D Unified Tasks; E Board Customization; F Small Business Client; G Security. The detailed plan defines the domain diagram, board architecture, role matrix, journeys, proposed migration batches, phased roadmap and verification strategy for approval before significant implementation.
