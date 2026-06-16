import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace, type WorkspaceRole } from "@/hooks/useWorkspace";
import { sendAppEmail } from "@/lib/email";
import { toast } from "sonner";

export interface TeamMember {
  id: string;
  user_id: string;
  role: WorkspaceRole;
  status: string;
  joined_at: string | null;
  last_active_at: string | null;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  is_owner: boolean;
}

export interface Invitation {
  id: string;
  email: string;
  role: WorkspaceRole;
  status: string;
  token: string;
  expires_at: string;
  created_at: string;
}

// The generated types may lag the latest migration; use a loose client for the
// new workspace_invitations table and extended member columns.
const db = supabase as unknown as {
  from: (table: string) => any;
};

export function useTeam() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? null;
  const ownerId = currentWorkspace?.owner_id ?? null;

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(false);

    const [{ data: memberRows, error: e1 }, { data: inviteRows }] = await Promise.all([
      db
        .from("workspace_members")
        .select("id, user_id, role, status, joined_at, last_active_at")
        .eq("workspace_id", workspaceId),
      db
        .from("workspace_invitations")
        .select("id, email, role, status, token, expires_at, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }),
    ]);

    if (e1) {
      setError(true);
      setLoading(false);
      return;
    }

    const ids = (memberRows ?? []).map((r: any) => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    setMembers(
      (memberRows ?? []).map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        role: r.role as WorkspaceRole,
        status: r.status ?? "active",
        joined_at: r.joined_at ?? null,
        last_active_at: r.last_active_at ?? null,
        full_name: byId.get(r.user_id)?.full_name ?? null,
        email: byId.get(r.user_id)?.email ?? null,
        avatar_url: byId.get(r.user_id)?.avatar_url ?? null,
        is_owner: r.user_id === ownerId || r.role === "owner",
      })),
    );

    setInvitations(
      (inviteRows ?? []).filter((i: any) => i.status === "pending"),
    );
    setLoading(false);
  }, [workspaceId, ownerId]);

  useEffect(() => {
    load();
  }, [load]);

  const inviteMembers = useCallback(
    async (emails: string[], role: WorkspaceRole) => {
      if (!workspaceId) return false;
      setBusy(true);
      const { data: auth } = await supabase.auth.getUser();
      const rows = emails.map((email) => ({
        workspace_id: workspaceId,
        email: email.toLowerCase().trim(),
        role,
        invited_by: auth.user?.id ?? null,
        status: "pending",
      }));
      const { error } = await db.from("workspace_invitations").insert(rows);
      setBusy(false);
      if (error) {
        toast.error(error.message ?? "Could not send invitations");
        return false;
      }
      toast.success(`${rows.length} invitation${rows.length > 1 ? "s" : ""} sent`);
      await load();
      return true;
    },
    [workspaceId, load],
  );

  const changeRole = useCallback(
    async (memberId: string, role: WorkspaceRole) => {
      const { error } = await db.from("workspace_members").update({ role }).eq("id", memberId);
      if (error) return toast.error("Could not change role");
      toast.success("Role updated");
      await load();
    },
    [load],
  );

  const setMemberStatus = useCallback(
    async (memberId: string, status: string) => {
      const { error } = await db.from("workspace_members").update({ status }).eq("id", memberId);
      if (error) return toast.error("Could not update member");
      toast.success(status === "active" ? "Member reactivated" : "Member deactivated");
      await load();
    },
    [load],
  );

  const removeMember = useCallback(
    async (memberId: string) => {
      const { error } = await db.from("workspace_members").delete().eq("id", memberId);
      if (error) return toast.error("Could not remove member");
      toast.success("Member removed");
      await load();
    },
    [load],
  );

  const revokeInvite = useCallback(
    async (inviteId: string) => {
      const { error } = await db
        .from("workspace_invitations")
        .update({ status: "revoked" })
        .eq("id", inviteId);
      if (error) return toast.error("Could not revoke invitation");
      toast.success("Invitation revoked");
      await load();
    },
    [load],
  );

  const resendInvite = useCallback(
    async (inviteId: string) => {
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await db
        .from("workspace_invitations")
        .update({ status: "pending", expires_at: expires })
        .eq("id", inviteId);
      if (error) return toast.error("Could not resend invitation");
      toast.success("Invitation resent");
      await load();
    },
    [load],
  );

  return {
    members,
    invitations,
    loading,
    error,
    busy,
    reload: load,
    inviteMembers,
    changeRole,
    setMemberStatus,
    removeMember,
    revokeInvite,
    resendInvite,
  };
}

export function inviteLink(token: string) {
  return `${window.location.origin}/auth/invite?token=${encodeURIComponent(token)}`;
}
