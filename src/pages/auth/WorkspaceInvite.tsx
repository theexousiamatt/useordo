import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Building2, UserCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout, OrdoButton, OrdoAlert } from "@/components/auth";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { roleLabel } from "@/lib/roles";

interface Preview {
  valid: boolean;
  status: string;
  email: string;
  role: string;
  workspaceId: string;
  workspaceName: string;
  inviterName: string;
  expiresAt: string;
}

export default function WorkspaceInvite() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const { refresh, selectWorkspace } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase.functions.invoke("accept-invitation", {
        body: { token, accept: false },
      });
      if (error || (data as any)?.error) {
        setPreview(null);
      } else {
        setPreview((data as any).invite as Preview);
      }
      setLoading(false);
    })();
  }, [token]);

  const accept = async () => {
    setBusy("accept");
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      // Send to sign up, returning here afterwards.
      navigate(`/auth/sign-up?redirect=${encodeURIComponent(`/auth/invite?token=${token}`)}`);
      return;
    }
    const { data, error } = await supabase.functions.invoke("accept-invitation", {
      body: { token, accept: true },
    });
    setBusy(null);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? "Could not accept invitation");
      return;
    }
    const result = data as { workspaceId: string; workspaceName: string };
    toast.success(`Welcome to ${result.workspaceName}`);
    await refresh();
    selectWorkspace(result.workspaceId);
    navigate("/");
  };

  const decline = () => {
    toast.info("Invitation declined.");
    navigate("/auth");
  };

  const invalid = !token || (!loading && (!preview || !preview.valid));

  return (
    <AuthLayout
      showPreview={false}
      panelTitle="You've been invited"
      panelSubtitle="Join your team on Ordo to collaborate on projects, deliverables and approvals in one place."
    >
      <div className="mx-auto w-full max-w-sm">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading invitation…</p>
        ) : invalid ? (
          <div className="space-y-6">
            <OrdoAlert variant="warning" title="Invitation unavailable">
              {preview?.status === "expired"
                ? "This invitation has expired. Ask the sender for a new one."
                : preview?.status === "revoked"
                  ? "This invitation has been revoked."
                  : "This invitation link is no longer valid."}
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
              <Detail icon={Building2} label="Workspace" value={preview!.workspaceName} />
              <Detail icon={UserCircle2} label="Invited by" value={preview!.inviterName} />
              <Detail icon={ShieldCheck} label="Role" value={roleLabel(preview!.role)} />
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
