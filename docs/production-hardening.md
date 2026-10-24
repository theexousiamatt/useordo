# Production hardening progress

## 24 October 2026 — access contract

Applied `20261024190000_access_contract.sql` to the owned backend and registered the exact migration source in `supabase_migrations.schema_migrations`.

Completed:
- `delete_project` rejects a null caller explicitly, rejects nullable-owner/nonowner cases, requires active workspace membership, and is no longer executable by PUBLIC/anon.
- Reviewed RLS helpers are executable by authenticated/service roles, resolving the deployed Files error. No blanket grant on privileged functions was used.
- Workspace/project membership, client and management guards require active membership; removal/deactivation no longer leaves old project membership/client_id as a bypass.
- Direct project/task deletion and project-member management policies enforce the same revocation boundary.
- Profile sharing uses active memberships.
- Existing workspace-wide internal collaborator visibility is preserved. A future assigned-only/restricted visibility change requires an explicit product decision and separate migration.
- `verify:rls` now checks destructive-RPC exposure and required file-policy helper ACLs in addition to table policies.
- `npm run verify:access` runs rollback-only synthetic tests against `TEST_DATABASE_URL` (requires psql). Run migrations against a fresh isolated database before this check; it intentionally does not apply migrations itself.

Verification:
- Migration and access-contract fixtures were run together inside a rollback transaction through the authenticated Supabase SQL editor.
- Expanded checks passed: anonymous permission rejection; null caller; nonowner of nullable-owner project; owner and assigned-client file reads; active project-owner deletion (nested rollback); inactive client project/files denial; inactive project-owner contribution/management/deletion denial; removed member/client helper denial; legitimate workspace-owner deletion.
- Applied migration in a separate transaction, including migration-ledger entry.
- Post-commit metadata check: anonymous deletion=false, authenticated member guard=true, authenticated role guard=true, migration recorded=true, synthetic auth users remaining=0.
- Signed-in live Ivy Website Files tab now reaches “No files yet” with Upload action, replacing the prior error state. The existing project still loads.
- No real accounts/projects/tasks/files were deleted or modified. Fixture accounts had invalid-domain addresses, existed only within rolled-back transactions, and sent no mail.
- Actual Storage upload/download/delete cycle, existing bearer signed-URL revocation and all historical RLS integration fixtures remain separate checks. Previously issued signed URLs can remain usable until expiry; membership revocation prevents new authorization but does not invalidate an already-issued URL.
- Local psql/Supabase CLI were unavailable, so the CLI runner itself was syntax-checked rather than used for database execution; equivalent SQL fixtures were executed through the SQL editor.

Next batches, not completed:
1. Real onboarding invitations with delivery outcomes and retry safety.
2. Recoverable workspace errors, canceled stale requests and identity-scoped cache cleanup.
3. Transactional writes, relational consistency, file cleanup and upload constraints.
4. Missing client workflows, search, milestones, multi-assignee task filtering.
5. CI, staging, restores, mobile/accessibility verification and LLM readiness controls.

Evidence screenshot: `../audits/ordo-files-restored.png`. Original audit: `../audits/ordo-production-2026-10-24/report.md`.

## 24 October 2026 — invitations and workspace recovery

Completed in source/local preview:
- Onboarding issues real member/client invitations rather than logging fictional invitation events.
- Team and onboarding share invitation preparation and delivery reporting. Client invitation drawers default to the client role.
- Atomic preparation normalizes/deduplicates recipients, serializes competing preparation for the same workspace/email, reuses unexpired pending invitations, skips existing active members, rejects conflicting roles, and blocks unusable reinvitations for inactive members with a reactivation instruction.
- Email remains a separate durable server-tracked operation. Partial/unconfirmed delivery stays visible; onboarding allows retry or explicit entry with follow-up from Team. Existing server event keys prevent duplicate accepted sends on retry. SMTP acceptance is not claimed as inbox receipt.
- Optional onboarding skips clear their recipient list, and back navigation allows correcting roles. Client project assignment is explicitly deferred until acceptance rather than presenting a nonfunctional onboarding selector.
- Workspace loading is bounded to 15 seconds, catches returned and thrown errors, rejects malformed responses, cancels superseded requests, and ignores late responses.
- Shared retry/sign-out recovery replaces endless workspace loaders across owner, client and onboarding routes.
- Identity changes clear query/mutation caches and remount account-scoped workspace state; token refresh for the same identity preserves cache. Workspace selection is stored per account and tolerates unavailable local storage.
- Sign-out failures remain visible rather than pretending the session was reset.

Database deployment:
- `20261024200000_prepare_invitations.sql` and `20261024201000_inactive_invitation_guard.sql` installed and tracked in the migration ledger.
- Rollback-only SQL checks passed for normalized duplicate recipients, pending-invite reuse, existing-member skip, conflicting-role rejection, inactive-member guidance, invalid-batch atomicity, outsider denial and anonymous ACL rejection.
- Follow-up after the initial migration confirmed zero synthetic users/invitations. Expanded guard tests also completed with rollback.
- No real invitation emails were sent by these checks.

Verification:
- 26 frontend tests pass, including onboarding completion/failure/partial delivery, account cache invalidation, workspace stale-response cancellation, normalized preparation and explicit email acceptance.
- TypeScript and production build pass. Targeted new/modified recovery/auth/service/onboarding checks have no lint errors; Fast Refresh export warnings remain. Existing full-repo lint/build warnings are not all fixed.
- Actual recovery component rendered in a development-only fixture at a 390px constrained width; no internal horizontal overflow, Tab focuses Try again, Enter activates it. This is a container-width check, not a physical-device/Safari certification.
- Local fixture: `/tests/workspace-recovery.html?width=390` on port 5180. It simulates UI actions only and sends no requests.
- Frontend changes are **not yet published**. Full live signup/invitation inbox → acceptance, physical-device checks and sustained concurrent load remain unverified.

Next: transaction/data-integrity fixes and complete client/project/milestone workflows, followed by CI/staging/restore gates. Wider role-downgrade/rejoin semantics should be tested explicitly alongside the authorization matrix before claiming the entire membership lifecycle is production-certified.
