# Client invitations and account entry

Published on 2026-10-25. Existing invitations remain workspace-scoped. Existing memberships and project assignments are preserved.

## Agency workflow

Clients and Team let an owner/manager choose a project or client workspace. Agency onboarding reviews that same choice before sending invitations and defaults to its newly created first project when available. Project pages preselect that project. Project invitations are client-only; Team still supports workspace member/manager invitations. Up to 50 recipients can be prepared atomically, with stable pending tokens and separate email-acceptance reporting. Scope is shown before sending and in pending invitations.

A project invitation grants an active client membership as a portal container plus a client project assignment. A workspace invitation explicitly upgrades the portal scope, **never** visibility into all agency projects. Previously shared projects remain shared. An existing internal user is not downgraded by a client invitation. Inactive accounts require deliberate agency reactivation.

## Recipient workflow

The invitation shows the agency, inviter, project and access. The primary action requests a Supabase Auth sign-in link for the invited email. It works for new and existing accounts without passwords or agency setup. The returned link carries the invitation and `join=1`; verified users accept once and land directly on the project or client portal. Password sign-in, signup, Google OAuth, email verification and password recovery preserve this return path. Account mismatch requires switching to the invited email.

Accepted links reopen existing access without recreating removed membership or project access. Expired invitations can request renewal: an hourly-deduplicated **in-app notification** reaches an active inviter or workspace owner. It does not extend access automatically or promise an email. Revoked/missing/project-deleted links explain that the agency needs to issue a new invitation.

Before agency onboarding, accounts without a workspace check for pending invitations using their verified email. Lookup failures offer retry and do not route into workspace setup. An Invitations entry in the account menu also makes pending invitations discoverable for existing users. Clients can switch agency spaces using the shared switcher. Creating a separate agency workspace remains an explicit choice.

The client project URL now renders a real project page: progress, submitted review requests, read-only shared files and milestones. It no longer renders the project list. Internal tasks, draft deliverables and raw activity stay private.

## Access changes

Database checks enforce email binding, verified identity, workspace/project consistency, role restrictions, pending-token deduplication, atomic membership/assignment acceptance and idempotent reopening. Clients cannot enumerate agency membership or other client profiles. New project, file upload/replacement/deletion and raw activity writes require agency access. Legacy overlapping Storage policies are consolidated so a hidden UI action cannot bypass these restrictions. Legacy client-owned project rows do not grant deletion privileges.

## Deployment order

1. Apply `20261025090000_scoped_client_invitations.sql` through the normal migration process. Review the changed client write permissions above before rollout. Do not manually create new memberships as a substitute.
2. Deploy `accept-invitation` and `send-transactional-email` (including the updated shared invitation template). Their existing secrets/configuration remain in use.
3. Verify Supabase Auth has passwordless email enabled, working custom SMTP and an allowed production redirect covering `https://ordo.inspirarestudio.com/auth/invite` with its query string. Use the default confirmation URL in the magic-link/confirmation email template; a hardcoded localhost or fixed signup route loses invitation context. Preserve existing verification/reset/OAuth redirects. Configure explicit staging/local origins separately.
4. Publish the frontend with the existing Hostinger build script. Deploy the backend first; do not ship a new frontend against the old schema/functions.
5. Use a controlled recipient address to verify invitation email → sign-in email → project, an existing account, an expired auth link, wrong-account switching and reopening the accepted link. SMTP acceptance alone is not inbox verification. Do not use client addresses as test fixtures.

## Verification

- `npm test`: 45 tests, including invitation-first entry, explicit project/workspace scopes, wrong-account recovery, passwordless return URL, accepted-link reopening, expired-link requests, email failure recovery and pending-invitation onboarding gates.
- `npm run verify:access:local`: real isolated PostgreSQL (PGlite), repository schema/access migrations and three rollback SQL suites. Checks project/file/Storage isolation, draft deliverable/internal task privacy, client write denial, workspace upgrades, wrong-email acceptance, repeat acceptance, deactivation and renewal deduplication. Supabase auth/storage platform tables are represented locally; email queue/cron/vault/network transport extensions are excluded. This is not a deployed Supabase or live SMTP test.
- TypeScript and Vite production build pass. Targeted lint has no errors. Existing unrelated build warnings remain (duplicate ProjectBoard shortcut, Tailwind duration, Browserslist age, main bundle size).
- Browser checked desktop and an actual 390px iframe viewport for invitation, account mismatch, expired invitation, client scope selection and project Review/Files/Milestones. Keyboard activation checked. These are development fixtures with stubbed auth/invitation responses; no real email or membership was sent/changed. Physical phones, Safari and real inbox round trips remain unverified.

Development-only previews (not production build entrypoints):

- `/tests/invitation-journey.html?state=project`
- `/tests/invitation-journey.html?state=project&width=390`
- `/tests/invitation-journey.html?state=drawer&width=390`
- `/tests/invitation-journey.html?state=wrong&width=390`
- `/tests/invitation-journey.html?state=expired&width=390`
- `/tests/invitation-journey.html?state=detail&width=390`

## Production release — 2026-10-25

- Source `7bbc705`; Hostinger static release `0f48d88`; production served `/assets/index-mOuK0S75.js`.
- Scoped migration and fixtures passed together inside a rollback transaction on actual Supabase. The managed platform blocks direct Storage SQL deletes; the fixture accepts that denial without disabling the safeguard. Migration then applied and registered in the ledger; synthetic users remaining: zero.
- `accept-invitation` and `send-transactional-email` deployed through Supabase, including the project-aware email template.
- Added same-origin invitation, verification and password-reset redirect patterns so nested return query strings survive authentication. Existing URLs retained. Magic-link and confirmation templates use `.ConfirmationURL`.
- Final live checks: owner project opens, client invitations default to that project with a workspace alternative, invalid invitation links render recovery for signed-in visitors, existing Files tab loads normally. No invitations/emails were sent and no real membership was changed by smoke tests.
- Full mailbox receipt → new/existing recipient sign-in → project remains unverified; the production check did not use client addresses as fixtures.
