import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { slugify, uniqueSlug } from "@/lib/slug";
import { toast } from "sonner";
import {
  Loader2, Check, Briefcase, Building2, UserRound, Shapes, Plus, X, ArrowRight, Sparkles,
} from "lucide-react";

type WsType = "freelancer" | "agency" | "consultant" | "other";

const TYPES: { value: WsType; label: string; icon: typeof Briefcase; desc: string }[] = [
  { value: "freelancer", label: "Freelancer", icon: UserRound, desc: "Solo, running your own show" },
  { value: "agency", label: "Agency", icon: Building2, desc: "A team delivering for clients" },
  { value: "consultant", label: "Consultant", icon: Briefcase, desc: "Advisory & expert services" },
  { value: "other", label: "Other", icon: Shapes, desc: "Something a little different" },
];

export default function Onboarding() {
  const { user, session, loading } = useAuth();
  const { refresh, selectWorkspace, workspaces, loading: wsLoading, resolved, error, debug } = useWorkspace();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<WsType>("freelancer");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invites, setInvites] = useState<string[]>([]);

  const slug = useMemo(() => slugify(name) || "your-workspace", [name]);

  const debugSnapshot = {
    route: "/onboarding",
    authUserId: user?.id ?? null,
    sessionExists: Boolean(session),
    accessTokenExists: Boolean(session?.access_token),
    listWorkspacesResponse: debug.lastResponse,
    parsedWorkspaceCount: debug.parsedWorkspaceCount,
    useWorkspace: {
      loading: wsLoading,
      resolved,
      error,
      workspacesLength: workspaces.length,
    },
    routingDecision: workspaces.length > 0 ? "currently-still-on-onboarding" : "show-onboarding",
    onboardingCondition: `route is /onboarding; guard does not redirect existing workspace users; workspaces.length=${workspaces.length}`,
  };

  console.info("[Onboarding] runtime state", debugSnapshot);

  useEffect(() => {
    if (!loading && user && !wsLoading && resolved && !error && workspaces.length > 0 && step === 1 && !workspaceId) {
      console.info("[Onboarding] existing workspace detected, redirecting to dashboard", debugSnapshot);
      navigate("/", { replace: true });
    }
  }, [loading, user, wsLoading, resolved, error, workspaces.length, step, workspaceId, navigate]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (wsLoading || (!resolved && !error)) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <pre className="fixed bottom-3 left-3 z-50 max-h-[45vh] max-w-[min(92vw,520px)] overflow-auto rounded-md border border-border bg-card p-3 text-[11px] leading-relaxed text-card-foreground shadow-lg">
          {JSON.stringify(debugSnapshot, null, 2)}
        </pre>
      </div>
    );
  }
  // If user already created their workspace in this session, allow re-entry only via step flow
  if (workspaces.length > 0 && step === 1 && !workspaceId) {
    // Allow creating an additional workspace, but default existing users go to dashboard
  }

  const createWorkspace = async () => {
    if (!name.trim()) return toast.error("Give your workspace a name");
    setBusy(true);
    try {
      const finalSlug = uniqueSlug(name);
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        console.error("Workspace creation blocked: missing session", sessionError);
        toast.error("Your session expired. Please sign in again.");
        return;
      }

      const { data: ws, error } = await supabase.functions.invoke<{ id?: string; error?: string }>(
        "create-workspace",
        { body: { name: name.trim(), slug: finalSlug, type } },
      );

      if (error || !ws?.id) {
        console.error("Workspace creation failed:", error ?? ws);
        toast.error(ws?.error ?? error?.message ?? "Could not create workspace");
        return;
      }

      setWorkspaceId(ws.id);
      setStep(3);
    } catch (err) {
      console.error("Unexpected error creating workspace:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const addInvite = () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast.error("Enter a valid email");
    if (invites.includes(email)) return;
    setInvites((prev) => [...prev, email]);
    setInviteEmail("");
  };

  const finish = async (sendInvites: boolean) => {
    setBusy(true);
    try {
      if (sendInvites && invites.length && workspaceId) {
        const { error } = await supabase.from("activity_logs").insert({
          workspace_id: workspaceId,
          actor_id: user.id,
          action: "members.invited",
          metadata: { emails: invites },
        });
        if (error) console.error("Invite log failed:", error);
        else toast.success(`Queued ${invites.length} invite${invites.length > 1 ? "s" : ""}.`);
      }
      await refresh();
      if (workspaceId) selectWorkspace(workspaceId);
      navigate("/");
    } catch (err) {
      console.error("Unexpected error finishing onboarding:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <pre className="fixed bottom-3 left-3 z-50 max-h-[45vh] max-w-[min(92vw,520px)] overflow-auto rounded-md border border-border bg-card p-3 text-[11px] leading-relaxed text-card-foreground shadow-lg">
        {JSON.stringify(debugSnapshot, null, 2)}
      </pre>
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-25">
        <div className="absolute left-1/3 top-1/4 h-96 w-96 rounded-full bg-primary/30 blur-[120px]" />
      </div>

      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                s <= step ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>

        <Card className="surface-gradient border-border/50 p-6 sm:p-8">
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h1 className="text-xl font-semibold tracking-tight">Create your workspace</h1>
                <p className="text-sm text-muted-foreground">This is where your projects, team, and clients live.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ws-name">Workspace name</Label>
                <Input id="ws-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Studio" />
                <p className="text-xs text-muted-foreground">
                  URL: <span className="font-mono text-foreground/80">ordo.app/{slug}</span>
                </p>
              </div>
              <Button className="w-full" disabled={!name.trim()} onClick={() => setStep(2)}>
                Continue <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h1 className="text-xl font-semibold tracking-tight">What best describes you?</h1>
                <p className="text-sm text-muted-foreground">We'll tailor Ordo around how you work.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                      type === t.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/40 hover:bg-card",
                    )}
                  >
                    <t.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{t.label}</div>
                      <div className="text-xs text-muted-foreground">{t.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
                <Button className="flex-1" disabled={busy} onClick={createWorkspace}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h1 className="text-xl font-semibold tracking-tight">Invite your people</h1>
                <p className="text-sm text-muted-foreground">Add team members or clients. You can always do this later.</p>
              </div>
              <div className="flex gap-2">
                <Input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addInvite(); } }}
                  placeholder="teammate@email.com"
                  type="email"
                />
                <Button type="button" variant="secondary" onClick={addInvite}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {invites.length > 0 && (
                <ul className="space-y-2">
                  {invites.map((email) => (
                    <li key={email} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
                      <span className="truncate">{email}</span>
                      <button type="button" aria-label={`Remove ${email}`} onClick={() => setInvites((p) => p.filter((e) => e !== email))} className="text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep(4)}>Skip for now</Button>
                <Button className="flex-1" disabled={busy || invites.length === 0} onClick={() => setStep(4)}>
                  Add {invites.length || ""} & continue
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60">
                <Check className="h-7 w-7 text-primary-foreground" />
              </div>
              <div className="space-y-1">
                <h1 className="text-xl font-semibold tracking-tight">You're all set</h1>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{name}</span> is ready. Time to get to work.
                </p>
              </div>
              <Button className="w-full" disabled={busy} onClick={() => finish(true)}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Enter Ordo
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
