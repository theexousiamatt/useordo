import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Building2, UserCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  AuthLayout,
  OrdoButton,
  OrdoAlert,
} from "@/components/auth";

/**
 * Workspace invitation screen. Reads invite details from query params
 * (?workspace=&inviter=&role=) so it works for email-link invites.
 */
export default function WorkspaceInvite() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const workspace = params.get("workspace") || "a workspace";
  const inviter = params.get("inviter") || "A teammate";
  const role = params.get("role") || "Member";
  const expired = params.get("expired") === "true";

  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);

  const accept = async () => {
    setBusy("accept");
    // Invite acceptance is finalized during onboarding / workspace join.
    toast.success(`Joining ${workspace}…`);
    navigate(`/onboarding?invite=${encodeURIComponent(workspace)}`);
  };

  const decline = async () => {
    setBusy("decline");
    toast.info("Invitation declined.");
    navigate("/auth");
  };

  return (
    <AuthLayout
      showPreview={false}
      panelTitle="You've been invited"
      panelSubtitle="Join your team on Ordo to collaborate on projects, deliverables and approvals in one place."
    >
      <div className="mx-auto w-full max-w-sm">
        {expired ? (
          <div className="space-y-6">
            <OrdoAlert variant="warning" title="Invitation expired">
              This invitation link is no longer valid. Ask {inviter} to send a new one.
            </OrdoAlert>
            <OrdoButton variant="outline" onClick={() => navigate("/auth")}>
              Back to sign in
            </OrdoButton>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-semibold tracking-tight">Workspace invitation</h2>
              <p className="mt-1 text-muted-foreground">Review the details below to continue.</p>
            </div>

            <div className="space-y-3 rounded-card border border-border bg-secondary/40 p-5">
              <Detail icon={Building2} label="Workspace" value={workspace} />
              <Detail icon={UserCircle2} label="Invited by" value={inviter} />
              <Detail icon={ShieldCheck} label="Role" value={role} />
            </div>

            <div className="mt-7 space-y-3">
              <OrdoButton loading={busy === "accept"} onClick={accept}>
                Accept invitation
              </OrdoButton>
              <OrdoButton variant="ghost" loading={busy === "decline"} onClick={decline}>
                Decline
              </OrdoButton>
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-small bg-card">
        <Icon className="h-[18px] w-[18px] text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-[hsl(var(--text-tertiary))]">{label}</p>
        <p className="truncate font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}
