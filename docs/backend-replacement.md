# Owned Supabase backend replacement

Target: `ilvqopsvyacegotplstw` (`https://ilvqopsvyacegotplstw.supabase.co`). Start empty; do not migrate or delete data in the old backend. Keep the existing interface.

The new frontend connection is configured in ignored `.env.local` for local verification only. The committed `.env` still points at the old backend until the replacement has been deployed and tested. This branch must not be merged into the live app yet.

Deployment requires authenticated Supabase management access; a publishable key cannot create tables or deploy functions. Sign in through the Supabase CLI on this computer, or connect the Supabase management integration. Do not place access tokens, service-role keys, or database passwords in the frontend or repository.

Before switching production:

1. Validate and apply the existing schema migrations to an empty staging database, with explicit grants and RLS. Review legacy policies and extension dependencies.
2. Fix email-bound invitation acceptance and server endpoint authorization. Replace Lovable-dependent AI/email services with explicitly configured providers or disable those features until configured.
3. Implement authorized shared-deliverable review, compatible with the current client screens. Keep internal tasks private.
4. Deploy the reviewed workspace, invitation, and other needed Edge Functions; configure their server-only secrets.
5. Configure Auth site URL and redirect allowlist for `https://ordo.inspirarestudio.com` and local development, plus any OAuth providers that are actually enabled.
6. Verify sign-up, workspace creation, invitations, two-client isolation, files, approvals, notifications, and password reset.
7. Update production build variables and deploy only after all checks pass. Existing users must create new accounts because this is an empty backend.

Status: local connection prepared; database deployment and production cutover pending.

## Deployment progress — 8 October 2026

- New project linked through the owner's Supabase CLI authentication.
- Existing schema migrations plus two owned-backend security migrations applied.
- Historical invitation migration corrected to use the `extensions` cryptography schema.
- Email-bound, atomic invitation acceptance implemented and deployed.
- Client review RPC deployed; decisions create an audit row and an owner notification. Client UI uses deliverables instead of private tasks.
- `create-workspace`, `list-workspaces`, `accept-invitation`, and `duplicate-project` deployed. Listing excludes inactive memberships.
- Google OAuth changed locally from Lovable authentication to direct Supabase authentication. Google/GitHub provider credentials still require dashboard configuration.
- `APP_URL` set to `https://ordo.inspirarestudio.com`.
- AI endpoint code hardened locally, but deployment is pending authorization review. Independent AI provider credentials are not configured.
- Email sending has not been deployed: the old implementation depends on Lovable's email service and lacks adequate recipient authorization. Frontend invitation messages now distinguish created invitations from successful email delivery.
- Default gateway JWT checking remains on the invitation/duplication endpoints. The new publishable-key setup needs compatibility verification; any proposed boundary change is pending explicit approval following automatic approval-review rejection.
- Production frontend environment has not been switched; the old backend remains in the committed `.env`. Local `.env.local` targets the new backend.

## Verification

Rollback-only SQL tests passed for: assigned-project isolation between two clients, hidden internal tasks, hidden unshared drafts, rejection of another client's review, review audit history, duplicate-decision rejection, wrong-email invitations, and token replay. No test users remained afterward. Production build and TypeScript checking passed; existing bundle-size and duplicate-shortcut warnings remain unrelated to this backend change.

The replacement is not yet ready for production cutover. Remaining steps: gateway compatibility approval/testing, authenticated browser workflow, independent email delivery, optional AI provider setup, Supabase Auth redirect/provider settings, and hosting deployment. No existing client data was migrated or deleted.
