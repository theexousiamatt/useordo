# Owned Supabase backend replacement

Target: `ilvqopsvyacegotplstw` (`https://ilvqopsvyacegotplstw.supabase.co`). Start empty; do not migrate or delete data in the old backend. Keep the existing interface.

The frontend configuration in .env, .env.production, and ignored .env.local targets the owned backend. Deploy the replacement branch to Hostinger after verifying Auth redirects and production hosting.

Deployment requires authenticated Supabase management access; a publishable key cannot create tables or deploy functions. Sign in through the Supabase CLI on this computer, or connect the Supabase management integration. Do not place access tokens, service-role keys, or database passwords in the frontend or repository.

Before switching production:

1. Validate and apply the existing schema migrations to an empty staging database, with explicit grants and RLS. Review legacy policies and extension dependencies.
2. Fix email-bound invitation acceptance and server endpoint authorization. Replace Lovable-dependent AI/email services with explicitly configured providers or disable those features until configured.
3. Implement authorized shared-deliverable review, compatible with the current client screens. Keep internal tasks private.
4. Deploy the reviewed workspace, invitation, and other needed Edge Functions; configure their server-only secrets.
5. Configure Auth site URL and redirect allowlist for `https://ordo.inspirarestudio.com` and local development, plus any OAuth providers that are actually enabled.
6. Verify sign-up, workspace creation, invitations, two-client isolation, files, approvals, notifications, and password reset.
7. Update production build variables and deploy only after all checks pass. Existing users must create new accounts because this is an empty backend.

Status: database and core functions deployed and verified; provider setup and production cutover pending.

## Deployment progress — 8 October 2026

- New project linked through the owner's Supabase CLI authentication.
- Existing schema migrations plus owned-backend security, project visibility, and SMTP delivery migrations applied.
- Historical invitation migration corrected to use the `extensions` cryptography schema.
- Email-bound, atomic invitation acceptance implemented and deployed.
- Client review RPC deployed; decisions create an audit row and an owner notification. Client UI uses deliverables instead of private tasks.
- `create-workspace`, `list-workspaces`, `accept-invitation`, and `duplicate-project` deployed. Listing excludes inactive memberships.
- Google OAuth changed locally from Lovable authentication to direct Supabase authentication. Google/GitHub provider credentials still require dashboard configuration.
- `APP_URL` set to `https://ordo.inspirarestudio.com`.
- AI endpoint deployed with verified-user/workspace checks. Independent AI provider credentials are not configured; authorized users receive a clear 503 until configured.
- Hostinger SMTP sending is deployed with verified-user/event authorization, derived recipients, and persistent duplicate-send protection. Host and sender are configured; SMTP_PASSWORD must be set privately before delivery. Supabase Auth custom SMTP must be configured separately. See hostinger-email-setup.md. Frontend invitation messages distinguish created invitations from successful email delivery.
- Owner explicitly approved in-function token validation for invitation, duplication and deletion. The compatibility configuration is deployed and tested. Each modifying operation still requires a verified user and the relevant permissions.
- Production hosting has not been switched. The replacement branch environment files target the owned backend.

## Verification

Rollback-only SQL tests passed for: assigned-project isolation between two clients, hidden internal tasks, hidden unshared drafts, rejection of another client's review, review audit history, duplicate-decision rejection, wrong-email invitations, and token replay. No test users remained afterward. Production build and TypeScript checking passed; existing bundle-size and duplicate-shortcut warnings remain unrelated to this backend change.

The replacement is not yet ready for production cutover. Remaining steps: authenticated browser workflow, independent email delivery, optional AI provider setup, Supabase Auth redirect/provider settings, and hosting deployment. No existing client data was migrated or deleted.

## Approved deployment verification

Owner approved both compatibility and AI deployment changes. Real Supabase Auth integration tests passed for password sign-in, workspace creation/listing, invitation preview with the publishable key, rejection of wrong-email acceptance, correct-email acceptance, replay rejection, owner project creation, client assignment, deliverable submission/approval, owner duplication, rejection of client duplication/deletion, and unauthenticated rejection on protected endpoints. AI requests from clients return 403; authorized owner requests return 503 because provider credentials are absent. Temporary accounts/workspaces were deleted, and the private key file was removed.

A project SELECT-policy regression was fixed so authenticated `INSERT ... RETURNING` works; the rollback-only SQL test now covers it. Client isolation remains verified. The reusable HTTP integration check is `scripts/backend-integration.py`; it accepts a private management-key JSON file generated locally, deletes that file afterward, creates confirmed synthetic accounts without sending email, and cleans up its fixtures. Never commit the key file.

## Hostinger verification

Email dry-run integration checks passed for an authorized invitation and rejected unauthenticated, unrelated-user, and fabricated events. Rollback-only SQL checks passed for SMTP concurrent-send and sent-event deduplication. TypeScript checking and production build passed. No real emails were sent; mailbox authentication and inbox delivery remain unverified until private SMTP configuration is completed.

## Production build preparation

Production mode now reads .env.production targeting the owned Supabase project and planned https://ordo.inspirarestudio.com URL. Development keeps its existing environment. Hostinger must use npm ci, npm run build, and dist as the output directory. Any hosting environment variables must match .env.production, since supplied variables override files. The public/.htaccess fallback supports direct SPA routes on Apache hosting; Node/static hosting must configure an equivalent index.html fallback. The dependency lockfile was reconciled for clean installs. Production build and TypeScript verification passed.

Hostinger accepted an authorized test invitation and the owner confirmed inbox receipt. The temporary invitation workspace and test sender were removed. Supabase Auth sign-up/reset delivery, redirect settings, and the actual production hosting connection still need verification before merging/deploying the branch. The planned subdomain did not resolve during the readiness check.

## Independence from the previous builder

Removed the builder SDK, editor tagger, unused authentication adapter, planning metadata, obsolete email-provider functions, and stale binary lockfile. Both development and production use the owned Supabase backend. GitHub installation access and both OAuth/user app authorizations were revoked for the entire account at the owner’s request. Hostinger access remains connected. Historical migration and audit records remain for traceability; they are not active dependencies. Build and TypeScript checks passed.
