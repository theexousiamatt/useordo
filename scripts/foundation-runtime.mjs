#!/usr/bin/env node
// Dedicated local foundation lifecycle. No linked projects or inherited DB URLs.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { loadManifest, validateTarget, buildResetPlan } from "./foundation-target.mjs";

export const root = fileURLToPath(new URL("../", import.meta.url));
const privateDir = join(root, ".foundation-runtime");
const localInputs = { supabaseUrl: "http://127.0.0.1:54321", projectRef: "local", dbHost: "127.0.0.1", dbPort: 54322 };
const manifest = loadManifest();
const target = validateTarget(manifest, "foundation-local", localInputs);
mkdirSync(privateDir, { recursive: true, mode: 0o700 });

function privateJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
}
function runtimeHome() {
  const file = join(privateDir, "runtime.json");
  const saved = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")).supabaseHome : undefined;
  const home = saved || join(tmpdir(), "ordo-foundation-" + createHash("sha256").update(root).digest("hex").slice(0, 12));
  if (home.includes(" ")) throw new Error("The native runtime needs a dedicated path without spaces.");
  mkdirSync(home, { recursive: true, mode: 0o700 });
  privateJson(file, { supabaseHome: home });
  return home;
}
function cli(args) {
  const env = { ...process.env, SUPABASE_HOME: runtimeHome(), SUPABASE_EXPERIMENTAL_STACK: "1" };
  delete env.SUPABASE_ACCESS_TOKEN;
  const result = spawnSync(join(root, "node_modules/.bin/supabase"), [...args, "--workdir", target.workdir], {
    cwd: root, env, encoding: "utf8", maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    writeFileSync(join(privateDir, "cli-error.log"), (result.stderr || "") + (result.stdout || ""), { mode: 0o600 });
    throw new Error("Local Supabase command failed. See ignored .foundation-runtime/cli-error.log; no remote fallback was used.");
  }
  return result.stdout;
}
export function getLocalStatus() {
  const status = JSON.parse(cli(["stack", "status", "--output-format", "json"]));
  if (status.owner !== "reachable" || status.readiness !== "ready") throw new Error("Start the dedicated local Supabase services first.");
  const env = status.env;
  const database = new URL(env.DB_URL);
  validateTarget(manifest, "foundation-local", {
    ...localInputs, supabaseUrl: env.API_URL, dbHost: database.hostname, dbPort: database.port,
  });
  if (!["postgres:", "postgresql:"].includes(database.protocol) || database.username !== "postgres"
      || database.pathname !== "/postgres" || database.search || database.hash) {
    throw new Error("Unexpected local database identity; connection denied.");
  }
  privateJson(join(privateDir, "status.json"), status);
  return { status, env, database };
}
export async function withLocalDatabase(run) {
  const local = getLocalStatus();
  const client = new pg.Client({
    host: target.dbHost, port: target.dbPort, user: "postgres", database: "postgres",
    password: decodeURIComponent(local.database.password), ssl: false, connectionTimeoutMillis: 10000,
  });
  await client.connect();
  try { return await run(client, local); } finally { await client.end(); }
}
export async function assertDatabaseMarker(client) {
  const marker = await client.query("SELECT environment,target_ref,schema_version FROM public.foundation_environment WHERE singleton");
  if (marker.rows.length !== 1 || marker.rows[0].environment !== "development"
      || marker.rows[0].target_ref !== "local" || marker.rows[0].schema_version !== "ordo-foundation-v1") {
    throw new Error("Database development identity mismatch; operation denied.");
  }
}
export async function bootstrapFoundation() {
  await withLocalDatabase(async (client) => {
    const marker = await client.query("SELECT to_regclass('public.foundation_environment') AS name");
    if (!marker.rows[0].name) {
      const existing = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'spatial_ref_sys'");
      if (existing.rows.length) throw new Error("Foundation bootstrap requires an empty application schema; no existing tables were removed.");
    } else {
      await assertDatabaseMarker(client);
    }
    await client.query("BEGIN");
    try {
      await client.query("CREATE SCHEMA IF NOT EXISTS foundation_meta; REVOKE ALL ON SCHEMA foundation_meta FROM PUBLIC,anon,authenticated");
      await client.query("CREATE TABLE IF NOT EXISTS foundation_meta.migrations(version text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())");
      const folder = join(root, "supabase/foundation/migrations");
      const files = readdirSync(folder).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
      const applied = await client.query("SELECT version,sha256 FROM foundation_meta.migrations");
      if (applied.rows.some((row) => !files.includes(row.version))) throw new Error("Unknown canonical migration history; bootstrap denied.");
      for (const name of files) {
        const sql = readFileSync(join(folder, name), "utf8");
        const checksum = createHash("sha256").update(sql).digest("hex");
        const previous = applied.rows.find((row) => row.version === name);
        if (previous) {
          if (previous.sha256 !== checksum) throw new Error("An applied migration changed. Add a new forward migration.");
          continue;
        }
        // The trusted baseline has an outer transaction; the lifecycle owns the
        // transaction here so schema, ledger and environment marker commit together.
        await client.query(sql.replace(/^BEGIN;\s*$/m, "").replace(/^COMMIT;\s*$/m, ""));
        await client.query("INSERT INTO foundation_meta.migrations(version,sha256) VALUES($1,$2)", [name, checksum]);
      }
      await client.query("INSERT INTO public.foundation_environment(singleton,environment,target_ref,schema_version) VALUES(true,'development','local','ordo-foundation-v1') ON CONFLICT(singleton) DO NOTHING");
      await assertDatabaseMarker(client);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    await client.query("NOTIFY pgrst, 'reload schema'");
  });
  console.log("Canonical foundation initialized on verified local development.");
}
function requestId(name) {
  const hex = createHash("sha256").update("ordo-foundation-fixture:" + name).digest("hex");
  return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-4" + hex.slice(13, 16) + "-a" + hex.slice(17, 20) + "-" + hex.slice(20, 32);
}
export function newPublicClient(local) {
  return createClient(local.env.API_URL, local.env.PUBLISHABLE_KEY || local.env.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(name + ": " + error.message);
  return data;
}
export async function seedFoundation() {
  const local = getLocalStatus();
  await withLocalDatabase(assertDatabaseMarker);
  const admin = createClient(local.env.API_URL, local.env.SECRET_KEY || local.env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const accountFile = join(privateDir, "accounts.json");
  const saved = existsSync(accountFile) ? JSON.parse(readFileSync(accountFile, "utf8")) : {};
  const { data: userPage, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  const accounts = {};
  for (const name of ["owner", "other", "member", "manager", "client", "client-two"]) {
    const email = name + "@ordo.example.invalid";
    let account = userPage.users.find((user) => user.email === email);
    const password = saved[name]?.password || "OrdoLocal!2026";
    if (account && saved[name]?.id !== account.id) throw new Error("A fixture email exists without its local fixture identity; refusing to replace its credentials.");
    if (!account) {
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name + " (local fixture)" } });
      if (error || !data.user) throw error || new Error("Fixture account could not be created.");
      account = data.user;
    }
    accounts[name] = { id: account.id, email, password };
  }
  privateJson(accountFile, accounts);
  const owner = newPublicClient(local), other = newPublicClient(local);
  for (const [client, name] of [[owner, "owner"], [other, "other"]]) {
    const { error } = await client.auth.signInWithPassword(accounts[name]);
    if (error) throw error;
  }
  const organizationId = await rpc(owner, "create_organization", { _name: "Inspirare Studio", _slug: "inspirare-foundation", _request_id: requestId("organization") });
  const otherOrganizationId = await rpc(other, "create_organization", { _name: "Other Studio", _slug: "other-foundation", _request_id: requestId("other-organization") });
  const clientId = await rpc(owner, "create_client_organization", { _organization_id: organizationId, _name: "Devine Apartments", _request_id: requestId("client") });
  const initiativeId = await rpc(owner, "create_internal_initiative", { _organization_id: organizationId, _name: "Lora", _request_id: requestId("initiative") });
  const internalProjectId = await rpc(owner, "create_project", {
    _organization_id: organizationId, _name: "Lora", _ownership: "internal", _discipline_keys: ["software", "growth"],
    _lifecycle: "continuous", _internal_initiative_id: initiativeId, _description: "Build and improve the studio’s product.", _request_id: requestId("internal-project"),
  });
  const clientProjectId = await rpc(owner, "create_project", {
    _organization_id: organizationId, _name: "Devine branding and website", _ownership: "client", _discipline_keys: ["branding", "web"],
    _lifecycle: "fixed_scope", _client_organization_id: clientId, _description: "Create a clear identity and website for the business.", _request_id: requestId("client-project"),
  });
  const otherProjectId = await rpc(other, "create_project", {
    _organization_id: otherOrganizationId, _name: "Other Studio internal project", _ownership: "internal",
    _discipline_keys: ["operations"], _lifecycle: "operational", _request_id: requestId("other-project"),
  });
  await withLocalDatabase(async (db) => {
    await assertDatabaseMarker(db);
    await db.query("BEGIN");
    try {
      for (const name of ["member", "manager", "client", "client-two"]) {
        await db.query("INSERT INTO public.profiles(id,full_name) VALUES($1,$2) ON CONFLICT(id) DO NOTHING", [accounts[name].id, name + " (local fixture)"]);
        const role = name.startsWith("client") ? "client" : name;
        await db.query("INSERT INTO public.organization_memberships(organization_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT(organization_id,user_id) DO NOTHING", [organizationId, accounts[name].id, role]);
      }
      await db.query("INSERT INTO public.work_context_memberships(organization_id,work_context_id,user_id,role) SELECT organization_id,work_context_id,$2,'contributor' FROM public.projects WHERE id=$1 ON CONFLICT DO NOTHING", [internalProjectId, accounts.member.id]);
      await db.query("INSERT INTO public.client_contacts(organization_id,client_organization_id,name,email) VALUES($1,$2,'Client contact without an account','contact@devine.example.invalid') ON CONFLICT DO NOTHING", [organizationId, clientId]);
      await db.query("COMMIT");
    } catch (error) { await db.query("ROLLBACK"); throw error; }
  });
  const fixtures = { organizationId, otherOrganizationId, clientId, initiativeId, internalProjectId, clientProjectId, otherProjectId };
  privateJson(join(privateDir, "fixtures.json"), fixtures);
  console.log("Synthetic studio, client, internal project and role fixtures seeded through real local Auth and commands.");
  return { accounts, fixtures };
}
export function writeFrontendEnvironment() {
  const local = getLocalStatus();
  const values = {
    VITE_ORDO_ARCHITECTURE: "foundation", VITE_ORDO_ENVIRONMENT: "development",
    VITE_APP_URL: "http://127.0.0.1:5182", VITE_SUPABASE_URL: local.env.API_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: local.env.PUBLISHABLE_KEY || local.env.ANON_KEY,
    VITE_ENABLE_GOOGLE_AUTH: "false",
  };
  writeFileSync(join(root, ".env.foundation.local"), Object.entries(values).map(([key, value]) => key + "=" + value).join("\n") + "\n", { mode: 0o600 });
  console.log("Foundation frontend configuration written; only the local public key is exposed to Vite.");
}
export async function resetFoundation() {
  const plan = buildResetPlan(manifest, "foundation-local", localInputs);
  await withLocalDatabase(async (db) => {
    await db.query("BEGIN");
    try { await db.query(plan.sql); await db.query("COMMIT"); }
    catch (error) { await db.query("ROLLBACK"); throw error; }
  });
  console.log("Verified local application records reset; Auth identities and object bytes retained.");
}
async function main() {
  const operation = process.argv[2];
  const flags = process.argv.slice(3);
  if (operation === "reset" ? flags.length !== 1 || flags[0] !== "--execute" : flags.length !== 0) {
    throw new Error("Unexpected or conflicting arguments. App-record reset requires exactly reset --execute; use the target plan command for a dry run.");
  }
  if (operation === "start" || operation === "setup") {
    cli(["start", "--runtime", "native", "--preparation", "on-demand", "--eager", "--exclude", "studio,functions,analytics,pooler,realtime", "--output-format", "json"]);
    console.log("Dedicated local Supabase services ready.");
  }
  if (operation === "bootstrap" || operation === "setup") await bootstrapFoundation();
  if (operation === "seed" || operation === "setup") await seedFoundation();
  if (operation === "env" || operation === "setup") writeFrontendEnvironment();
  if (operation === "status") {
    const { status } = getLocalStatus();
    console.log(JSON.stringify({ runtime: status.runtime, readiness: status.readiness, target: target.name, services: status.services.map((service) => ({ service: service.service, state: service.state })) }, null, 2));
  }
  if (operation === "reset") await resetFoundation();
  if (!["start", "bootstrap", "seed", "env", "setup", "status", "reset"].includes(operation)) {
    throw new Error("Use start, bootstrap, seed, env, setup, status or reset --execute.");
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
