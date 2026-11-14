import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { uniqueSlug } from "@/lib/slug";
import { inviteWorkspacePeople, type InvitationSummary } from "@/lib/invitations";
import { WorkspaceRecovery } from "@/components/states/WorkspaceRecovery";
import { OrdoAlert } from "@/components/auth";
import { SectionHeader, OrdoField } from "@/components/ordo";
import {
  OnboardingShell, WorkspaceTypeCard, InviteUsersStep, ProjectCreationStep,
  CompletionScreen, WORKSPACE_TYPES, TOTAL_STEPS,
  type WorkspaceType, type ProjectDraft,
} from "@/components/onboarding";
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
  flowVersion: 2, step: 1, name: "", type: "freelancer",
  workspaceId: null, team: [], clients: [],
  project: { name: "", client: "", description: "" },
  projectId: null, clientInviteScope: "project",
};

function restoreState(raw: string | null): PersistedState {
  if (!raw) return defaultState;
  try {
    const saved = JSON.parse(raw) as Partial<PersistedState>;
    if (saved.flowVersion === 2) {
      return { ...defaultState, ...saved, step: Math.max(1, Math.min(TOTAL_STEPS,saved.step ?? 1)) };
    }
    // Preserve every saved workspace/project/invitation when upgrading older
    // eight-step drafts. Never create a second workspace on resume.
    const legacy = { 1:1, 2:1, 3:1, 4:3, 5:4, 6:2, 7:5, 8:5 } as Record<number,number>;
    return { ...defaultState, ...saved,
      flowVersion: 2,
      step: saved.workspaceId ? (legacy[saved.step ?? 1] ?? 2) : 1,
    };
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

  const createWorkspace = async () => {
    if(workspaceId){ patch({step:2}); return; }
    if(!name.trim()){ toast.error("Enter your workspace name"); return; }
    setBusy(true);
    try{
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if(sessionError || !sessionData.session) throw new Error("Your session has expired. Sign in again.");
      const {data:result,error:fnError}=await supabase.functions.invoke<{id?:string;error?:string}>("create-workspace",{
        body:{name:name.trim(),slug:uniqueSlug(name),type},
      });
      if(fnError || !result?.id) throw new Error(result?.error ?? fnError?.message ?? "Could not create workspace");
      patch({workspaceId:result.id,step:2});
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

  const back = (target: number) => (
    <Button type="button" variant="ghost" className="rounded-pill" disabled={busy} onClick={()=>patch({step:target})}>
      <ArrowLeft className="mr-1.5 h-4 w-4"/> Back
    </Button>
  );
  const skip = (next:number) => (
    <Button type="button" variant="ghost" className="rounded-pill text-muted-foreground" disabled={busy} onClick={()=>patch({step:next})}>
      Skip for now
    </Button>
  );
  let body: JSX.Element;
  let footer: JSX.Element;

  if(step===1){
    body=<div className="flex flex-1 flex-col gap-6">
      <SectionHeader title="Set up your workspace" description="One place for your projects, collaborators and clients."/>
      <OrdoField label="Workspace name" htmlFor="ws-name">
        <Input autoFocus id="ws-name" value={name} onChange={e=>patch({name:e.target.value})}
          placeholder="Your studio or business name" className="h-11 rounded-small bg-background"/>
      </OrdoField>
      <div className="space-y-3">
        <p className="text-sm font-medium">How do you work?</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {WORKSPACE_TYPES.map(opt=>(
            <WorkspaceTypeCard key={opt.value} option={opt} selected={type===opt.value}
              onSelect={()=>patch({type:opt.value})}/>
          ))}
        </div>
      </div>
    </div>;
    footer=<><span className="text-xs text-muted-foreground">Step 1 of {TOTAL_STEPS}</span>
      <Button className="rounded-pill" disabled={busy || !name.trim()} onClick={()=>void createWorkspace()}>
        {busy&&<Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Create workspace <ArrowRight className="ml-1.5 h-4 w-4"/>
      </Button>
    </>;
  }else if(step===2){
    body=<div className="flex flex-1 flex-col gap-5">
      <ProjectCreationStep draft={project} onChange={value=>patch({project:value})} clientOptions={[]}/>
      <p className="text-xs text-muted-foreground">You'll be the project lead. Invite teammates next and add them to this project after they join.</p>
    </div>;
    footer=<>{skip(3)}
      <Button className="rounded-pill" disabled={busy || !project.name.trim()} onClick={()=>void createFirstProject()}>
        {busy&&<Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
        Save project <ArrowRight className="ml-1.5 h-4 w-4"/>
      </Button>
    </>;
  }else if(step===3){
    body=<InviteUsersStep title="Invite your team" description="Add the people you'll collaborate with. Invitations are prepared when setup is complete."
      placeholder="teammate@example.com" emails={team} onChange={value=>patch({team:value})} emptyLabel="No teammates added"/>;
    footer=<>{back(2)}{skip(4)}
      <Button className="rounded-pill" onClick={()=>patch({step:4})}>Continue <ArrowRight className="ml-1.5 h-4 w-4"/></Button>
    </>;
  }else if(step===4){
    body=<InviteUsersStep title="Invite your clients" description="Give clients access only to the projects you share. This is optional."
      placeholder="client@example.com" emails={clients} onChange={value=>patch({clients:value})} emptyLabel="No clients added"/>;
    footer=<>{back(3)}{skip(5)}
      <Button className="rounded-pill" onClick={()=>patch({step:5})}>Review setup <ArrowRight className="ml-1.5 h-4 w-4"/></Button>
    </>;
  }else{
    body=<div className="flex flex-1 flex-col gap-5">
      <CompletionScreen workspaceName={name||"Your workspace"}/>
      <div className="grid gap-2 rounded-card bg-background p-4 text-sm sm:grid-cols-3">
        <p><CheckCircle2 className="mr-1.5 inline h-4 w-4 text-primary"/><strong>Workspace</strong><span className="mt-1 block truncate text-xs text-muted-foreground">{name}</span></p>
        <p><CheckCircle2 className="mr-1.5 inline h-4 w-4 text-primary"/><strong>Project</strong><span className="mt-1 block truncate text-xs text-muted-foreground">{state.projectId?project.name:"Add later"}</span></p>
        <p><CheckCircle2 className="mr-1.5 inline h-4 w-4 text-primary"/><strong>Invitations</strong><span className="mt-1 block text-xs text-muted-foreground">{team.length+clients.length} prepared</span></p>
      </div>
      {clients.length>0&&<fieldset disabled={busy || !!inviteSummary} className="space-y-3 rounded-card bg-background p-5">
        <legend className="px-1 text-sm font-semibold">Client access</legend>
        {state.projectId&&<label className="flex items-start gap-3 text-sm">
          <input type="radio" name="onboarding-client-scope" checked={state.clientInviteScope==="project"}
            onChange={()=>patch({clientInviteScope:"project"})} className="mt-1 accent-[hsl(var(--foreground))]"/>
          <span>Only {project.name}<span className="block text-xs text-muted-foreground">Clients will land in this project.</span></span>
        </label>}
        <label className="flex items-start gap-3 text-sm">
          <input type="radio" name="onboarding-client-scope"
            checked={!state.projectId || state.clientInviteScope==="workspace"}
            onChange={()=>patch({clientInviteScope:"workspace"})} className="mt-1 accent-[hsl(var(--foreground))]"/>
          <span>Client workspace<span className="block text-xs text-muted-foreground">No other projects are shared automatically.</span></span>
        </label>
      </fieldset>}
      {inviteError&&<OrdoAlert variant="error">{inviteError} Your workspace and first project are saved.</OrdoAlert>}
      {inviteSummary&&inviteSummary.emailUnconfirmed>0&&<div role="status" className="space-y-3">
        <OrdoAlert variant="warning">{inviteSummary.invitations} invitation(s) prepared but email delivery could not be confirmed for {inviteSummary.emailUnconfirmed}. Retry or manage the links from Team.</OrdoAlert>
        <Button variant="outline" disabled={busy} onClick={()=>void finish(true)}>Enter Ordo and manage invitations later</Button>
      </div>}
    </div>;
    footer=<>{back(4)}
      <Button className="rounded-pill" disabled={busy} onClick={()=>void finish()}>
        {busy&&<Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Enter Ordo <ArrowRight className="ml-1.5 h-4 w-4"/>
      </Button>
    </>;
  }
  return <OnboardingShell current={step} sidebarTitle={workspaceId?name:"Welcome to Ordo"}
    sidebarSubtitle={workspaceId?"Your workspace is nearly ready.":"Let's set up a space for your work."} footer={footer}>
    {body}
  </OnboardingShell>;
}
