import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { isIP } from "node:net";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const DEFAULT_MANIFEST = fileURLToPath(new URL("../config/foundation-targets.json", import.meta.url));
const PROTECTED_REFS = ["ilvqopsvyacegotplstw"];
const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;
const PROJECT_REF = /^[a-z0-9]{20}$/;

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function serviceUrl(value) {
  requireValue(typeof value === "string" && value.length > 0, "A Supabase service URL is required.");
  let url;
  try { url = new URL(value); } catch { throw new Error("Invalid Supabase service URL."); }
  requireValue(!url.username && !url.password, "Credentials in service URLs are forbidden.");
  requireValue(url.pathname === "/" && !url.search && !url.hash, "Use the Supabase service origin without a path, query or fragment.");
  return url;
}

function host(value) {
  requireValue(typeof value === "string" && value.length > 0, "A database host is required.");
  requireValue(value === value.toLowerCase() && !value.endsWith("."), "Use a normalized lowercase database host.");
  requireValue(isIP(value) || value === "[::1]" || /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(value), "Invalid database host; credentials and connection strings are forbidden.");
  return value;
}

function port(value) {
  requireValue(/^[0-9]+$/.test(String(value)), "A numeric database port is required.");
  const result = Number(value);
  requireValue(Number.isInteger(result) && result > 0 && result <= 65535, "Invalid database port.");
  return result;
}

function tableName(value) {
  const parts = typeof value === "string" ? value.split(".") : [];
  requireValue(parts.length === 2 && parts[0] === "public" && parts.every((part) => IDENTIFIER.test(part)), "Only explicit public application-table names are allowed.");
  return parts.map((part) => `"${part}"`).join(".");
}

function protectedRefs(manifest) {
  requireValue(Array.isArray(manifest.protectedProjectRefs), "The manifest must declare protected project references.");
  requireValue(manifest.protectedProjectRefs.every((ref) => typeof ref === "string" && PROJECT_REF.test(ref)), "Invalid protected project reference.");
  return [...new Set([...PROTECTED_REFS, ...manifest.protectedProjectRefs])];
}

function assertUnprotected(refs, projectRef, url, dbHost) {
  for (const ref of refs) {
    requireValue(projectRef !== ref && url.hostname !== `${ref}.supabase.co` && dbHost !== `db.${ref}.supabase.co`, "Protected production target denied.");
  }
}

/** Validate configuration only. Database identity is checked again by reset SQL. */
export function validateManifest(manifest) {
  requireValue(manifest && manifest.schemaVersion === 1, "Unsupported foundation target manifest.");
  const refs = protectedRefs(manifest);
  requireValue(manifest.targets && typeof manifest.targets === "object" && !Array.isArray(manifest.targets), "Named development targets are required.");
  requireValue(Object.keys(manifest.targets).length > 0, "At least one explicit development target is required.");
  requireValue(manifest.schemaMarker && manifest.schemaMarker.version === "ordo-foundation-v1", "The canonical foundation schema marker is required.");
  tableName(manifest.schemaMarker.table);
  requireValue(Array.isArray(manifest.applicationTables), "An explicit application-table reset allowlist is required.");
  manifest.applicationTables.forEach(tableName);
  requireValue(new Set(manifest.applicationTables).size === manifest.applicationTables.length, "Duplicate application-table names are forbidden.");
  requireValue(!manifest.applicationTables.includes(manifest.schemaMarker.table), "The environment marker must survive application-record resets.");
  for (const [name, target] of Object.entries(manifest.targets)) {
    requireValue(/^[a-z][a-z0-9-]*$/.test(name), "Invalid development target name.");
    requireValue(target && target.environment === "development", "Only development targets may be allowlisted.");
    const url = serviceUrl(target.supabaseUrl);
    const dbHost = host(target.dbHost);
    port(target.dbPort);
    assertUnprotected(refs, target.projectRef, url, dbHost);
    requireValue(target.databaseName === "postgres", "The target must explicitly name its postgres database.");
    requireValue(typeof target.workdir === "string" && target.workdir.length > 0 && !target.workdir.startsWith("/") && !target.workdir.split(/[\\/]/).some((part) => part === ".."), "Use an explicit repository-relative foundation workdir.");
    if (target.kind === "local") {
      requireValue(target.projectRef === "local" && url.protocol === "http:" && LOOPBACK.has(url.hostname) && LOOPBACK.has(dbHost), "Local targets require a known loopback Supabase URL, loopback database host and local project reference.");
      requireValue(target.databaseUser === "postgres", "Local development must explicitly use its postgres database user.");
    } else {
      requireValue(target.kind === "remote" && PROJECT_REF.test(target.projectRef), "Remote development requires an explicit valid project reference.");
      requireValue(url.protocol === "https:" && url.hostname === `${target.projectRef}.supabase.co` && !url.port, "The development service URL and project reference do not match.");
      const direct = dbHost === `db.${target.projectRef}.supabase.co` && target.databaseUser === "postgres";
      const pooled = /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(dbHost) && target.databaseUser === `postgres.${target.projectRef}`;
      requireValue(direct || pooled, "The development database host/user and project reference do not match.");
    }
  }
  return manifest;
}

