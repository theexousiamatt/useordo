import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Building2, FolderKanban, ShieldCheck, MailCheck } from "lucide-react";
import { AuthLayout, OrdoButton, OrdoAlert, friendlyAuthError } from "@/components/auth";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { authPath, forgetInvitation, rememberInvitation, safeReturnPath } from "@/lib/authReturn";
import { buildAppUrl } from "@/lib/appUrl";
import { roleLabel } from "@/lib/roles";

export interface InvitationPreview {
  valid: boolean; status: string; email: string; role: string;
  workspaceId: string; workspaceName: string; inviterName: string; expiresAt: string;
  projectId?: string | null; projectName?: string | null;
}

export default function WorkspaceInvite() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const path = `/auth/invite?${new URLSearchParams({ token })}`;
  const { user, loading: authLoading, signOut } = useAuth();
  const { refresh, selectWorkspace } = useWorkspace();
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authLinkError] = useState(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    return params.has("error") || hash.has("error") ? "This sign-in link has expired or has already been used. Request a fresh sign-in link below; your invitation is still here." : null;
  });
  const [sent, setSent] = useState(false);
  const [renewal, setRenewal] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const autoJoined = useRef(false);
  const previewRequest = useRef({ version: 0 });
  const activeToken = useRef(token);
  activeToken.current = token;
  const requestInProgress = useRef(false);

  const load = useCallback(async () => {
    const request = ++previewRequest.current.version;
    setLoading(true); setError(null); setPreview(null);
    if (!token) { setLoading(false); return; }
    try {
      const { data, error } = await supabase.functions.invoke("accept-invitation", { body: { token, accept: false }, timeout: 15000 });
      if (request !== previewRequest.current.version) return;
      if (error || data?.error || !data?.invite) throw new Error("We couldn't load this invitation. Check your connection and try again.");
      setPreview(data.invite);
    } catch (err) { if (request === previewRequest.current.version) setError(err instanceof Error ? err.message : "Invitation unavailable. Please retry."); }
    finally { if (request === previewRequest.current.version) setLoading(false); }
  }, [token]);
  useEffect(() => { const pending = previewRequest.current; void load(); return () => { ++pending.version; activeToken.current = ""; }; }, [load]);
  useEffect(() => {
    if (authLinkError) window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  }, [authLinkError]);
  useEffect(() => { autoJoined.current = false; setSent(false); setRenewal(false); setCooldown(0); if (token) rememberInvitation(path); }, [token, path]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  const wrongAccount = !!user && !!preview?.valid && !!preview.email && user.email?.trim().toLowerCase() !== preview.email.trim().toLowerCase();
  const accept = useCallback(async () => {
    if (!user || wrongAccount || requestInProgress.current) return;
    requestInProgress.current = true; setBusy(true); setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("accept-invitation", { body: { token, accept: true }, timeout: 15000 });
      if (activeToken.current !== token) return;
      if (error || data?.error || !data?.workspaceId) throw new Error(data?.error ?? await invitationError(error));
      selectWorkspace(data.workspaceId);
      await refresh();
      if (activeToken.current !== token) return;
      forgetInvitation();
      navigate(safeReturnPath(data.destination, data.role === "client" ? "/client" : "/"), { replace: true, state: { invitationWelcome: true } });
    } catch (err) { setError(err instanceof Error ? err.message : "Could not accept invitation."); }
    finally { requestInProgress.current = false; setBusy(false); }
  }, [user, wrongAccount, token, selectWorkspace, refresh, navigate]);
  useEffect(() => {
    if (params.get("join") === "1" && user && !authLoading && preview?.valid && !wrongAccount && !autoJoined.current) {
      autoJoined.current = true; void accept();
    }
  }, [params, user, authLoading, preview, wrongAccount, accept]);
  const sendLink = async () => {
    if (!preview || requestInProgress.current || cooldown) return;
    requestInProgress.current = true; setBusy(true); setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: preview.email, options: {
        shouldCreateUser: true, emailRedirectTo: buildAppUrl(path + "&join=1"),
      } });
      if (error) throw error;
      setSent(true); setCooldown(60);
    } catch (err) { setError(friendlyAuthError(err)); }
    finally { requestInProgress.current = false; setBusy(false); }
  };
  const requestRenewal = async () => {
    setBusy(true); setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("accept-invitation", { body: { token, action: "request-renewal" }, timeout: 15000 });
      if (error || !data?.requested) throw new Error("We couldn't notify the agency. Contact your inviter for a new link.");
      setRenewal(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not request a new invitation."); }
    finally { setBusy(false); }
  };
  const switchAccount = async () => {
    setBusy(true); setError(null);
    try { await signOut(); } catch { setError("We couldn't sign you out. Please try again."); }
    finally { setBusy(false); }
  };
  const available = !!preview?.valid;
  return <AuthLayout showPreview={false}
    panelTitle={preview?.workspaceName ? `${preview.workspaceName} invited you` : "Your invitation"}
    panelSubtitle={preview?.projectName ? `Join ${preview.projectName} to see shared work and review deliverables.` : "Join the work you've been invited to. No workspace setup required."}>
    <div className="mx-auto w-full max-w-sm space-y-6">
      {(loading || authLoading) ? <p role="status">Loading your invitation…</p> : <>
        {authLinkError && !user && <OrdoAlert variant="warning">{authLinkError}</OrdoAlert>}
        {error && <OrdoAlert variant="error">{error}</OrdoAlert>}
        {!preview && error ? <OrdoButton variant="outline" onClick={load}>Try again</OrdoButton> : !available ? <>
          <h2 className="text-2xl font-semibold tracking-tight">Invitation unavailable</h2>
          <p className="text-sm text-muted-foreground">{preview?.status === "expired" ? "This link has expired. Request a new invitation from the agency without restarting setup." : preview?.status === "revoked" ? "The agency revoked this invitation. Contact them if you still need access." : "This link is invalid or the project is no longer available. Ask the agency for a new invitation."}</p>
          {preview?.status === "expired" && (renewal ? <OrdoAlert variant="success">The agency has been notified in Ordo. They'll need to review and resend your invitation.</OrdoAlert> : <OrdoButton loading={busy} onClick={requestRenewal}>Request a new invitation</OrdoButton>)}
          <Link to="/auth" className="block text-sm font-semibold underline underline-offset-4" onClick={forgetInvitation}>Back to sign in</Link>
        </> : <>
          <div>
            <h2 className="break-words text-2xl font-semibold tracking-tight">{preview.projectName ?? `Join ${preview.workspaceName}`}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{preview.inviterName} invited you as a {roleLabel(preview.role).toLowerCase()}.</p>
          </div>
          <InvitationDetails preview={preview} />
          {wrongAccount ? <>
            <OrdoAlert variant="warning" title="Switch accounts to continue">You're signed in as <span className="[overflow-wrap:anywhere]">{user?.email}</span>. This invitation is for <strong className="[overflow-wrap:anywhere]">{preview.email}</strong>.</OrdoAlert>
            <OrdoButton loading={busy} onClick={switchAccount}>Use the invited email</OrdoButton>
          </> : user ? <>
            <p className="break-all text-sm text-muted-foreground">Continuing as {user.email}</p>
            <OrdoButton loading={busy} onClick={accept}>{preview.projectId ? "Open project" : "Enter workspace"}</OrdoButton>
          </> : <>
            {sent ? <OrdoAlert variant="success" title="Check your inbox"><MailCheck className="mb-2 h-5 w-5" />We've requested a secure sign-in link for <strong className="[overflow-wrap:anywhere]">{preview.email}</strong>. Open the newest email to go straight to {preview.projectName ?? preview.workspaceName}. Check spam too.</OrdoAlert> : <p className="text-sm text-muted-foreground">We'll send a secure link to <strong className="[overflow-wrap:anywhere]">{preview.email}</strong>. It signs you in or creates your account—no password or agency setup needed.</p>}
            <OrdoButton loading={busy} disabled={cooldown > 0} onClick={sendLink}>{cooldown ? `Send again in ${cooldown}s` : sent ? "Send another sign-in link" : "Email me a sign-in link"}</OrdoButton>
            <Link to={authPath("/auth", path + "&join=1", preview.email)} className="block text-center text-sm font-semibold underline underline-offset-4">Already have an account? Sign in</Link>
          </>}
          <Link to="/auth" onClick={forgetInvitation} className="block text-center text-sm text-muted-foreground underline underline-offset-4">Not now</Link>
        </>}
      </>}
    </div>
  </AuthLayout>;
}

export function InvitationDetails({ preview }: { preview: InvitationPreview }) {
  return <div className="space-y-4 rounded-card bg-secondary/50 p-5">
    <div className="flex gap-3"><Building2 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" /><div className="min-w-0"><p className="text-xs text-muted-foreground">Agency</p><p className="break-words font-semibold">{preview.workspaceName}</p></div></div>
    <div className="flex gap-3">{preview.projectId ? <FolderKanban className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" /> : <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />}<p className="text-sm leading-relaxed">{preview.projectId ? "Only this project's shared files, updates and approvals. Other agency projects stay private." : preview.role === "client" ? "Your client portal, with only projects individually shared with you. Other clients' work stays private." : "Join the existing workspace with your assigned role."}</p></div>
  </div>;
}

async function invitationError(error: unknown) {
  const fallback = "We couldn't open your invitation. Please try again.";
  const context = (error as { context?: { json?: () => Promise<{ error?: string }> } } | null)?.context;
  try {
    const response = await context?.json?.();
    return typeof response?.error === "string" ? response.error : fallback;
  } catch { return fallback; }
}
