import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const BodySchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(200),
  copySettings: z.boolean().default(true),
  copyClient: z.boolean().default(false),
  copyTeam: z.boolean().default(false),
  copyMilestones: z.boolean().default(false),
  copyTasks: z.boolean().default(false),
  copyDueDates: z.boolean().default(false),
  copyComments: z.boolean().default(false),
  copyDeliverables: z.boolean().default(false),
  copyFiles: z.boolean().default(false),
});

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const opts = parsed.data;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Load source project.
    const { data: source, error: srcErr } = await admin
      .from("projects")
      .select("*")
      .eq("id", opts.projectId)
      .single();
    if (srcErr || !source) return json({ error: "Project not found" }, 404);

    const workspaceId = source.workspace_id as string;

    // Permission: only workspace owner or manager may duplicate.
    const { data: canManage, error: permErr } = await admin.rpc("can_manage_workspace", {
      _workspace_id: workspaceId,
      _user_id: userId,
    });
    if (permErr) return json({ error: permErr.message }, 500);
    if (!canManage) return json({ error: "You don't have permission to duplicate this project." }, 403);

    // 1. Create the new project.
    const { data: created, error: createErr } = await admin
      .from("projects")
      .insert({
        workspace_id: workspaceId,
        name: opts.name,
        description: opts.copySettings ? source.description : null,
        client_id: opts.copyClient ? source.client_id : null,
        status: "draft",
        health: opts.copySettings ? source.health : "on_track",
        visibility: opts.copySettings ? source.visibility : "workspace",
        theme: opts.copySettings ? (source.theme ?? "neutral") : "neutral",
        start_date: opts.copySettings && opts.copyDueDates ? source.start_date : null,
        due_date: opts.copySettings && opts.copyDueDates ? source.due_date : null,
        owner_id: userId,
        created_by: userId,
        progress: 0,
      })
      .select()
      .single();
    if (createErr || !created) return json({ error: createErr?.message ?? "Failed to create project" }, 500);
    const newId = created.id as string;

    const records: Record<string, number> = {};

    // 2. Team members (always include creator as owner).
    const memberRows = new Map<string, string>();
    memberRows.set(userId, "owner");
    if (opts.copyTeam) {
      const { data: members } = await admin
        .from("project_members")
        .select("user_id, role")
        .eq("project_id", opts.projectId);
      for (const m of members ?? []) {
        if (!memberRows.has(m.user_id)) memberRows.set(m.user_id, m.role);
      }
    }
    const memberInsert = Array.from(memberRows.entries()).map(([uid, role]) => ({
      workspace_id: workspaceId,
      project_id: newId,
      user_id: uid,
      role,
    }));
    await admin.from("project_members").insert(memberInsert);
    records.members = memberInsert.length;

    // 3. Milestones.
    if (opts.copyMilestones) {
      const { data: milestones } = await admin
        .from("milestones")
        .select("*")
        .eq("project_id", opts.projectId);
      const rows = (milestones ?? []).map((m) => ({
        workspace_id: workspaceId,
        project_id: newId,
        title: m.title,
        description: m.description,
        due_date: opts.copyDueDates ? m.due_date : null,
        status: "pending",
        completed: false,
      }));
      if (rows.length) {
        await admin.from("milestones").insert(rows);
        records.milestones = rows.length;
      }
    }

    // 3b. Project labels (always cloned so task labels can be remapped).
    const labelIdMap = new Map<string, string>();
    {
      const { data: labels } = await admin
        .from("project_labels")
        .select("*")
        .eq("project_id", opts.projectId)
        .order("position", { ascending: true });
      for (const l of labels ?? []) {
        const { data: nl } = await admin
          .from("project_labels")
          .insert({
            workspace_id: workspaceId,
            project_id: newId,
            name: l.name,
            color: l.color,
            position: l.position,
          })
          .select("id")
          .single();
        if (nl) labelIdMap.set(l.id, nl.id);
      }
    }

    // 3c. Duplicate the custom stage layout after the project seed trigger.
    // "Blank project" intentionally retains the five default stages.
    const stageIdMap = new Map<string,string>();
    if (opts.copySettings || opts.copyTasks || opts.copyMilestones) {
      const { data: sourceStages, error: sourceStagesError } = await admin
        .from("project_stages").select("id,name,category,position")
        .eq("project_id",opts.projectId).order("position").order("id");
      if(sourceStagesError)throw sourceStagesError;
      if(sourceStages?.length){
        const { data: seededStages, error: seededError } = await admin
          .from("project_stages").select("id")
          .eq("project_id",newId).order("position").order("id");
        if(seededError)throw seededError;
        for(let index=0;index<sourceStages.length;index++){
          const sourceStage=sourceStages[index];
          const seed=seededStages?.[index];
          if(seed){
            const { error }=await admin.from("project_stages").update({
              name:sourceStage.name,category:sourceStage.category,position:index,
            }).eq("id",seed.id).eq("project_id",newId);
            if(error)throw error;
            stageIdMap.set(sourceStage.id,seed.id);
          }else{
            const {data:newStage,error}=await admin.from("project_stages").insert({
              workspace_id:workspaceId,project_id:newId,name:sourceStage.name,
              category:sourceStage.category,position:index,
            }).select("id").single();
            if(error || !newStage)throw error ?? new Error("Could not copy project stage");
            stageIdMap.set(sourceStage.id,newStage.id);
          }
        }
        const unused=(seededStages??[]).slice(sourceStages.length).map(stage=>stage.id);
        if(unused.length){
          const {error}=await admin.from("project_stages").delete()
            .eq("project_id",newId).in("id",unused);
          if(error)throw error;
        }
        records.stages=sourceStages.length;
      }
    }

    // 4. Tasks (track id mapping for comments and labels).
    const taskIdMap = new Map<string, string>();
    if (opts.copyTasks) {
      const { data: tasks } = await admin
        .from("tasks")
        .select("*")
        .eq("project_id", opts.projectId)
        .order("position", { ascending: true });
      for (const t of tasks ?? []) {
        const { data: nt } = await admin
          .from("tasks")
          .insert({
            workspace_id: workspaceId,
            project_id: newId,
            title: t.title,
            description: t.description,
            status: t.status,
            stage_id: t.stage_id ? stageIdMap.get(t.stage_id) ?? null : null,
            position: t.position,
            assignee_id: opts.copyTeam ? t.assignee_id : null,
            due_date: opts.copyDueDates ? t.due_date : null,
            created_by: userId,
          })
          .select("id")
          .single();
        if (nt) taskIdMap.set(t.id, nt.id);
      }
      records.tasks = taskIdMap.size;

      // 4b. Task label assignments (remap task + label ids).
      const { data: taskLabels } = await admin
        .from("task_labels")
        .select("*")
        .eq("project_id", opts.projectId);
      const tlRows = (taskLabels ?? [])
        .map((tl) => {
          const newTaskId = taskIdMap.get(tl.task_id);
          const newLabelId = labelIdMap.get(tl.label_id);
          if (!newTaskId || !newLabelId) return null;
          return {
            workspace_id: workspaceId,
            project_id: newId,
            task_id: newTaskId,
            label_id: newLabelId,
          };
        })
        .filter(Boolean);
      if (tlRows.length) await admin.from("task_labels").insert(tlRows);
    }


    // 5. Comments (require tasks; remap task_id).
    if (opts.copyComments && opts.copyTasks) {
      const { data: comments } = await admin
        .from("project_comments")
        .select("*")
        .eq("project_id", opts.projectId);
      const rows = (comments ?? []).map((c) => ({
        workspace_id: workspaceId,
        project_id: newId,
        task_id: c.task_id ? taskIdMap.get(c.task_id) ?? null : null,
        author_id: c.author_id,
        content: c.content,
      }));
      if (rows.length) {
        await admin.from("project_comments").insert(rows);
        records.comments = rows.length;
      }
    }

    // 6. Deliverables.
    if (opts.copyDeliverables) {
      const { data: deliverables } = await admin
        .from("deliverables")
        .select("*")
        .eq("project_id", opts.projectId);
      const rows = (deliverables ?? []).map((d) => ({
        workspace_id: workspaceId,
        project_id: newId,
        title: d.title,
        description: d.description,
        status: "draft",
        requires_approval: d.requires_approval,
        created_by: userId,
      }));
      if (rows.length) {
        await admin.from("deliverables").insert(rows);
        records.deliverables = rows.length;
      }
    }

    // 7. Files (metadata rows; storage objects are shared by path).
    if (opts.copyFiles) {
      const { data: pFiles } = await admin
        .from("project_files")
        .select("*")
        .eq("project_id", opts.projectId);
      const pRows = (pFiles ?? []).map((f) => ({
        workspace_id: workspaceId,
        project_id: newId,
        uploaded_by: f.uploaded_by,
        file_name: f.file_name,
        file_url: f.file_url,
        file_size: f.file_size,
      }));
      if (pRows.length) await admin.from("project_files").insert(pRows);

      const { data: legacyFiles } = await admin
        .from("files")
        .select("*")
        .eq("project_id", opts.projectId);
      const lRows = (legacyFiles ?? []).map((f) => ({
        workspace_id: workspaceId,
        project_id: newId,
        name: f.name,
        storage_path: f.storage_path,
        size_bytes: f.size_bytes,
        mime_type: f.mime_type,
        uploaded_by: f.uploaded_by,
      }));
      if (lRows.length) await admin.from("files").insert(lRows);
      records.files = pRows.length + lRows.length;
    }

    return json({ projectId: newId, name: opts.name, records });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
