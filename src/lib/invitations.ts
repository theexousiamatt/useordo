import { supabase } from "@/integrations/supabase/client";
import { sendAppEmail } from "./email";
import type { WorkspaceRole } from "@/hooks/useWorkspace";

export type InvitationScope = { projectId?: string | null };
export type InvitationResult = { email: string; invitation_id: string | null; outcome: "member" | "pending" | "created" };
export type InvitationSummary = { invitations: number; alreadyMembers: number; emailAccepted: number; emailUnconfirmed: number };
// Narrow compatibility adapter until the generated schema includes this migration.
const invitationRpc = supabase as unknown as {
  rpc(name: "prepare_workspace_invitations" | "prepare_scoped_invitations", args: { _workspace_id: string; _emails: string[]; _role: WorkspaceRole; _project_id?: string | null }): PromiseLike<{ data: InvitationResult[] | null; error: { message: string } | null }>;
};
export async function inviteWorkspacePeople(workspaceId: string, emails: string[], role: Exclude<WorkspaceRole, "owner">, scope?: InvitationScope): Promise<InvitationSummary> {
  const normalized = [...new Set(emails.map((email) => email.trim().toLowerCase()))];
  const summary: InvitationSummary = { invitations: 0, alreadyMembers: 0, emailAccepted: 0, emailUnconfirmed: 0 };
  if (!normalized.length) return summary;
  const { data, error } = await invitationRpc.rpc(scope ? "prepare_scoped_invitations" : "prepare_workspace_invitations", {
    _workspace_id: workspaceId, _emails: normalized, _role: role, ...(scope ? { _project_id: scope.projectId ?? null } : {}),
  });
  if (error) throw new Error(error.message);
  if (!data || data.length !== normalized.length) throw new Error("We couldn't confirm every invitation. Retry to check their status.");
  // RPC preparation is atomic; email acceptance remains a separate, tracked outcome.
  // Four workers bound simultaneous SMTP requests; server event keys deduplicate retries.
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, data.length) }, async () => {
    for (;;) {
      const result = data[next++];
      if (!result) break;
      if (result.outcome === "member") { summary.alreadyMembers++; continue; }
      if (!result.invitation_id) throw new Error("An invitation response was incomplete. Retry to check its status.");
      summary.invitations++;
      const accepted = await sendAppEmail({ template: "workspace-invitation", entityId: result.invitation_id, idempotencyKey: `invite-${result.invitation_id}` });
      if (accepted) summary.emailAccepted++;
      else summary.emailUnconfirmed++;
    }
  }));
  return summary;
}
