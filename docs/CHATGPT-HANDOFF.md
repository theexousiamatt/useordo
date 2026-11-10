# Ordo — ChatGPT handoff

Updated 10 November 2026. **Feature development is frozen. The canonical MVP is preserved on GitHub, but is NOT deployed.** The user approved deployment subject to safety gates; the release is blocked for the reasons below. Resume from this document, without repeating the architecture audit or HeroUI evaluation.

## Repository and checkpoints

- Repository: https://github.com/theexousiamatt/useordo
- Continue branch: `codex/heroui-v3-proof` (not `main`).
- Verified source checkpoint: `783e73ee2c74206d821780eeb9bca5f14310884c`. This adds only a lazy-editor test wait correction to MVP checkpoint `2ec9e97e9852c655c81ce78f5852294a6b9f5a39`.
- This handoff is committed after that source checkpoint. Resolve its exact documentation commit with `git log -1 --format=%H -- docs/CHATGPT-HANDOFF.md`; use `git rev-parse HEAD` for the current checkout. The final delivery message records the pushed tip.
- Phase 1 checkpoint: `c2be71e9a739c0bae98fa182100d53aefab92420`; HeroUI integration: `64bc3ae`; Increments 1–4: `2ee824f`, `905fcf4`, `69cd275`, `2ec9e97` respectively. All are ancestors on the continuation branch.
- Legacy source branch: `codex/owned-supabase-backend`, checkpoint `70f71a2426652435b5a993dd60706118a475978f`.
- Existing production artifact branch: `codex/hostinger-static`, observed remote tip `0f48d88cadad592dcfc087bcfd855b0129e3d0e4`. Do not push source code to that branch.

## Production: actual observed state

- URL: https://ordo.inspirarestudio.com
- Provider: Hostinger, static website. Document root `/home/u893521540/domains/inspirarestudio.com/public_html/ordo`.
- Hostinger reports enabled Git auto-deployment from `theexousiamatt/useordo`, branch `codex/hostinger-static`, root directory. No Node.js build/settings are configured; Vite variables are baked into compiled JavaScript, not server runtime variables.
- Existing publisher: `scripts/publish-hostinger.sh` builds `dist`, commits generated files onto that artifact branch, and pushes it. **Do not run it now:** the default build selects the legacy application, not canonical MVP Increments 1–4.
- Existing live bundle observed: `/assets/index-mOuK0S75.js`, stylesheet `/assets/index-BvQ8O7VR.css`. The bundle points to Supabase project `ilvqopsvyacegotplstw`. The committed production configuration points to the same project.
- Read-only smoke check: homepage HTTP 200; existing owner session loaded the studio dashboard and legacy Tasks. At 390px, Tasks rendered with mobile navigation and document width 390px. Auth settings endpoint responded 200: email enabled, Google/GitHub disabled. This verifies an existing session, **not fresh production sign-in**.
- Canonical identity RPC returned HTTP 404 / `PGRST202` on production. The canonical foundation is not installed there.
- No deployment, production SQL, resets, fixture uploads, Auth changes, project/task writes or storage changes were performed. New-MVP live sign-in/create/edit/persistence/isolation tests were therefore **not run**. Local verification is not production certification.
- Connected Supabase MCP currently lists only another project (`cjyhayrxadyadaqdrlot`), not the actual production project. Do not substitute that project. Production migration ledger, private storage policies, Auth redirect allowlist, backups and restore readiness remain unverified with privileged access.

## Release blockers — do not bypass

1. **Frontend is deliberately local-only.** `src/lib/foundationEnvironment.ts` requires foundation mode, environment `development`, loopback API port 54321 and a loopback page/redirect origin; it explicitly rejects the production Supabase host. `FoundationEntry.tsx` additionally requires the server marker `development/local/ordo-foundation-v1`. A hosted canonical build must fail closed today. Default `npm run build` still runs the legacy route tree.
2. **Database cutover is not production-compatible yet.** `supabase/foundation/migrations/20261103000100_foundation.sql` is a baseline for an empty database and creates `public.profiles`, `organizations`, `projects`, `tasks`, etc. These names overlap the existing legacy schema. It is outside the historical production migration chain intentionally. Applying it directly would collide; dropping/resetting the current schema is not authorized. There is no reviewed non-destructive cutover, hosted marker initialization, Auth/storage transition or verified data-recovery plan.
3. **Dependency security gate is unresolved.** Current full audit reports 26 vulnerable packages: 2 critical, 17 high, 6 moderate, 1 low. Critical packages are development-only `vitest` and `tinypool`; they are not evidence of an exploit in the static production bundle. Runtime-only audit reports **0 critical but 6 high** packages: `@remix-run/router`, `react-router`, `react-router-dom`, `lodash`, `ws`, `zod`. Triage reachability and apply supported fixes with lockfile, peer resolution and regression tests before release. No forced/broad upgrade was attempted during handoff.

