#!/usr/bin/env node
/** Real local Auth, REST/RLS, RPC and object-byte checks. Never hosted targets. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { root, getLocalStatus, withLocalDatabase, assertDatabaseMarker, newPublicClient } from "./foundation-runtime.mjs";

const local = getLocalStatus();
const accounts = JSON.parse(readFileSync(join(root, ".foundation-runtime/accounts.json"), "utf8"));
const fixtures = JSON.parse(readFileSync(join(root, ".foundation-runtime/fixtures.json"), "utf8"));
const checks = [];
function passed(name) { checks.push(name); console.log("PASS " + name); }
async function data(resultPromise) {
  const result = await resultPromise;
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
const clients = {};
for (const name of Object.keys(accounts)) {
  const client = newPublicClient(local);
  await data(client.auth.signInWithPassword({ email: accounts[name].email, password: accounts[name].password }));
  assert.equal((await data(client.auth.getUser())).user.id, accounts[name].id);
  clients[name] = client;
}
const owner = clients.owner, other = clients.other, member = clients.member, manager = clients.manager;
const anonymous = newPublicClient(local);
const admin = createClient(local.env.API_URL, local.env.SECRET_KEY || local.env.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
await withLocalDatabase(assertDatabaseMarker);
const identity = await data(anonymous.rpc("foundation_environment_info"));
assert.deepEqual(identity, [{ environment: "development", target_ref: "local", schema_version: "ordo-foundation-v1" }]);
passed("local backend identity verified before business queries");
const ownerOrgs = await data(owner.rpc("list_my_organizations"));
assert.deepEqual(ownerOrgs.map((row) => row.id), [fixtures.organizationId]);
assert.ok(ownerOrgs[0].capabilities.includes("projects.create"));
assert.deepEqual((await data(other.rpc("list_my_organizations"))).map((row) => row.id), [fixtures.otherOrganizationId]);
passed("real verified sessions resolve only authorized studios and effective capabilities");
const ownerProjects = await data(owner.from("projects").select("id,ownership,client_organization_id,lifecycle"));
assert.ok(ownerProjects.some((row) => row.id === fixtures.clientProjectId && row.ownership === "client"));
assert.ok(ownerProjects.some((row) => row.id === fixtures.internalProjectId && row.client_organization_id === null));
assert.ok(!ownerProjects.some((row) => row.id === fixtures.otherProjectId));
assert.deepEqual(await data(owner.from("projects").select("id").eq("id", fixtures.otherProjectId)), []);
assert.deepEqual((await data(member.from("projects").select("id"))).map((row) => row.id), [fixtures.internalProjectId]);
for (const name of ["client", "client-two"]) {
  assert.deepEqual(await data(clients[name].from("projects").select("id")), []);
  assert.deepEqual(await data(clients[name].from("tasks").select("id")), []);
  assert.deepEqual(await data(clients[name].from("engagements").select("id")), []);
}
passed("cross-studio, assigned-member, internal-work and client-commercial boundaries enforced through REST");

for (const actor of [anonymous, clients.client, member]) {
  const denied = await actor.rpc("create_project", { _organization_id: fixtures.organizationId, _name: "Unauthorized",
    _ownership: "internal", _discipline_keys: [], _lifecycle: "fixed_scope", _request_id: "aa000000-0000-4000-a000-000000000001" });
  assert.ok(denied.error, "unauthorized create must fail");
}
const escalation = await member.from("organization_memberships").update({ role: "owner" }).eq("user_id", accounts.member.id);
assert.ok(escalation.error);
const profileEscalation = await member.auth.updateUser({ data: { role: "owner", capabilities: ["organization.manage", "production.read_all"] } });
assert.equal(profileEscalation.error, null);
assert.deepEqual(await data(member.from("projects").select("id").eq("id", fixtures.clientProjectId)), []);
passed("anonymous writes, direct role escalation and user-metadata escalation rejected");

const idempotent = { _organization_id: fixtures.organizationId, _name: "Foundation idempotency proof", _ownership: "internal",
  _discipline_keys: ["software"], _lifecycle: "continuous", _request_id: "aa000000-0000-4000-a000-000000000002" };
const [first, retry] = await Promise.all([data(owner.rpc("create_project", idempotent)), data(owner.rpc("create_project", idempotent))]);
assert.equal(first, retry);
const mismatched = await owner.rpc("create_project", { ...idempotent, _name: "Changed payload" });
assert.ok(mismatched.error);
assert.equal((await data(owner.from("projects").select("id").eq("id", first))).length, 1);
await withLocalDatabase(async (db) => {
  const before = await db.query("SELECT (SELECT count(*) FROM public.projects)::int AS projects,(SELECT count(*) FROM public.work_contexts)::int AS contexts,(SELECT count(*) FROM public.boards)::int AS boards");
  const failed = await owner.rpc("create_project", {
    ...idempotent, _name: "Foundation rollback proof", _client_organization_id: fixtures.clientId,
    _request_id: "aa000000-0000-4000-a000-000000000003",
  });
  assert.ok(failed.error, "mixed ownership must fail after atomic context work");
  const after = await db.query("SELECT (SELECT count(*) FROM public.projects)::int AS projects,(SELECT count(*) FROM public.work_contexts)::int AS contexts,(SELECT count(*) FROM public.boards)::int AS boards");
  assert.deepEqual(after.rows, before.rows);
});
passed("concurrent retry is idempotent, mismatched payload fails and invalid creation rolls back completely");

const managerProjectId = await data(manager.rpc("create_project", { ...idempotent, _name: "Manager revocation proof",
  _request_id: "aa000000-0000-4000-a000-000000000004" }));
assert.equal((await data(manager.from("projects").select("id").eq("id", managerProjectId))).length, 1);
await withLocalDatabase(async (db) => {
  const { rows } = await db.query("SELECT work_context_id FROM public.projects WHERE id=$1", [managerProjectId]);
  const contextId = rows[0].work_context_id;
  await db.query("UPDATE public.work_context_memberships SET status='inactive' WHERE work_context_id=$1 AND user_id=$2", [contextId, accounts.manager.id]);
  try {
    assert.deepEqual(await data(manager.from("projects").select("id").eq("id", managerProjectId)), []);
    assert.equal(await data(manager.rpc("foundation_can_read_context", { _organization_id: fixtures.organizationId, _context_id: contextId })), false);
  } finally {
    await db.query("UPDATE public.work_context_memberships SET status='active' WHERE work_context_id=$1 AND user_id=$2", [contextId, accounts.manager.id]);
  }
});
passed("project creator access is revoked with context membership even while the Auth token stays valid");

const assetId = "aa000000-0000-4000-a000-000000000010";
const assetPath = fixtures.organizationId + "/assets/" + assetId + "/foundation-private.txt";
const bytes = new TextEncoder().encode("Ordo local private asset proof\n");
await data(admin.storage.from("ordo-private-assets").upload(assetPath, bytes, { contentType: "text/plain", upsert: true }));
await withLocalDatabase(async (db) => {
  const { rows } = await db.query("SELECT work_context_id FROM public.projects WHERE id=$1", [fixtures.internalProjectId]);
  await db.query("INSERT INTO public.assets(id,organization_id,work_context_id,name,storage_path,mime_type,size_bytes,state,uploaded_by) VALUES($1,$2,$3,'Foundation private proof',$4,'text/plain',$5,'available',$6) ON CONFLICT(id) DO NOTHING",
    [assetId, fixtures.organizationId, rows[0].work_context_id, assetPath, bytes.length, accounts.owner.id]);
});
assert.equal(await (await data(owner.storage.from("ordo-private-assets").download(assetPath))).text(), new TextDecoder().decode(bytes));
const signed = await data(owner.storage.from("ordo-private-assets").createSignedUrl(assetPath, 30));
const signedResponse = await fetch(signed.signedUrl);
assert.equal(signedResponse.status, 200);
assert.equal(await signedResponse.text(), new TextDecoder().decode(bytes));
for (const actor of [other, clients.client, clients["client-two"], anonymous]) {
  assert.ok((await actor.storage.from("ordo-private-assets").download(assetPath)).error);
  assert.ok((await actor.storage.from("ordo-private-assets").createSignedUrl(assetPath, 30)).error);
}
assert.deepEqual(await data(clients.client.storage.from("ordo-private-assets").list(fixtures.organizationId + "/assets/" + assetId)), []);
const publicResponse = await fetch(local.env.API_URL + "/storage/v1/object/public/ordo-private-assets/" + assetPath);
assert.notEqual(publicResponse.status, 200);
passed("actual private object bytes, listing and fresh signed URLs respect client and tenant isolation");
assert.equal(await (await data(member.storage.from("ordo-private-assets").download(assetPath))).text(), new TextDecoder().decode(bytes));
const memberSigned = await data(member.storage.from("ordo-private-assets").createSignedUrl(assetPath, 30));
assert.equal((await fetch(memberSigned.signedUrl)).status, 200);
await withLocalDatabase(async (db) => {
  await db.query("UPDATE public.organization_memberships SET status='inactive' WHERE organization_id=$1 AND user_id=$2", [fixtures.organizationId, accounts.member.id]);
  try {
    assert.deepEqual(await data(member.from("projects").select("id")), []);
    assert.ok((await member.storage.from("ordo-private-assets").createSignedUrl(assetPath, 30)).error);
    assert.ok((await member.storage.from("ordo-private-assets").download(assetPath)).error);
  } finally {
    await db.query("UPDATE public.organization_memberships SET status='active' WHERE organization_id=$1 AND user_id=$2", [fixtures.organizationId, accounts.member.id]);
  }
});
passed("membership revocation blocks new reads and download authorization without token refresh");
await data(owner.auth.signOut());
assert.equal((await data(owner.auth.getSession())).session, null);
await data(owner.auth.signInWithPassword({ email: accounts.owner.email, password: accounts.owner.password }));
assert.equal((await data(owner.from("projects").select("id").eq("id", fixtures.clientProjectId))).length, 1);
passed("saved work persists after sign-out and a fresh real sign-in");

const report = { checkedAt: new Date().toISOString(), target: "foundation-local", checks,
  limitations: ["Previously issued signed URLs remain bearer links until expiry.", "No production or external provider resources were accessed."] };
writeFileSync(join(root, ".foundation-runtime/verification.json"), JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
console.log("Real local foundation checks passed: " + checks.length + " groups.");
