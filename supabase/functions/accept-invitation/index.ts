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
      .select("id, workspace_id, email, role, status, expires_at, invited_by")
      .eq("token", token)
      .maybeSingle();

    if (inviteError) {
      console.error("invitation lookup failed", inviteError);
      return json({ error: "Could not load invitation" }, 400);
    }
    if (!invite) return json({ error: "This invitation does not exist", valid: false }, 404);

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

    const preview = {
      valid: usable,
      status: expired && invite.status === "pending" ? "expired" : invite.status,
      email: invite.email,
      role: invite.role,
      workspaceId: invite.workspace_id,
      workspaceName: workspace?.name ?? "a workspace",
      inviterName: inviterName ?? "A teammate",
      expiresAt: invite.expires_at,
    };

    // Preview only.
    if (!accept) return json({ invite: preview });

    // Accepting requires an authenticated user.
    const authToken = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!authToken) return json({ error: "You must be signed in to accept" }, 401);

    const { data: authData, error: authError } = await admin.auth.getUser(authToken);
    if (authError || !authData.user) {
      return json({ error: "Your session expired. Please sign in again." }, 401);
    }
    const user = authData.user;

    if (!usable) {
      return json({ error: `This invitation is ${preview.status}.`, valid: false }, 410);
    }

    const { error: memberError } = await admin.rpc("accept_workspace_invitation", {
      _token: token,
      _user_id: user.id,
    });
    if (memberError) {
      return json({ error: memberError.message }, 403);
    }

    return json({
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
