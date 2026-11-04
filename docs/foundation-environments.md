# Foundation development environment

Phase 1 uses an isolated development backend for the canonical Ordo schema and synthetic fixtures. Existing application records may be replaced; production infrastructure, Auth identities and stored files are outside that authorization.

## Target boundaries

`config/foundation-targets.json` is a nonsecret allowlist. The initial target is `foundation-local`: Supabase service `http://127.0.0.1:54321`, database `127.0.0.1:54322`, logical project reference `local`, workdir `supabase/foundation`. A configured target does not prove that the service is running or that its schema has been installed.

The foundation CLI configuration lives at `supabase/foundation/supabase/config.toml`; foundation migrations remain under `supabase/foundation/migrations`. Keep the existing `supabase/config.toml` and historical production migration chain separate. Do not link the foundation workdir to production or run historical migrations as a substitute for the new baseline.

The existing hosted project `ilvqopsvyacegotplstw` is protected in both the manifest and validator code. Existing `.env`, `.env.local` and `.env.production` must not supply foundation backend credentials. No dedicated hosted development project is configured. To add one later, explicitly allowlist its development project reference, HTTPS service origin, exact database host, port and database user. A shared Supabase pooler additionally requires the project-specific `postgres.<development-ref>` user. Unknown remote targets are denied.

The lifecycle script writes an ignored `.env.foundation.local` using the isolated runtime’s public key. Manual setup may instead copy `.env.foundation.example` after obtaining that local key. Never copy a production key into the example or foundation configuration. The local native Supabase runtime stores its private state in a dedicated temporary directory without spaces, recorded in ignored `.foundation-runtime/runtime.json`; this avoids native PostgreSQL extension issues with spaces in the workspace path. `SUPABASE_HOME` is scoped to that runtime rather than global Supabase state. Do not print ignored status/account/error files: they can contain local credentials. The frontend's foundation mode uses `VITE_ORDO_ARCHITECTURE=foundation` and `VITE_ORDO_ENVIRONMENT=development`.

## Run the verified local slice

From the repository root:

```sh
npm ci
npm run foundation:setup
npm run dev:foundation
```

Open `http://127.0.0.1:5182`. Setup starts the pinned Supabase native development runtime, verifies loopback service/database identity, applies the canonical baseline transactionally, seeds synthetic accounts and writes the frontend's public configuration. No Docker dependency is needed on this verified macOS ARM setup. This runtime is development infrastructure, not the production deployment model. The first setup downloads official native service binaries and needs network access; local services must be reachable by the execution environment.

Synthetic sign-in details are stored only in ignored `.foundation-runtime/accounts.json`. Do not reuse these test accounts/passwords on a hosted environment. `.foundation-runtime/status.json` contains local runtime secrets; never publish it. `foundation:status` prints a safe service summary.

```sh
npm run foundation:status
npm run foundation:bootstrap
npm run foundation:seed
npm run verify:foundation:runtime
```

Bootstrap is checksum guarded: an unknown/nonempty application schema or an edited applied migration is rejected. Later schema edits require forward canonical migrations. Repeating the seed reuses request receipts and fixture identities. Synthetic fixture users are confirmed through local Auth admin; client businesses and contacts do not require login accounts.

To deliberately reset **only the verified local application records**, then restore fixtures:

```sh
npm run foundation:reset -- --execute
npm run foundation:seed
```

The runtime wrapper uses a local PostgreSQL driver, so this path does not need a global `psql` install. Missing, extra or conflicting arguments are rejected before connection. It uses the same reviewed allowlist/marker transaction described below. Auth identities and physical Storage bytes survive; their application permissions/metadata must be reseeded. Existing private object bytes do not become readable without matching authorized metadata. No production command is part of this lifecycle.

## Validate configuration without connecting

The safety CLI consumes explicit arguments. It does not load environment files, infer `DATABASE_URL`, use Supabase linked-project state or fall back to a default target.

```sh
node scripts/foundation-target.mjs validate \
  --target foundation-local \
  --supabase-url http://127.0.0.1:54321 \
  --project-ref local \
  --db-host 127.0.0.1 \
  --db-port 54322
```

This checks the allowlist, development classification and matching service/project/database identities. It rejects production, unknown targets, URL credentials, non-origin URLs and mismatches. It performs no network request and reports `databaseIdentityVerified: false`. The returned configuration fingerprint is an audit aid, not evidence of a verified connection.

## Bootstrap identity deliberately

The baseline creates an **empty** `public.foundation_environment` marker. After independently verifying the isolated runtime or dedicated development project, bootstrap one marker row with `environment='development'`, `target_ref='local'` for the initial target, and `schema_version='ordo-foundation-v1'`. The singleton marker must describe the actual configured target; do not create it automatically from a production environment file. Apply the matching canonical migrations and deterministic synthetic fixtures only to that verified development target.

The frontend can inspect the nonsecret singleton identity through `public.foundation_environment_info()`. That RPC returns only environment, target reference and schema version; it returns no rows before bootstrap. Anonymous/authenticated callers do not receive direct marker-table access or any user records through this check.

The baseline and reset wrapper preserve separation between application records and managed Auth/Storage. Existing managed accounts require their corresponding application profile/membership fixtures to be recreated after an application-record reset.

## Review an application-record reset

```sh
node scripts/foundation-target.mjs reset --dry-run \
  --target foundation-local \
  --supabase-url http://127.0.0.1:54321 \
  --project-ref local \
  --db-host 127.0.0.1 \
  --db-port 54322
```

Dry-run is also the default when neither reset flag is supplied. It generates a command/SQL plan without connecting or writing files. `plan` produces the same reviewable plan. Programmatic callers may import `loadManifest`, `validateManifest`, `validateTarget` and `buildResetPlan` from `scripts/foundation-target.mjs`.

An actual verified development application-record reset uses the same command with `--execute` instead of `--dry-run`, requires `psql`, and obtains its password through the process environment rather than command arguments. Do not put passwords, service keys or database connection URLs in the manifest or plan.

Execution uses the exact allowlisted host, port, database and user, disables psql startup files, strips inherited PostgreSQL routing overrides, stops on errors and wraps the operation in one transaction. Its SQL first requires the exact development environment marker and schema version. A missing or mismatched marker aborts. It then truncates only the explicit canonical application-table allowlist, without `CASCADE`.

Auth tables, Storage objects, the environment marker and static capability/discipline catalogs are excluded. Additional dependencies fail the transaction rather than expanding deletion. This wrapper never invokes `supabase db reset`, a linked-target fallback, broad schema drops or managed Auth/Storage cleanup. Physical development files can consequently remain after their application asset records are reset; deliberate file cleanup is a separate operation.

A local application-record reset and repeated synthetic seed were exercised for Phase 1. Production reset, hosted-project replacement, Auth deletion, Storage deletion and production cutover require their own explicit scope and confirmation.

## Tooling verification

```sh
node --test scripts/foundation-target.test.mjs
```

The tests use synthetic configuration and child-process dry-runs. They do not contact Supabase, invoke psql or change database/Auth/Storage records.
