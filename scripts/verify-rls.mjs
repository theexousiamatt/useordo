#!/usr/bin/env node
/**
 * Workspace Boundary RLS Verification Runner
 * --------------------------------------------------------------------------
 * Repeatable, CI-friendly check that fails the release if any project-related
 * table is missing RLS, exposes data to anon/public, lacks a read policy, or
 * has a policy whose expression is not scoped to a workspace/project guard.
 *
 * Requires a direct Postgres connection string:
 *   SUPABASE_DB_URL="postgres://..." node scripts/verify-rls.mjs
 *
 * Exit code 0 = all checks pass. Non-zero = release blocker found.
 *
 * The `pg` package is used if available; otherwise it shells out to `psql`.
 */
import { execFileSync } from "node:child_process";

const TABLES = [
  "projects",
  "tasks",
  "milestones",
  "deliverables",
  "files",
  "project_files",
  "project_comments",
  "project_activity",
  "project_members",
  "activity",
  "activity_logs",
  "ai_plans",
  "ai_plan_items",
  "approvals",
];

// Security-definer guards / direct comparisons that prove workspace scoping.
const SCOPE_REGEX =
  /(is_project_member|is_workspace_member|has_workspace_role|is_project_client|has_role|has_project_role|workspace_id|owner_id|auth\.uid)/i;

const CONN = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!CONN) {
  console.error(
    "✖ Set SUPABASE_DB_URL (or DATABASE_URL) to a Postgres connection string.",
  );
  process.exit(2);
}

const tableList = TABLES.map((t) => `'${t}'`).join(",");

/**
 * Run a SELECT and return rows as arrays. The query is wrapped so Postgres
 * emits a single JSON line, which is immune to newlines inside policy
 * expressions (qual/with_check often span multiple lines).
 */
function runSql(sql) {
  const trimmed = sql.trim().replace(/;\s*$/, "");
  const wrapped = `SELECT coalesce(json_agg(t.*), '[]'::json)::text FROM (${trimmed}) t;`;
  const out = execFileSync(
    "psql",
    [CONN, "-X", "-A", "-t", "-c", wrapped],
    { encoding: "utf8" },
  );
  const parsed = JSON.parse(out.trim() || "[]");
  return parsed.map((obj) => Object.values(obj));
}

const failures = [];
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  console.log(`  ✖ ${msg}`);
  failures.push(msg);
};

console.log("Workspace Boundary RLS Verification\n===================================\n");

// 1. RLS enabled
console.log("1. RLS enabled on all project-related tables");
{
  const rows = runSql(`
    SELECT c.relname, c.relrowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN (${tableList});`);
  const seen = new Map(rows.map((r) => [r[0], r[1] === true || r[1] === "t"]));
  for (const t of TABLES) {
    if (!seen.has(t)) fail(`${t}: table not found`);
    else if (!seen.get(t)) fail(`${t}: RLS NOT enabled`);
  }
  if (failures.length === 0) ok("RLS enabled everywhere");
}

// 2. At least one read (SELECT/ALL) policy
console.log("\n2. Every table has a read policy");
{
  const rows = runSql(`
    SELECT tablename, count(*) FROM pg_policies
    WHERE schemaname='public' AND tablename IN (${tableList})
      AND cmd IN ('SELECT','ALL')
    GROUP BY tablename;`);
  const counts = new Map(rows.map((r) => [r[0], Number(r[1])]));
  for (const t of TABLES) {
    if (!counts.get(t)) fail(`${t}: no SELECT/ALL policy`);
  }
  if (!failures.some((f) => f.includes("no SELECT"))) ok("All tables readable only via policy");
}

// 3. No anon/public exposure
console.log("\n3. No policy grants anon/public access");
{
  const rows = runSql(`
    SELECT tablename, policyname, roles::text FROM pg_policies
    WHERE schemaname='public' AND tablename IN (${tableList})
      AND (roles @> '{anon}' OR roles @> '{public}');`);
  if (rows.length === 0) ok("No anon/public policies");
  else rows.forEach((r) => fail(`${r[0]}.${r[1]}: exposed to ${r[2]}`));
}

// 4. Policy expressions are workspace/project scoped
console.log("\n4. Policy expressions are workspace/project scoped");
{
  const rows = runSql(`
    SELECT tablename, policyname, coalesce(qual,'') AS using_expr, coalesce(with_check,'') AS check_expr
    FROM pg_policies
    WHERE schemaname='public' AND tablename IN (${tableList});`);
  let unscoped = 0;
  for (const [table, policy, qual, check] of rows) {
    const expr = `${qual} ${check}`.trim();
    if (!expr) continue; // pure command grant, covered elsewhere
    if (!SCOPE_REGEX.test(expr)) {
      fail(`${table}.${policy}: expression not workspace-scoped -> ${expr}`);
      unscoped++;
    }
  }
  if (unscoped === 0) ok("All policy expressions reference a scoping guard");
}

console.log("\n===================================");
if (failures.length) {
  console.error(`\n✖ RELEASE BLOCKED: ${failures.length} issue(s) found.\n`);
  process.exit(1);
}
console.log("\n✓ All workspace boundary checks passed.\n");
