import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildResetPlan, loadManifest, validateManifest, validateTarget } from "./foundation-target.mjs";

const script = fileURLToPath(new URL("./foundation-target.mjs", import.meta.url));
const localInputs = {
  supabaseUrl: "http://127.0.0.1:54321", projectRef: "local", dbHost: "127.0.0.1", dbPort: 54322,
};
const fixture = () => structuredClone(loadManifest());
const remoteRef = "abcdefghijklmnopqrst";
function remoteFixture() {
  const manifest = fixture();
  manifest.targets = {
    "foundation-dev": {
      environment: "development", kind: "remote", projectRef: remoteRef,
      supabaseUrl: `https://${remoteRef}.supabase.co`, dbHost: `db.${remoteRef}.supabase.co`,
      dbPort: 5432, databaseName: "postgres", databaseUser: "postgres", workdir: "supabase/foundation",
    },
  };
  return manifest;
}
const args = ["--target", "foundation-local", "--supabase-url", localInputs.supabaseUrl,
  "--project-ref", "local", "--db-host", "127.0.0.1", "--db-port", "54322"];

test("validates the explicit local target without claiming database verification", () => {
  const target = validateTarget(fixture(), "foundation-local", localInputs);
  assert.equal(target.name, "foundation-local");
  assert.equal(target.workdir, "supabase/foundation");
  assert.equal(target.environment, "development");
});

test("requires a named target and complete endpoint arguments", () => {
  for (const name of [undefined, "", "unlisted-dev", "toString"]) {
    assert.throws(() => validateTarget(fixture(), name, localInputs), /allowlisted/);
  }
  for (const key of Object.keys(localInputs)) {
    const inputs = { ...localInputs }; delete inputs[key];
    assert.throws(() => validateTarget(fixture(), "foundation-local", inputs));
  }
});

test("rejects a protected production request before any command is generated", () => {
  const production = "ilvqopsvyacegotplstw";
  for (const inputs of [
    { ...localInputs, projectRef: production },
    { ...localInputs, supabaseUrl: `https://${production}.supabase.co` },
    { ...localInputs, dbHost: `db.${production}.supabase.co` },
  ]) assert.throws(() => buildResetPlan(fixture(), "foundation-local", inputs), /Protected production/);
});

test("cannot remove the built-in production protection through manifest edits", () => {
  const manifest = remoteFixture();
  manifest.protectedProjectRefs = [];
  Object.assign(manifest.targets["foundation-dev"], {
    projectRef: "ilvqopsvyacegotplstw", supabaseUrl: "https://ilvqopsvyacegotplstw.supabase.co",
    dbHost: "db.ilvqopsvyacegotplstw.supabase.co",
  });
  assert.throws(() => validateManifest(manifest), /Protected production/);
});

test("rejects unknown remote URLs, mismatched refs and mismatched database endpoints", () => {
  for (const inputs of [
    { ...localInputs, supabaseUrl: `https://${remoteRef}.supabase.co` },
    { ...localInputs, projectRef: remoteRef },
    { ...localInputs, dbHost: "localhost" },
    { ...localInputs, dbPort: 5432 },
  ]) assert.throws(() => validateTarget(fixture(), "foundation-local", inputs), /do not match/);
  assert.throws(() => validateTarget(remoteFixture(), "unlisted-dev", {
    supabaseUrl: `https://${remoteRef}.supabase.co`, projectRef: remoteRef,
    dbHost: `db.${remoteRef}.supabase.co`, dbPort: 5432,
  }), /allowlisted/);
});

test("rejects URL credentials without echoing their contents", () => {
  const secret = "synthetic-do-not-print";
  assert.throws(() => validateTarget(fixture(), "foundation-local", {
    ...localInputs, supabaseUrl: `http://user:${secret}@127.0.0.1:54321`,
  }), (error) => /Credentials/.test(error.message) && !error.message.includes(secret));
  assert.throws(() => validateTarget(fixture(), "foundation-local", {
    ...localInputs, dbHost: "postgres:synthetic@127.0.0.1",
  }), /Invalid database host/);
});

test("requires service origins and numeric ports, with no URL paths or connection strings", () => {
  for (const supabaseUrl of ["not a URL", `${localInputs.supabaseUrl}/rest/v1`, `${localInputs.supabaseUrl}?key=synthetic`, `${localInputs.supabaseUrl}#fragment`]) {
    assert.throws(() => validateTarget(fixture(), "foundation-local", { ...localInputs, supabaseUrl }));
  }
  for (const dbPort of ["54322junk", 0, 65536, -1]) {
    assert.throws(() => validateTarget(fixture(), "foundation-local", { ...localInputs, dbPort }));
  }
});

test("does not let a local target point at an arbitrary network host", () => {
  for (const overrides of [
    { supabaseUrl: "http://192.168.1.10:54321" },
    { dbHost: "192.168.1.10" },
    { supabaseUrl: "https://127.0.0.1:54321" },
  ]) {
    const manifest = fixture();
    Object.assign(manifest.targets["foundation-local"], overrides);
    assert.throws(() => validateManifest(manifest), /known loopback/);
  }
});

test("allows explicitly configured localhost and IPv6 loopback targets", () => {
  for (const [supabaseUrl, dbHost] of [["http://localhost:54321", "localhost"], ["http://[::1]:54321", "::1"]]) {
    const manifest = fixture();
    Object.assign(manifest.targets["foundation-local"], { supabaseUrl, dbHost });
    assert.equal(validateTarget(manifest, "foundation-local", { ...localInputs, supabaseUrl, dbHost }).kind, "local");
  }
});