export function loadManifest(path = DEFAULT_MANIFEST) {
  return validateManifest(JSON.parse(readFileSync(path, "utf8")));
}

/** Inputs must come from explicit foundation arguments, never linked CLI state. */
export function validateTarget(manifest, targetName, inputs) {
  validateManifest(manifest);
  requireValue(typeof targetName === "string" && Object.hasOwn(manifest.targets, targetName), "An explicitly allowlisted development target name is required.");
  const target = manifest.targets[targetName];
  const url = serviceUrl(inputs?.supabaseUrl);
  const dbHost = host(inputs?.dbHost);
  const dbPort = port(inputs?.dbPort);
  assertUnprotected(protectedRefs(manifest), inputs?.projectRef, url, dbHost);
  requireValue(inputs?.projectRef === target.projectRef, "Configured and requested project references do not match.");
  requireValue(url.origin === serviceUrl(target.supabaseUrl).origin, "Configured and requested Supabase service URLs do not match.");
  requireValue(dbHost === target.dbHost && dbPort === target.dbPort, "Configured and requested database endpoints do not match.");
  return { name: targetName, ...target };
}

export function buildResetPlan(manifest, targetName, inputs) {
  const target = validateTarget(manifest, targetName, inputs);
  requireValue(manifest.applicationTables.length > 0, "Reset denied: the application-table allowlist is empty.");
  const marker = tableName(manifest.schemaMarker.table);
  const sql = `DO $foundation_guard$\nBEGIN\n  IF (SELECT count(*) FROM ${marker}) <> 1 OR NOT EXISTS (\n    SELECT 1 FROM ${marker}\n    WHERE singleton IS TRUE AND environment = 'development'\n      AND target_ref = '${target.projectRef}' AND schema_version = 'ordo-foundation-v1'\n  ) THEN\n    RAISE EXCEPTION 'Foundation development identity mismatch; reset denied';\n  END IF;\nEND\n$foundation_guard$;\n\nTRUNCATE TABLE\n  ${manifest.applicationTables.map(tableName).join(",\n  ")}\nRESTART IDENTITY;\n`;
  return {
    target,
    configurationSha256: createHash("sha256").update(JSON.stringify(manifest)).digest("hex"),
    executable: "psql",
    args: ["--no-psqlrc", "--host", target.dbHost, "--port", String(target.dbPort), "--dbname", target.databaseName, "--username", target.databaseUser, "--set", "ON_ERROR_STOP=1", "--single-transaction", "--file", "-"],
    sql,
    scope: "Development application records only; Auth, Storage, schema marker and static catalogs are preserved.",
  };
}

function cli(argv) {
  const [operation, ...args] = argv;
  requireValue(["validate", "plan", "reset"].includes(operation), "Use validate, plan or reset with an explicit --target and foundation endpoint arguments.");
  const options = {};
  const values = new Set(["--target", "--manifest", "--supabase-url", "--project-ref", "--db-host", "--db-port"]);
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    requireValue(!Object.hasOwn(options, key), "Duplicate arguments are forbidden.");
    if (key === "--execute" || key === "--dry-run") options[key] = true;
    else {
      requireValue(values.has(key) && args[i + 1] && !args[i + 1].startsWith("--"), "Unknown argument or missing value.");
      options[key] = args[++i];
    }
  }
  requireValue(!(options["--execute"] && options["--dry-run"]), "Choose --execute or --dry-run.");
  requireValue(operation === "reset" || !options["--execute"], "Execution is available only for the reset operation.");
  const manifest = loadManifest(options["--manifest"]);
  const inputs = {
    supabaseUrl: options["--supabase-url"], projectRef: options["--project-ref"],
    dbHost: options["--db-host"], dbPort: options["--db-port"],
  };
  if (operation === "validate") {
    process.stdout.write(JSON.stringify({ configuredTarget: validateTarget(manifest, options["--target"], inputs), databaseIdentityVerified: false }, null, 2) + "\n");
    return;
  }
  const plan = buildResetPlan(manifest, options["--target"], inputs);
  if (operation !== "reset" || !options["--execute"]) {
    process.stdout.write(JSON.stringify({ dryRun: true, ...plan }, null, 2) + "\n");
    return;
  }
  const env = { ...process.env };
  // PGHOSTADDR/PGSERVICE can redirect a connection despite a supplied host.
  for (const key of Object.keys(env)) if (key.startsWith("PG") && key !== "PGPASSWORD") delete env[key];
  env.PGSSLMODE = plan.target.kind === "remote" ? "require" : "disable";
  env.PGCONNECT_TIMEOUT = "10";
  const result = spawnSync(plan.executable, plan.args, { input: plan.sql, stdio: ["pipe", "inherit", "inherit"], env, shell: false });
  if (result.error) throw new Error("Reset could not start. Install psql and verify the development connection; no fallback target was used.");
  requireValue(result.status === 0, "Development reset failed; the transaction was not committed.");
  process.stdout.write(`Reset development application records for ${plan.target.name}.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { cli(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
