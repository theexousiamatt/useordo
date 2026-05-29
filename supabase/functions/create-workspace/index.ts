import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type WorkspaceType = "freelancer" | "agency" | "consultant" | "startup" | "other";

const workspaceTypes: WorkspaceType[] = ["freelancer", "agency", "consultant", "startup", "other"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Workspace service is not configured" }, 500);
    }

    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) {
      return json({ error: "You must be signed in to create a workspace" }, 401);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) {
      console.error("Workspace auth validation failed", authError);
      return json({ error: "Your session expired. Please sign in again." }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const slug = typeof body.slug === "string" ? body.slug.trim() : "";
    const type = workspaceTypes.includes(body.type) ? body.type as WorkspaceType : "other";

    if (!name || !slug) {
      return json({ error: "Workspace name is required" }, 400);
    }

    const user = authData.user;

    const { data: workspace, error: workspaceError } = await admin
      .from("workspaces")
      .insert({ name, slug, type, owner_id: user.id })
      .select("id")
      .single();

    if (workspaceError || !workspace) {
      console.error("Workspace insert failed", workspaceError);
      return json({ error: workspaceError?.message ?? "Could not create workspace" }, 400);
    }

    const { error: memberError } = await admin
      .from("workspace_members")
      .insert({ workspace_id: workspace.id, user_id: user.id, role: "owner" });

    if (memberError) {
      console.error("Owner membership insert failed", memberError);
      await admin.from("workspaces").delete().eq("id", workspace.id);
      return json({ error: memberError.message }, 400);
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update({ email: user.email })
      .eq("id", user.id);
    if (profileError) console.error("Profile update failed", profileError);

    const { error: activityError } = await admin.from("activity_logs").insert({
      workspace_id: workspace.id,
      actor_id: user.id,
      action: "workspace.created",
      metadata: { name, type },
    });
    if (activityError) console.error("Activity log insert failed", activityError);

    return json({ id: workspace.id });
  } catch (error) {
    console.error("Unexpected workspace creation failure", error);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
