import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Invitation service is not configured" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const accept = body.accept === true;
    if (!token) return json({ error: "Missing invitation token" }, 400);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Look up the invitation by token.
    const { data: invite, error: inviteError } = await admin
      .from("workspace_invitations")
      .select("id, workspace_id, email, role, status, expires_at, invited_by, project_id")
      .eq("token", token)
      .maybeSingle();

    if (inviteError) {
      console.error("invitation lookup failed", inviteError);
      return json({ error: "Could not load invitation" }, 400);
    }
    if (!invite) return json({ invite: { valid: false, status: "invalid" } });

    const now = Date.now();
    const expired = new Date(invite.expires_at).getTime() < now;
    const usable = invite.status === "pending" && !expired;

    // Enrich with workspace + inviter details for the preview screen.
    const { data: workspace } = await admin
      .from("workspaces")
      .select("id, name")
      .eq("id", invite.workspace_id)
      .maybeSingle();

    let inviterName: string | null = null;
    if (invite.invited_by) {
      const { data: inviter } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", invite.invited_by)
        .maybeSingle();
      inviterName = inviter?.full_name ?? null;
    }

    const { data: project } = invite.project_id ? await admin.from("projects").select("id,name,workspace_id,archived_at").eq("id", invite.project_id).maybeSingle() : { data: null };
    const projectAvailable = !invite.project_id || (project?.workspace_id === invite.workspace_id && (invite.status === "accepted" || !project.archived_at));
    const preview = {
      valid: projectAvailable && (usable || invite.status === "accepted"),
      projectId: invite.project_id,
      projectName: project?.name ?? null,
      status: !projectAvailable ? "project_unavailable" : expired && invite.status === "pending" ? "expired" : invite.status,
      email: invite.email,
      role: invite.role,
      workspaceId: invite.workspace_id,
      workspaceName: workspace?.name ?? "a workspace",
      inviterName: inviterName ?? "A teammate",
      expiresAt: invite.expires_at,
    };

    if (body.action === "request-renewal") {
      const { data: requested, error: renewalError } = await admin.rpc("request_invitation_renewal", { _token: token });
      if (renewalError || !requested) return json({ error: "A new invitation could not be requested. Contact the agency." }, 400);
      return json({ requested: true });
    }
    // Viewing a link never consumes it; email security scanners cannot accept it.
    if (!accept) return json({ invite: preview });

    // Accepting requires an authenticated user.
    const authToken = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!authToken) return json({ error: "You must be signed in to accept" }, 401);

    const { data: authData, error: authError } = await admin.auth.getUser(authToken);
    if (authError || !authData.user) {
      return json({ error: "Your session expired. Please sign in again." }, 401);
    }
    const user = authData.user;

    if (!projectAvailable || (!usable && invite.status !== "accepted")) {
      return json({ error: `This invitation is ${preview.status}.`, valid: false }, 410);
    }

    const { error: memberError } = await admin.rpc("accept_workspace_invitation", {
      _token: token,
      _user_id: user.id,
    });
    if (memberError) {
      return json({ error: memberError.message }, 403);
    }

    const { data: actualRole } = await admin.rpc("get_workspace_role", { _workspace_id: invite.workspace_id, _user_id: user.id });
    return json({
      projectId: invite.project_id,
      destination: invite.project_id ? `${actualRole === "client" ? "/client" : ""}/projects/${invite.project_id}` : actualRole === "client" ? "/client" : "/",
      joined: true,
      workspaceId: invite.workspace_id,
      workspaceName: preview.workspaceName,
      role: invite.role,
    });
  } catch (error) {
    console.error("accept-invitation failure", error);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
