import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { uniqueSlug } from "@/lib/slug";
import { inviteWorkspacePeople, type InvitationSummary } from "@/lib/invitations";
import { WorkspaceRecovery } from "@/components/states/WorkspaceRecovery";
import type { WorkspaceType, ProjectDraft } from "@/components/onboarding";
import { JenriOnboardingShell } from "@/components/jenri/JenriOnboardingShell";
import { InvitationInbox } from "@/components/auth/InvitationInbox";

interface PersistedState {
  flowVersion: number;
  step: number;
  name: string;
  type: WorkspaceType;
  workspaceId: string | null;
  team: string[];
  clients: string[];
  project: ProjectDraft;
  projectId: string | null;
  clientInviteScope: "project" | "workspace";
}
const defaultState: PersistedState = {
  flowVersion: 3, step: 1, name: "", type: "freelancer",
  workspaceId: null, team: [], clients: [],
  project: { name: "", client: "", description: "" },
  projectId: null, clientInviteScope: "project",
};

function restoreState(raw: string | null): PersistedState {
  if (!raw) return defaultState;
  try {
    const saved = JSON.parse(raw) as Partial<PersistedState>;
    if (saved.flowVersion === 3) {
      return { ...defaultState, ...saved, step: Math.max(1, Math.min(3, saved.step ?? 1)) };
    }
    // Preserve prior setup progress and IDs. The original five/eight steps
    // included team/client invitations, which now remain available in the product.
    const step = !saved.workspaceId ? 1 : (saved.projectId || (saved.step ?? 1) >= 3 ? 3 : 2);
    return { ...defaultState, ...saved, flowVersion: 3, step };
  } catch {
    return defaultState;
  }
}