Critical advisory references: [Vitest UI server](https://github.com/advisories/GHSA-5xrq-8626-4rwp), [Tinypool run options](https://github.com/advisories/GHSA-85c8-ppgw-ccpr), [Tinypool worker options](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3). Avoid exposing development/test servers; do not treat that mitigation as a completed dependency fix.

## Architecture and stack

Existing React/Vite SPA, React 19.3.1, TypeScript, Tailwind 4.3.4, HeroUI 3.2.7, React Router 6, TanStack Query 5; retained Radix/shadcn families and custom task/card surfaces. dnd-kit handles board dragging. Supabase provides Auth, Postgres/RLS, private Storage and authorized transaction RPCs. `package-lock.json` is authoritative; use `npm ci`, never forced peer installs.

Canonical hierarchy: organization → independent client business or internal initiative → optional engagement → project/work context → boards/columns → authoritative tasks plus multiple task assignments. Operational contexts can hold tasks without fake clients/projects. Each task has one home board, or no board for operational work; alternate views never clone tasks. Custom columns map to canonical reporting categories. Context locks, revision checks, composite foreign keys and actor/request receipts protect ordering, tenancy, stale writes and retries. Database authorization is authoritative.

Important implementation files: `src/features/foundation/{api,FoundationWorkspace,ProductionWorkspace,ProductionEditor,UnifiedTasks,unifiedTaskFilters,taskViewCache}.tsx/ts`; `src/lib/taskDueDates.ts`; `src/design-system/controls.tsx`; `supabase/foundation/{migrations,tests}`. Refer to actual filenames rather than assuming the mixed extensions in this shorthand.

## Environment requirements — names only

Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` (legacy metadata), `VITE_APP_URL`, `VITE_ORDO_ARCHITECTURE`, `VITE_ORDO_ENVIRONMENT`, optional `VITE_ENABLE_GOOGLE_AUTH`.

Local runtime wrapper sets `SUPABASE_HOME` and `SUPABASE_EXPERIMENTAL_STACK` and deliberately strips `SUPABASE_ACCESS_TOKEN` before local CLI execution. Local generated connection variables include `API_URL` and `DB_URL`; keep them private. Deployment administration needs appropriately scoped authenticated Supabase/Hostinger access, not frontend service-role credentials. Existing server-side email uses `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` (TLS port is fixed in the existing function); see `docs/hostinger-email-setup.md` before changing that service.

`.env.foundation.local`, `.foundation-runtime/`, `.design-system/`, dependencies and build output must not be uploaded or committed. Synthetic local account passwords are in ignored `.foundation-runtime/accounts.json` only. Existing tracked `.env`/`.env.production` contain browser configuration; treat publishable keys as public, never replace them with admin/service-role secrets. A narrow tracked-file credential-pattern scan found no private-key / `sb_secret_` / GitHub token matches; this is not exhaustive history certification. Handoff includes no secret values.

## Run locally

```sh
git clone --branch codex/heroui-v3-proof https://github.com/theexousiamatt/useordo.git
cd useordo
npm ci
npm run foundation:setup
npm run dev:foundation
```

Open the URL printed by Vite (default loopback port 5182). Setup downloads the pinned native Supabase development services, verifies local target identity, applies canonical migrations and seeds **local-only** synthetic accounts. The verified native setup was macOS ARM; other platforms need their own runtime qualification. Keep API/DB ports 54321/54322 free. Use a dedicated local instance; do not link this foundation workdir to production.

For the current desktop workspace, the live development app is on port **5192**, using the original checkout's guarded local services. Use `npm run foundation:start` from the original checkout if those services need starting. Do not bootstrap from its older migration tree: the shared local DB already contains later migrations from the continuation worktree and correctly rejects unknown history. Do not bypass this check or reset either runtime. For independent continuation, prefer a clean clone and isolated services after stopping conflicting local services; do not copy runtime state/password files into GitHub/ChatGPT.

```sh
npm run typecheck
npm run lint:foundation
npm test -- --maxWorkers=2
npm run test:foundation:safety
npm run verify:foundation:local
npm run build
npm run build:foundation
npm audit
npm audit --omit=dev
```

`verify:foundation:local` runs fresh isolated PostgreSQL/PGlite tests; it is not a hosted migration command. `verify:foundation:runtime` requires the dedicated seeded local runtime and exercises Auth/Storage transport; never point runtime integration tests or fixture scripts at production. `verify-production-writes-local.mjs` provides real two-connection concurrency checks; its prior invocation and guarded runtime arrangement are recorded in Increment 3's report.

## Migration and eventual deployment instructions

- Historical production chain: `supabase/migrations`; separate canonical chain: `supabase/foundation/migrations` (five files, baseline then authorized writes, assignee lookup fix, movement, unified tasks). Canonical runtime tracks checksums in `foundation_meta.migrations`; applied files must not be edited.
- Current canonical migrations are tested **locally only**. There is no approved production command to run them against the legacy schema. Never use `foundation:reset`, local seed scripts, schema drops or test SQL on production.
- Shortest safe release preparation: obtain actual production-project administration and inspect schema/ledger/Auth/storage/backup state; choose and review a non-destructive hosted canonical target/cutover. A separate empty hosted database can avoid collisions, but provisioning/cost, identities, storage and transition require explicit decisions. No new paid service was created in this task.
- Implement a separate hosted production configuration/identity path with explicit target validation and tests. Retain local reset protections. Do not simply remove the guards or claim a local marker is production.
- Resolve security advisories and pass staging owner/member/client isolation, real Auth, creation, multiple assignments, drag/persistence, My Tasks/date and private-storage checks. Verify canonical client features only if actually implemented.
- Before cutover, record the old artifact SHA, capture protected DB/Auth/storage backups and verify restore procedures. Keep schema changes additive/reviewed; an application rollback alone cannot undo incompatible schema changes.
- Only after gates pass, build the hosted canonical release with its correct environment, inspect bundle contents for local targets/fixtures/secrets, then use the established artifact branch/Hostinger deployment path. The current publisher must first be made to select that verified build. Preserve static history, do not force-push, and verify desktop/mobile plus fresh sign-in and real persistence after deployment.
- Existing production was not changed, so no rollback is needed now. Its artifact branch/history remains intact; data-backup availability has **not** been verified.

## Completed and verified functionality

- Phase 1 canonical tenant/context model, organization/client/internal-project setup, Auth integration, authorization, RLS/private-storage boundaries and transactional creation.
- HeroUI platform foundation and complete project-creation overlay family, semantic Ordo adapter/tokens. Existing visual language/custom task surfaces retained. Broad migration/dark polish frozen.
- Increment 1 canonical board reads; Increment 2 authorized board/column/task writes, descriptions/priorities/date/multiple assignees; Increment 3 persisted movement, safe board/task archive/restore and integrity-preserving cross-board moves.
- Increment 4 My Tasks across authorized project/initiative/operational assignments; project/context, priority/status/assignee and date filters, counts, URL filter persistence, direct canonical editing/cache invalidation. Monday–Sunday, local date-only deadlines; individually archived/completed excluded from open work, assigned incomplete tasks on archived boards retained. Operational existing tasks can be edited without a board.
- Latest release checks: **143/143 frontend tests in 26 files**, **17/17 target-safety tests**, **7 SQL suites twice**, TypeScript, focused lint, normal production build and foundation build passed. Initial unrestricted run had test timing failures; bounded workers plus a 5-second wait for the lazy editor passed the full suite. No runtime feature code changed during handoff.
- Prior local browser verification covered actual sign-in, studio/project creation, board/task updates, multi-project deadlines, reload/fresh sign-in, cross-view identity/persistence and desktop/mobile. See [Increment 4 report](mvp-increment-4.md), [Increment 3 report](mvp-increment-3.md), [Phase 1 verification](phase-1-verification.md), [HeroUI verification](frontend/phase-2-0-verification.md).
- Synthetic UI evidence: [desktop My Tasks](evidence/mvp/increment4-my-tasks-desktop.png), [mobile My Tasks](evidence/mvp/increment4-my-tasks-mobile.png). Release rerun logs/audit JSON are ignored under `.design-system/release-*` locally; they are not required for a fresh clone to rerun checks.

## Unfinished work and limitations

**Increment 5 has preparation only.** No canonical client portal/publication/review implementation was completed. Client contacts/access-grant scaffolding does not expose canonical internal records. Do not claim submissions, published Figma/Drive library, feedback, approvals, material collection or permanent handover access work in the canonical MVP. Existing live legacy client routes are not equivalent and were not client-role certified in this handoff.

Canonical member/client invitations and everyday team onboarding need qualification/completion; multiple assignments currently require eligible existing identities. Operational task creation/management UI is not a complete standalone workflow. Permanent board deletion, board/column reorder/duplication/templates, broader project views, advanced product/recurrence capabilities, automation and notifications remain deferred. Keep archive/recovery behavior, do not silently delete tasks.

Known release issues: local-only architecture/cutover blockers above; outstanding dependency advisories; large main bundle (normal build main chunk about 753kB / 221kB gzip, plus other chunks); initial unrestricted test timing instability; no physical-device/cross-browser certification. Dark mode remains provisional. No production canonical smoke or backup restore was certified. See [MVP checklist](mvp-checklist.md) for scope, not a claim that every original brief requirement is done.

## Preservation and safe continuation

Two worktrees were checked:

- `ordo-heroui-v3-proof`, branch `codex/heroui-v3-proof`: completed/tested canonical implementation and this handoff; continue here or in a clean clone of this branch.
- `ordo`, branch `codex/owned-supabase-backend`: **has unrelated uncommitted changes**. They were not stashed, overwritten, reset, merged or blindly committed. Completed Phase 1 was already preserved in ancestor `c2be71e` before HeroUI work began.

Additional local preservation beside both checkouts: `ordo-pre-handoff.bundle` (all available Git refs), `ordo-handoff-preservation/original-tracked.patch`, `original-untracked.tar.gz` (61 untracked files) and `original-status.txt`. These are local recovery artifacts, **not an additional tested GitHub branch**. Live screenshots remain in that private local preservation directory to avoid publishing real workspace contents; synthetic screenshots above are committed. Do not upload private runtime/credential files when transferring the original checkout. Its uncommitted work still needs a selective review if needed later.

Author is confirmed repository-local `Matt <matt@inspirarestudio.com>`; global Git configuration was not changed. No force-push or merge into main/static was performed.

## Production release continuation — 10 November 2026 (subsequent session)

**Deployment remains blocked; no database/project/Hostinger mutations were made.** The connected Supabase account lists only `cjyhayrxadyadaqdrlot` in organization `ajhycehqpsnxuvqzzrij` (EU West). This is not the legacy production project `ilvqopsvyacegotplstw` and was not repurposed. A separate Ordo-owned project has **not** been created: organization selection and cost clearance are pending. The legacy project remains untouched. No synthetic accounts were uploaded.

**Repository-side source work committed on `codex/heroui-v3-proof`:** explicit hosted build modes `foundation-staging` and `foundation-production`, pinned hosted project reference and API origin, exact application hostname, segregated browser auth storage keys, and hosted `foundation_environment_info` response comparison before canonical business access. The dedicated local mode and target-reset safety CLI remain unchanged. New sample environment files contain no actual Supabase endpoint or key. Hosted environment tests were added. The canonical release candidate script `scripts/prepare-hostinger-canonical.sh` runs build/test checks and artifact string scanning, **but never publishes**. The existing Hostinger script now requires explicit `--legacy` to prevent an accidental wrong-app deployment.

**Verification limits:** No project provisioning, migration application, remote Auth configuration, private Storage inspection, lockfile dependency remediation, fresh install, TypeScript/test/audit execution or hosted acceptance tests were completed in this connector-only session. Source edits are committed but **not runtime-verified**. Do not claim production-safe release readiness on this basis. In particular, the environment comparison does not replace actual target ownership verification, migration verification, hosted tenancy tests or backup/restore drills.

**Next blocked action:** identify and confirm the Supabase organization designated for the new Ordo project, obtain zero-cost confirmation or approval for nonzero charges, create a fresh project, then verify its ID and ownership. Apply the five canonical migrations exclusively to that verified empty target, initialize the correct hosted marker (not synthetic users), review Auth redirect allowlist, RLS, storage and execution permissions. Resolve runtime dependency advisories with a tested lockfile update, execute regression and hosted staging tests, independently verify rollback/restore, and only then authorize the artifact cutover. The live URL and static artifact branch must remain unchanged until all gates pass.

## Next actions for ChatGPT

1. Read this handoff and the actual safety-gate files, then resolve hosted canonical deployment/cutover and production-project access; do not repeat the broad architecture audit or continue feature work first.
2. Triage/fix the dependency advisories with normal peer resolution and focused regression checks; retain the lockfile.
3. Qualify a staging release and backup/restore path, then ship only after the release gates above pass. The user has authorized the existing production deployment subject to those gates, not destructive production operations.
4. After safe core release, resume [Increment 5's small implementation slices](mvp-increment-5-preparation.md): client-only safe project projection/access → explicit published deliverable versions/links → version-bound feedback/decisions → materials/permanent library. Preserve client isolation and private-by-default publication.

No subagents unless requested. Keep updates brief, inspect relevant files only, reuse findings and components, avoid optional HeroUI polish, run checks appropriate to each change, document the result and stop.