test("allows a dedicated remote development project only with its matching pinned host", () => {
  const manifest = remoteFixture();
  const target = manifest.targets["foundation-dev"];
  assert.equal(validateTarget(manifest, "foundation-dev", target).projectRef, remoteRef);
  target.dbHost = "db.zyxwvutsrqponmlkjihg.supabase.co";
  assert.throws(() => validateManifest(manifest), /host\/user and project reference/);
});

test("binds a shared pooler host to the allowlisted development project through its database user", () => {
  const manifest = remoteFixture();
  const target = manifest.targets["foundation-dev"];
  target.dbHost = "aws-0-eu-west-1.pooler.supabase.com";
  target.dbPort = 6543;
  target.databaseUser = `postgres.${remoteRef}`;
  assert.equal(validateTarget(manifest, "foundation-dev", target).databaseUser, `postgres.${remoteRef}`);
  target.databaseUser = "postgres.ilvqopsvyacegotplstw";
  assert.throws(() => validateManifest(manifest), /host\/user and project reference/);
});

test("rejects production/staging allowlists, unsafe workdirs and malformed manifests", () => {
  for (const environment of ["production", "staging"]) {
    const manifest = fixture(); manifest.targets["foundation-local"].environment = environment;
    assert.throws(() => validateManifest(manifest), /Only development/);
  }
  for (const workdir of ["../supabase", "/supabase", "supabase/../../production"]) {
    const manifest = fixture(); manifest.targets["foundation-local"].workdir = workdir;
    assert.throws(() => validateManifest(manifest), /repository-relative/);
  }
  assert.throws(() => validateManifest({}), /Unsupported/);
});

test("limits reset identifiers to explicit public app tables and preserves the environment marker", () => {
  for (const table of ["auth.users", "storage.objects", "public.projects; DROP SCHEMA public", "public.foundation_environment"]) {
    const manifest = fixture(); manifest.applicationTables.push(table);
    assert.throws(() => buildResetPlan(manifest, "foundation-local", localInputs));
  }
  const duplicate = fixture(); duplicate.applicationTables.push(duplicate.applicationTables[0]);
  assert.throws(() => validateManifest(duplicate), /Duplicate/);
  const empty = fixture(); empty.applicationTables = [];
  assert.throws(() => buildResetPlan(empty, "foundation-local", localInputs), /allowlist is empty/);
});

test("generates a single guarded app-only transaction with no broad reset or linked fallback", () => {
  const manifest = fixture();
  const plan = buildResetPlan(manifest, "foundation-local", localInputs);
  assert.equal(plan.executable, "psql");
  assert.match(plan.configurationSha256, /^[a-f0-9]{64}$/);
  assert.ok(plan.args.includes("--single-transaction"));
  assert.ok(plan.args.includes("--no-psqlrc"));
  assert.deepEqual(plan.args.slice(-2), ["--file", "-"]);
  assert.match(plan.sql, /environment = 'development'/);
  assert.match(plan.sql, /target_ref = 'local'/);
  assert.match(plan.sql, /schema_version = 'ordo-foundation-v1'/);
  const truncation = plan.sql.slice(plan.sql.indexOf("TRUNCATE TABLE"));
  for (const table of manifest.applicationTables) {
    const [schema, name] = table.split(".");
    assert.ok(truncation.includes(`"${schema}"."${name}"`));
  }
  assert.doesNotMatch(truncation, /"(?:foundation_environment|capabilities|organization_role_capabilities|disciplines)"|"auth"\.|"storage"\.|CASCADE|DROP\b/);
  assert.doesNotMatch(plan.args.join(" "), /--linked|db reset|password|service-role/i);
});

test("CLI validation and dry-run work without connecting or requiring psql", () => {
  const validated = spawnSync(process.execPath, [script, "validate", ...args], { encoding: "utf8" });
  assert.equal(validated.status, 0, validated.stderr);
  assert.equal(JSON.parse(validated.stdout).databaseIdentityVerified, false);
  for (const suffix of [[], ["--dry-run"]]) {
    const dryRun = spawnSync(process.execPath, [script, "reset", ...args, ...suffix], { encoding: "utf8" });
    assert.equal(dryRun.status, 0, dryRun.stderr);
    assert.equal(JSON.parse(dryRun.stdout).dryRun, true);
  }
});

test("CLI refuses ambiguous flags and credentials without printing secrets", () => {
  for (const extras of [["--execute", "--dry-run"], ["--target", "foundation-local"], ["--linked"]]) {
    const result = spawnSync(process.execPath, [script, "reset", ...args, ...extras], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
  }
  const result = spawnSync(process.execPath, [script, "validate", "--target", "foundation-local",
    "--supabase-url", "http://user:synthetic-do-not-print@127.0.0.1:54321",
    "--project-ref", "local", "--db-host", "127.0.0.1", "--db-port", "54322"], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stdout + result.stderr, /synthetic-do-not-print/);
});


test("runtime reset rejects missing, extra and contradictory flags before connecting", () => {
  const runtime = fileURLToPath(new URL("./foundation-runtime.mjs", import.meta.url));
  for (const flags of [[], ["--dry-run"], ["--execute", "--dry-run"], ["--execute", "--target", "production"], ["--execute", "--execute"]]) {
    const result = spawnSync(process.execPath, [runtime, "reset", ...flags], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unexpected or conflicting arguments/);
  }
});
