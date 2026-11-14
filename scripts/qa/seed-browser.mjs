// Disposable local-browser fixture. NEVER target a production Supabase URL.
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import fs from "node:fs";

const url = process.env.QA_SUPABASE_URL;
const serviceRoleKey = process.env.QA_SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.QA_SUPABASE_ANON_KEY;
if (!url || !serviceRoleKey || !anonKey) throw new Error("Missing disposable Supabase credentials");
if (!/^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/.test(url)) {
  throw new Error("QA seed refuses to connect outside local Supabase");
}
const client = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const suffix = randomUUID().slice(0, 8);
const email = `ordo-browser-${suffix}@example.invalid`;
const password = `Ordo-QA-${randomUUID()}!`;

async function must(promise, description) {
  const result = await promise;
  if (result.error) throw new Error(`${description}: ${result.error.message}`);
  return result.data;
}

const auth = await must(client.auth.admin.createUser({
  email, password, email_confirm: true,
  user_metadata: { full_name: "Ordo QA Browser Owner" },
}), "Create isolated auth user");
const userId = auth.user?.id;
if (!userId) throw new Error("Missing isolated user ID");

const workspace = await must(client.from("workspaces")
  .insert({ name: "Browser QA Workspace", slug: `browser-qa-${suffix}`,
    type: "agency", owner_id: userId })
  .select("id").single(), "Create isolated workspace");
await must(client.from("workspace_members").insert({
  workspace_id: workspace.id, user_id: userId, role: "owner", status: "active",
}), "Create workspace membership");

const project = await must(client.from("projects").insert({
  workspace_id: workspace.id, name: "Ordo Browser QA", owner_id: userId,
  status: "active", created_by: userId,
}).select("id").single(), "Create browser project");
await must(client.from("project_members").insert({
  workspace_id: workspace.id, project_id: project.id,
  user_id: userId, role: "owner",
}), "Grant project membership");

const stages = await must(client.from("project_stages")
  .select("id,name,category").eq("project_id", project.id), "Fetch seeded stages");
const backlog = stages.find(stage => stage.category === "backlog");
const namedDone = stages.find(stage => stage.category === "done");
if (!backlog || !namedDone) throw new Error("Missing default stage labels");

const baseline = await must(client.from("tasks").insert({
  workspace_id: workspace.id, project_id: project.id, stage_id: backlog.id,
  title: "QA ordinary task", status: "todo", position: 0,
}).select("id").single(), "Seed normal task");
const namedDoneTask = await must(client.from("tasks").insert({
  workspace_id: workspace.id, project_id: project.id, stage_id: namedDone.id,
  title: "QA Done-stage task", status: "todo", position: 0,
}).select("id").single(), "Seed task inside stage named Done");
await must(client.from("task_subtasks").insert([
  { project_id: project.id, task_id: namedDoneTask.id, title: "QA checklist one", position: 0, completed: true },
  { project_id: project.id, task_id: namedDoneTask.id, title: "QA checklist two", position: 1, completed: false },
]), "Seed real checklist progress");

fs.writeFileSync(".qa-browser-state.json", JSON.stringify({
  email, password, userId, workspaceId: workspace.id, projectId: project.id,
  normalTaskId: baseline.id, doneTaskId: namedDoneTask.id,
  backlogId: backlog.id, doneStageId: namedDone.id,
}), { mode: 0o600 });
console.log("Browser QA fixture created in disposable local Supabase");
