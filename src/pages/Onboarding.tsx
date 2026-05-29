import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2, ArrowRight, ArrowLeft, Sparkles, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { slugify, uniqueSlug } from "@/lib/slug";
import { toast } from "sonner";
import { SectionHeader, OrdoField } from "@/components/ordo";
import {
  OnboardingShell,
  FeaturePreviewCard,
  MockupPreview,
  WorkspaceTypeCard,
  InviteUsersStep,
  ProjectCreationStep,
  CompletionScreen,
  WORKSPACE_TYPES,
  TOUR_FEATURES,
  TOTAL_STEPS,
  type WorkspaceType,
  type ProjectDraft,
} from "@/components/onboarding";

interface PersistedState {
  step: number;
  name: string;
  type: WorkspaceType;
  workspaceId: string | null;
  team: string[];
  clients: string[];
  project: ProjectDraft;
}

const emptyProject: ProjectDraft = { name: "", client: "", description: "" };

const defaultState: PersistedState = {
  step: 1,
  name: "",
  type: "freelancer",
  workspaceId: null,
  team: [],
  clients: [],
  project: emptyProject,
};

export default function Onboarding() {
  const { user, loading } = useAuth();
  const { refresh, selectWorkspace, workspaces, loading: wsLoading, resolved, error } = useWorkspace();
  const navigate = useNavigate();

  const storageKey = user ? `ordo:onboarding:${user.id}` : null;

  const [state, setState] = useState<PersistedState>(() => {
    if (typeof window === "undefined") return defaultState;
    const key = user ? `ordo:onboarding:${user.id}` : null;
    if (!key) return defaultState;
    try {
      const raw = localStorage.getItem(key);
      return raw ? { ...defaultState, ...JSON.parse(raw) } : defaultState;
    } catch {
      return defaultState;
    }
  });
  const [busy, setBusy] = useState(false);
  const redirected = useRef(false);

  const { step, name, type, workspaceId, team, clients, project } = state;
  const patch = (p: Partial<PersistedState>) => setState((s) => ({ ...s, ...p }));

  const slug = useMemo(() => slugify(name) || "your-workspace", [name]);

  // Persist progress so users can resume if interrupted.
  useEffect(() => {
    if (!storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state, storageKey]);

  // Existing-workspace users who haven't started onboarding go straight in.
  useEffect(() => {
    if (
      !loading &&
      user &&
      !wsLoading &&
      resolved &&
      !error &&
      workspaces.length > 0 &&
      step === 1 &&
      !workspaceId &&
      !redirected.current
    ) {
      redirected.current = true;
      navigate("/", { replace: true });
    }
  }, [loading, user, wsLoading, resolved, error, workspaces.length, step, workspaceId, navigate]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (wsLoading || (!resolved && !error)) {
    return (
      <div className="client-os flex min-h-screen items-center justify-center bg-background p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sidebarTitle = workspaceId && name ? name : "Welcome to Ordo";
  const sidebarSubtitle = workspaceId
    ? "Finishing up your workspace setup."
    : "Let's set up your execution workspace.";

  const goNext = () => patch({ step: Math.min(step + 1, TOTAL_STEPS) });
  const goBack = () => patch({ step: Math.max(step - 1, 1) });

  const createWorkspace = async () => {
    if (!name.trim()) {
      toast.error("Give your workspace a name");
      return;
    }
    setBusy(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        toast.error("Your session expired. Please sign in again.");
        return;
      }
      const finalSlug = uniqueSlug(name);
      const { data: ws, error: fnError } = await supabase.functions.invoke<{ id?: string; error?: string }>(
        "create-workspace",
        { body: { name: name.trim(), slug: finalSlug, type } },
      );
      if (fnError || !ws?.id) {
        toast.error(ws?.error ?? fnError?.message ?? "Could not create workspace");
        return;
      }
      patch({ workspaceId: ws.id, step: 4 });
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const logInvites = async (emails: string[], action: string) => {
    if (!emails.length || !workspaceId) return;
    const { error: logError } = await supabase.from("activity_logs").insert({
      workspace_id: workspaceId,
      actor_id: user.id,
      action,
      metadata: { emails },
    });
    if (logError) console.error("Invite log failed:", logError);
  };

  const createFirstProject = async () => {
    if (!workspaceId || !project.name.trim()) return;
    setBusy(true);
    try {
      const { error: projError } = await supabase.from("projects").insert({
        workspace_id: workspaceId,
        name: project.name.trim(),
        description: project.description.trim() || null,
        owner_id: user.id,
        created_by: user.id,
      });
      if (projError) {
        toast.error("Could not create the project, but you can add it later.");
        console.error("Project insert failed:", projError);
      } else {
        toast.success("First project created");
      }
      goNext();
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    try {
      await Promise.all([
        logInvites(team, "members.invited"),
        logInvites(clients, "clients.invited"),
      ]);
      await refresh();
      if (workspaceId) selectWorkspace(workspaceId);
      if (storageKey) localStorage.removeItem(storageKey);
      navigate("/", { replace: true });
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const backButton = (
    <Button variant="ghost" className="rounded-pill" onClick={goBack} disabled={busy}>
      <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
    </Button>
  );

  const skipButton = (onSkip: () => void, label = "Skip") => (
    <Button variant="ghost" className="rounded-pill text-muted-foreground" onClick={onSkip} disabled={busy}>
      {label}
    </Button>
  );

  let body: JSX.Element;
  let footer: JSX.Element;

  switch (step) {
    case 1:
      body = (
        <FeaturePreviewCard
          badge={{ icon: Sparkles, label: "Welcome" }}
          title="Your operating system for execution"
          description="Ordo brings execution intelligence, project visibility, and true accountability into one calm workspace — so you always know what's moving, what's stuck, and what needs you."
          preview={<MockupPreview rows={3} />}
        />
      );
      footer = (
        <>
          <span />
          <Button className="rounded-pill" onClick={goNext}>
            Continue <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </>
      );
      break;

    case 2:
      body = (
        <div className="flex flex-1 flex-col gap-6">
          <SectionHeader
            title="Create your workspace"
            description="This is where your projects, team, and clients live."
          />
          <OrdoField label="Workspace name" htmlFor="ws-name" hint={`URL: ordo.app/${slug}`}>
            <Input
              id="ws-name"
              autoFocus
              value={name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Acme Studio"
              className="h-11 rounded-small bg-background"
            />
          </OrdoField>
        </div>
      );
      footer = (
        <>
          {backButton}
          <Button className="rounded-pill" disabled={!name.trim()} onClick={goNext}>
            Continue <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </>
      );
      break;

    case 3:
      body = (
        <div className="flex flex-1 flex-col gap-6">
          <SectionHeader title="What best describes you?" description="We'll tailor Ordo around how you work." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {WORKSPACE_TYPES.map((opt) => (
              <WorkspaceTypeCard
                key={opt.value}
                option={opt}
                selected={type === opt.value}
                onSelect={() => patch({ type: opt.value })}
              />
            ))}
          </div>
        </div>
      );
      footer = (
        <>
          {backButton}
          <Button className="rounded-pill" disabled={busy} onClick={createWorkspace}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </>
      );
      break;

    case 4:
      body = (
        <InviteUsersStep
          title="Invite your team"
          description="Bring your collaborators into the workspace. This step is optional."
          placeholder="teammate@email.com"
          emails={team}
          onChange={(t) => patch({ team: t })}
          emptyLabel="No team members yet"
        />
      );
      footer = (
        <>
          {skipButton(goNext, "Skip for now")}
          <Button className="rounded-pill" onClick={goNext}>
            Continue <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </>
      );
      break;

    case 5:
      body = (
        <InviteUsersStep
          title="Invite your clients"
          description="Give clients a calm, branded view of their projects. This step is optional."
          placeholder="client@email.com"
          emails={clients}
          onChange={(c) => patch({ clients: c })}
          emptyLabel="No clients yet"
        />
      );
      footer = (
        <>
          {skipButton(goNext, "Skip for now")}
          <Button className="rounded-pill" onClick={goNext}>
            Continue <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </>
      );
      break;

    case 6:
      body = (
        <ProjectCreationStep
          draft={project}
          onChange={(p) => patch({ project: p })}
          clientOptions={clients}
        />
      );
      footer = (
        <>
          {skipButton(goNext, "Skip for now")}
          <Button
            className="rounded-pill"
            disabled={busy || !project.name.trim()}
            onClick={createFirstProject}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create & continue <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </>
      );
      break;

    case 7:
      body = (
        <div className="flex flex-1 flex-col gap-6">
          <SectionHeader
            title="A quick tour of Ordo"
            description="Here's where everything lives once you're inside."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {TOUR_FEATURES.map((f) => (
              <div key={f.title} className="flex gap-3 rounded-card bg-background p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-small bg-card text-foreground shadow-subtle">
                  <f.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{f.title}</div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
      footer = (
        <>
          {skipButton(goNext, "Skip tour")}
          <Button className="rounded-pill" onClick={goNext}>
            Finish setup <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </>
      );
      break;

    default:
      body = <CompletionScreen workspaceName={name || "Your workspace"} />;
      footer = (
        <>
          <span />
          <Button className="rounded-pill" disabled={busy} onClick={finish}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LayoutGrid className="mr-2 h-4 w-4" />}
            Enter Ordo
          </Button>
        </>
      );
      break;
  }

  return (
    <OnboardingShell
      current={step}
      sidebarTitle={sidebarTitle}
      sidebarSubtitle={sidebarSubtitle}
      footer={footer}
    >
      {body}
    </OnboardingShell>
  );
}