export default function Onboarding() {
  const { user, loading } = useAuth();
  const { refresh, selectWorkspace, workspaces, loading: wsLoading, resolved, error } = useWorkspace();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const storageKey = user ? `ordo:onboarding:${user.id}` : null;
  const [state, setState] = useState<PersistedState>(() => {
    try { return restoreState(user ? localStorage.getItem(`ordo:onboarding:${user.id}`) : null); }
    catch { return defaultState; }
  });
  const [busy, setBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string|null>(null);
  const [inviteSummary, setInviteSummary] = useState<InvitationSummary|null>(null);
  const redirected = useRef(false);
  const finishing = useRef(false);
  const { step, name, type, workspaceId, team, clients, project } = state;
  const patch = (next: Partial<PersistedState>) => setState(prev => ({ ...prev,...next }));

  useEffect(() => {
    if (!storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(state)); }
    catch { /* Setup works without local storage. */ }
  }, [storageKey,state]);

  useEffect(() => {
    if (!loading && user && !wsLoading && resolved && !error && workspaces.length>0 &&
      params.get("create")!=="1" && step===1 && !workspaceId && !redirected.current) {
      redirected.current=true;
      navigate("/",{replace:true});
    }
  }, [loading,user,wsLoading,resolved,error,workspaces.length,params,step,workspaceId,navigate]);

  if(loading) return null;
  if(!user) return <Navigate to="/auth" replace/>;
  if(wsLoading || (!resolved && !error)) return <div className="client-os flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground"/></div>;
  if(error || !resolved) return <WorkspaceRecovery/>;
  if(!workspaces.length && !workspaceId && params.get("create")!=="1") return <InvitationInbox/>;

  const createWorkspace = async (allowDefaultName = false) => {
    if(workspaceId){ patch({step:2}); return; }
    const requestedName = name.trim() || (allowDefaultName ? "My workspace" : "");
    if(!requestedName){ toast.error("Enter your workspace name"); return; }
    setBusy(true);
    try{
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if(sessionError || !sessionData.session) throw new Error("Your session has expired. Sign in again.");
      const {data:result,error:fnError}=await supabase.functions.invoke<{id?:string;error?:string}>("create-workspace",{
        body:{name:requestedName,slug:uniqueSlug(requestedName),type},
      });
      if(fnError || !result?.id) throw new Error(result?.error ?? fnError?.message ?? "Could not create workspace");
      patch({workspaceId:result.id,name:requestedName,step:2});
      toast.success("Workspace created");
    }catch(e){ toast.error(e instanceof Error?e.message:"Couldn't create workspace"); }
    finally{setBusy(false);}
  };

  const createFirstProject = async () => {
    if(!workspaceId || !project.name.trim()) return;
    setBusy(true);
    try{
      const values={
        workspace_id:workspaceId,name:project.name.trim(),
        description:project.description.trim()||null,
        owner_id:user.id,created_by:user.id,
      };
      const result=state.projectId
        ? await supabase.from("projects").update(values).eq("id",state.projectId).eq("workspace_id",workspaceId).select("id").single()
        : await supabase.from("projects").insert(values).select("id").single();
      if(result.error || !result.data?.id) throw result.error??new Error("Project not saved");
      patch({projectId:result.data.id,step:3});
      toast.success("First project saved");
    }catch(e){toast.error(e instanceof Error?e.message:"Couldn't save your project. Try again or skip.");}
    finally{setBusy(false);}
  };

  const finish = async (skipUnconfirmedEmail=false) => {
    if(finishing.current || !workspaceId) return;
    finishing.current=true;
    setBusy(true); setInviteError(null);
    try{
      if(!skipUnconfirmedEmail){
        const overlap=team.some(email=>clients.some(client=>client.trim().toLowerCase()===email.trim().toLowerCase()));
        if(overlap) throw new Error("An email appears in both Team and Clients. Go back and assign only one role.");
        const results=[];
        for(const [emails,role] of [[team,"member"],[clients,"client"]] as const){
          results.push(await inviteWorkspacePeople(workspaceId,emails,role,role==="client"
            ? {projectId:state.clientInviteScope==="project"?state.projectId:null} : undefined));
        }
        const summary=results.reduce<InvitationSummary>((total,result)=>({
          invitations:total.invitations+result.invitations,
          alreadyMembers:total.alreadyMembers+result.alreadyMembers,
          emailAccepted:total.emailAccepted+result.emailAccepted,
          emailUnconfirmed:total.emailUnconfirmed+result.emailUnconfirmed,
        }),{invitations:0,alreadyMembers:0,emailAccepted:0,emailUnconfirmed:0});
        setInviteSummary(summary);
        if(summary.emailUnconfirmed) return;
        if(summary.invitations) toast.success("Invitations prepared for delivery");
      }
      await refresh();
      selectWorkspace(workspaceId);
      if(storageKey){try{localStorage.removeItem(storageKey);}catch{/* Local storage is optional. */}}
      navigate("/",{replace:true});
    }catch(e){
      setInviteError(e instanceof Error?e.message:"Setup couldn't be finished; your workspace is saved.");
    }finally{finishing.current=false;setBusy(false);}
  };


  const back = () => {
    if (busy) return;
    if (step > 1) patch({ step: step - 1 });
    else navigate(-1);
  };

  return <JenriOnboardingShell step={step as 1 | 2 | 3} onBack={back}>
    {step === 1 ? <>
      <div className="jenri-onboard-illustration is-workspace">
        <img src="/jenri/workspace-illustration.svg" alt="" aria-hidden="true" />
      </div>
      <header className="jenri-onboard-intro">
        <h1>What should we call your workspace?</h1>
        <p>A home for your projects and the people you work with.</p>
      </header>
      <form onSubmit={event => { event.preventDefault(); void createWorkspace(); }}>
        <div className="jenri-onboard-fieldgroup">
          <label className="jenri-onboard-label" htmlFor="jenri-workspace-name">Workspace name</label>
          <input className="jenri-field" id="jenri-workspace-name" required
            placeholder="e.g. Inspirare Studio" autoComplete="organization"
            value={name} onChange={event => patch({ name: event.target.value })} />
          <p className="jenri-field-hint">
            <img src="/jenri/info.svg" alt="" aria-hidden="true" />
            You can always change this later.
          </p>
        </div>
        <div className="jenri-onboard-actions">
          <button className="jenri-primary-button" type="submit" disabled={busy || !name.trim()}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Create workspace <ArrowRight aria-hidden="true" />
          </button>
          <button className="jenri-onboard-skip" type="button" disabled={busy}
            onClick={() => void createWorkspace(true)}>Skip for now</button>
        </div>
      </form>
    </> : step === 2 ? <>
      <div className="jenri-onboard-illustration">
        <img src="/jenri/project-illustration.svg" alt="" aria-hidden="true" />
      </div>
      <header className="jenri-onboard-intro">
        <h1>Create your first project</h1>
        <p>Set up a project to start organizing your work, tasks, and deadlines.</p>
      </header>
      <form onSubmit={event => { event.preventDefault(); void createFirstProject(); }}>
        <div className="jenri-onboard-fieldgroup">
          <label className="jenri-onboard-label" htmlFor="jenri-project-name">Project name</label>
          <input className="jenri-field" id="jenri-project-name" required
            placeholder="e.g. Website redesign" value={project.name}
            onChange={event => patch({ project: { ...project, name: event.target.value } })} />
          <label className="jenri-onboard-label" htmlFor="jenri-project-description">Description (optional)</label>
          <textarea className="jenri-area" id="jenri-project-description" rows={3}
            placeholder="What's this project about?" value={project.description}
            onChange={event => patch({ project: { ...project, description: event.target.value } })} />
        </div>
        <div className="jenri-onboard-actions">
          <button className="jenri-primary-button" type="submit" disabled={busy || !project.name.trim()}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Create project <ArrowRight aria-hidden="true" />
          </button>
          <button type="button" className="jenri-onboard-skip" disabled={busy}
            onClick={() => patch({ step: 3 })}>Skip for now</button>
        </div>
      </form>
    </> : <>
      <div className="jenri-onboard-illustration">
        <img src="/jenri/completion-illustration.svg" alt="" aria-hidden="true" />
      </div>
      <header className="jenri-onboard-intro is-ready">
        <h1>You're all set!</h1>
        <p>Your workspace is ready. Go ahead and start organizing your work.</p>
      </header>
      <div className="jenri-feature-list">
        <div className="jenri-feature">
          <img src="/jenri/icon-projects.svg" alt="" aria-hidden="true" />
          <div><p className="jenri-feature-title">Create projects</p>
            <p className="jenri-feature-desc">Plan and track your work from start to finish.</p></div>
        </div>
        <div className="jenri-feature">
          <img src="/jenri/icon-team.svg" alt="" aria-hidden="true" />
          <div><p className="jenri-feature-title">Invite your team</p>
            <p className="jenri-feature-desc">Collaborate and get things done together.</p></div>
        </div>
        <div className="jenri-feature">
          <img src="/jenri/icon-tasks.svg" alt="" aria-hidden="true" />
          <div><p className="jenri-feature-title">Manage tasks</p>
            <p className="jenri-feature-desc">Turn ideas into actionable tasks.</p></div>
        </div>
      </div>
      {inviteError && <div className="jenri-auth-error" role="alert" style={{marginTop:16}}>{inviteError}</div>}
      {inviteSummary && inviteSummary.emailUnconfirmed > 0 && <div className="jenri-auth-error" role="status" style={{marginTop:16}}>
        Some previous invitations could not be confirmed. You can manage them from your workspace.
        <button type="button" onClick={() => void finish(true)} disabled={busy}>Enter workspace anyway</button>
      </div>}
      <div className="jenri-onboard-actions is-ready">
        <button type="button" className="jenri-primary-button" disabled={busy}
          onClick={() => void finish()}>
          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Go to my workspace <ArrowRight aria-hidden="true" />
        </button>
      </div>
    </>}
  </JenriOnboardingShell>;
}
