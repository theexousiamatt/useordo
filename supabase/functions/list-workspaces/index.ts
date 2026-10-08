import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type WorkspaceRole = "owner" | "manager" | "member" | "client";

type Workspace = {
  id: string;
  name: string;
  slug: string;
  type: "freelancer" | "agency" | "consultant" | "other";
  owner_id: string;
  role: WorkspaceRole;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Workspace service is not configured" }, 500);
    }

    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) {
      return json({ error: "You must be signed in to view workspaces" }, 401);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) {
      console.error("Workspace list auth validation failed", authError);
      return json({ error: "Your session expired. Please sign in again." }, 401);
    }

    const userId = authData.user.id;

    const { data: memberships, error: membershipsError } = await admin
      .from("workspace_members")
      .select("role, workspaces(id, name, slug, type, owner_id)")
      .eq("user_id", userId)
      .eq("status", "active");

    if (membershipsError) {
      console.error("Workspace membership list failed", membershipsError);
      return json({ error: membershipsError.message }, 400);
    }

    const workspaces = new Map<string, Workspace>();

    for (const row of memberships ?? []) {
      const workspace = Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces;
      if (!workspace) continue;
      workspaces.set(workspace.id, {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        type: workspace.type,
        owner_id: workspace.owner_id,
        role: row.role as WorkspaceRole,
      });
    }

    const { data: owned, error: ownedError } = await admin
      .from("workspaces")
      .select("id, name, slug, type, owner_id")
      .eq("owner_id", userId);

    if (ownedError) {
      console.error("Owned workspace list failed", ownedError);
      return json({ error: ownedError.message }, 400);
    }

    const ownedCount = owned?.length ?? 0;
    const membershipCount = memberships?.length ?? 0;

    for (const workspace of owned ?? []) {
      workspaces.set(workspace.id, {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        type: workspace.type,
        owner_id: workspace.owner_id,
        role: "owner",
      });
    }

    const result = Array.from(workspaces.values());
    console.log("Workspace list resolved", {
      userId,
      ownedCount,
      membershipCount,
      returnedCount: result.length,
    });

    return json({ workspaces: result });
  } catch (error) {
    console.error("Unexpected workspace list failure", error);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
