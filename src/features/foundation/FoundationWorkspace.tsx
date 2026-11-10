import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle2, FolderKanban, Loader2, LogOut, Plus, Search, X } from "lucide-react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { OrdoLogo } from "@/components/brand/OrdoLogo";
import { Button } from "@/components/ui/button";
import { OrdoField } from "@/components/ordo/OrdoField";
import { OrdoInput } from "@/components/ordo/OrdoInput";
const ProjectCreateDialog = lazy(() => import("./ProjectCreateDialog"));
import { ErrorState } from "@/components/states/ErrorState";
import { dateShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { foundationApi } from "./api";
import { canCreateProjects, canManageStudio, DISCIPLINES, LIFECYCLES, type FoundationProject, type ProjectOwnership, type StudioOrganization } from "./types";

const selectClass = "h-11 w-full min-w-0 rounded-small border border-border bg-card px-3.5 text-sm text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/30";
import { keys } from "./queryKeys";

function message(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") return error.message;
  return fallback;
}

import { useRequestId } from "./useRequestId";

function readSelectedOrganization(accountId: string) {
  try { return localStorage.getItem(`ordo:foundation:organization:${accountId}`) ?? ""; }
  catch { return ""; }
}

function Loading({ children }: { children: ReactNode }) {
  return <p role="status" className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{children}</p>;
}

export function FoundationWorkspace() {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  if (loading) return <div className="client-os min-h-screen bg-background p-6 text-foreground"><Loading>Opening your workspace…</Loading></div>;
  if (!user) return <Navigate to="/auth" replace state={{ from: { pathname: location.pathname, search: location.search } }} />;
  return <FoundationAccount key={user.id} accountId={user.id} email={user.email ?? "Your account"} signOut={signOut} />;
}

function FoundationAccount({ accountId, email, signOut }: { accountId: string; email: string; signOut: () => Promise<void> }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const organizations = useQuery({ queryKey: keys.organizations(accountId), queryFn: foundationApi.listOrganizations, retry: 1 });
  const [selectedId, setSelectedId] = useState(() => readSelectedOrganization(accountId));
  const [creatingStudio, setCreatingStudio] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const studios = useMemo(() => (organizations.data ?? []).filter((organization) => organization.role !== "client"), [organizations.data]);
  const selected = studios.find((organization) => organization.id === selectedId) ?? studios[0];
  const clientOnly = !!organizations.data?.length && studios.length === 0;

  useEffect(() => {
    if (!selected) return;
    setSelectedId(selected.id);
    try { localStorage.setItem(`ordo:foundation:organization:${accountId}`, selected.id); } catch { /* Selection still works for this visit. */ }
  }, [accountId, selected]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true); setSignOutError("");
    try {
      await signOut();
      await queryClient.cancelQueries({ queryKey: ["foundation", accountId] });
      queryClient.removeQueries({ queryKey: ["foundation", accountId] });
      navigate("/auth", { replace: true });
    } catch (error) { setSignOutError(message(error, "Couldn’t sign out. Please try again.")); }
    finally { setSigningOut(false); }
  };

  const studioCreated = (organization: StudioOrganization) => {
    queryClient.setQueryData<StudioOrganization[]>(keys.organizations(accountId), (current) => [...(current ?? []).filter((item) => item.id !== organization.id), organization]);
    setSelectedId(organization.id); setCreatingStudio(false);
    void queryClient.invalidateQueries({ queryKey: keys.organizations(accountId) });
    navigate("/projects");
  };

  return <div className="client-os min-h-screen bg-background text-foreground">
    <a href="#foundation-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-small focus:bg-card focus:px-4 focus:py-3">Skip to projects</a>
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 sm:px-8">
        <Link to="/projects" aria-label="Ordo projects"><OrdoLogo className="h-7 w-auto" /></Link>
        {selected && <div className="order-3 flex w-full min-w-0 items-center gap-3 sm:order-none sm:w-auto sm:max-w-sm">
          <label htmlFor="foundation-studio" className="sr-only">Studio workspace</label>
          <select id="foundation-studio" className={cn(selectClass, "h-10 min-w-0 max-w-full sm:w-60")} value={selected.id}
            onChange={(event) => { setSelectedId(event.target.value); setCreatingStudio(false); navigate("/projects"); }}>
            {studios.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
          </select>
          <span className="text-xs capitalize text-muted-foreground">{selected.role}</span>
        </div>}
        <div className="ml-auto flex min-w-0 items-center gap-3">
          <span className="hidden max-w-60 truncate text-xs text-muted-foreground md:block">{email}</span>
          <Button variant="ghost" size="sm" onClick={() => void handleSignOut()} disabled={signingOut}>
            {signingOut ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <LogOut className="mr-1.5 h-4 w-4" />}Sign out
          </Button>
        </div>
      </div>
    </header>
    <main id="foundation-main" className="mx-auto max-w-7xl px-4 py-7 sm:px-8 sm:py-10">
      {signOutError && <p role="alert" className="mb-5 text-sm text-destructive">{signOutError}</p>}
      {organizations.isPending ? <Loading>Loading your studios…</Loading> : organizations.isError ? <ErrorState title="Couldn’t load your studios" description="Your access could not be confirmed. Try again to open your workspace." onRetry={() => void organizations.refetch()} /> : clientOnly ? <section className="max-w-2xl rounded-panel bg-card p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Your client account</h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">This account has client access. Studio projects and internal work are available only to authorized team members. Contact your studio if you need team access.</p>
      </section> : !selected ? <section className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Your studio, organized.</h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">Create a workspace for your studio, then bring client projects and internal work together.</p>
        <div className="mt-7"><CreateStudioForm onCreated={studioCreated} /></div>
      </section> : <>
        <nav className="mb-7 flex flex-wrap items-center justify-between gap-3" aria-label="Workspace navigation">
          <Link to="/projects" className="inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"><FolderKanban className="h-4 w-4" aria-hidden="true" />Projects</Link>
          {canManageStudio(selected.role, selected.capabilities) && <Button variant="ghost" size="sm" aria-expanded={creatingStudio} onClick={() => setCreatingStudio((value) => !value)}>{creatingStudio ? <X className="mr-1.5 h-4 w-4" /> : <Plus className="mr-1.5 h-4 w-4" />}{creatingStudio ? "Close studio setup" : "Create another studio"}</Button>}
        </nav>
        {creatingStudio && <section className="mb-8 max-w-2xl"><CreateStudioForm onCreated={studioCreated} /></section>}
        <Routes>
          <Route path="/" element={<ProjectList key={selected.id} accountId={accountId} organization={selected} />} />
          <Route path="/projects" element={<ProjectList key={selected.id} accountId={accountId} organization={selected} />} />
          <Route path="/projects/:id" element={<ProjectOverview key={selected.id} accountId={accountId} organization={selected} />} />
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </>}
    </main>
  </div>;
}

function CreateStudioForm({ onCreated }: { onCreated: (organization: StudioOrganization) => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRequestId();
  const submitting = useRef(false);
  const create = useMutation({ mutationFn: ({ name, slug, id }: { name: string; slug: string; id: string }) => foundationApi.createOrganization(name, slug, id) });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    if (!name.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) { setError("Add a studio name and a workspace address using lowercase letters, numbers and single hyphens."); return; }
    submitting.current = true; setError("");
    const input = { name: name.trim(), slug };
    try {
      const id = await create.mutateAsync({ ...input, id: requestId(input) });
      onCreated({ id, ...input, role: "owner" });
    } catch (failure) { setError(message(failure, "Couldn’t create your studio. Your details are still here; try again.")); }
    finally { submitting.current = false; }
  };
  return <form onSubmit={(event) => void submit(event)} className="space-y-5 rounded-panel bg-card p-6 sm:p-8">
    <h2 className="text-xl font-semibold tracking-tight">Create a studio workspace</h2>
    <fieldset disabled={create.isPending} className="space-y-5">
      <OrdoField label="Studio name" htmlFor="foundation-studio-name" required><OrdoInput id="foundation-studio-name" value={name} required maxLength={120} autoComplete="organization" placeholder="Inspirare Studio" onChange={(event) => {
        setName(event.target.value);
        if (!slugEdited) setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
      }} /></OrdoField>
      <OrdoField label="Workspace address" htmlFor="foundation-studio-slug" hint="A unique name for your workspace, such as inspirare-studio." required><OrdoInput id="foundation-studio-slug" value={slug} required maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" autoCapitalize="none" spellCheck={false} onChange={(event) => { setSlugEdited(true); setSlug(event.target.value); }} /></OrdoField>
    </fieldset>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" disabled={create.isPending}>{create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create studio</Button>
  </form>;
}

function ProjectList({ accountId, organization }: { accountId: string; organization: StudioOrganization }) {
  const navigate = useNavigate();
  const projects = useQuery({ queryKey: keys.projects(accountId, organization.id), queryFn: () => foundationApi.listProjects(organization.id), retry: 1 });
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [ownership, setOwnership] = useState<"all" | ProjectOwnership>("all");
  const canCreate = canCreateProjects(organization.role, organization.capabilities);
  const filtered = (projects.data ?? []).filter((project) => (ownership === "all" || project.ownership === ownership) && `${project.name} ${project.description ?? ""}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <div className="min-w-0">
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-3xl font-semibold tracking-[-.025em]">Projects</h1><p className="mt-2 text-sm text-muted-foreground">{canCreate ? "A place for client work and the work you do for your studio." : "The projects shared with you in this studio."}</p></div>
      {canCreate && <Button onClick={() => setShowCreate((value) => !value)} aria-expanded={showCreate} aria-controls="foundation-project-create"><Plus className="mr-1.5 h-4 w-4" />New project</Button>}
    </div>
    {canCreate && showCreate && <Suspense fallback={<Loading>Opening project setup…</Loading>}><ProjectCreateDialog accountId={accountId} organizationId={organization.id} onClose={() => setShowCreate(false)} onCreated={(id) => navigate(`/projects/${id}`, { state: { created: true } })} /></Suspense>}
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="relative min-w-0 flex-1 sm:max-w-sm"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><OrdoInput aria-label="Search projects" placeholder="Search projects" className="pl-10" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      <label htmlFor="foundation-project-ownership" className="sr-only">Filter projects by ownership</label>
      <select id="foundation-project-ownership" className={cn(selectClass, "w-auto")} value={ownership} onChange={(event) => setOwnership(event.target.value as "all" | ProjectOwnership)}><option value="all">All projects</option><option value="client">Client projects</option><option value="internal">Internal projects</option></select>
    </div>
    {projects.isPending ? <Loading>Loading projects…</Loading> : projects.isError ? <ErrorState title="Couldn’t load projects" description="Your work could not be loaded. Try again to see the projects available to you." onRetry={() => void projects.refetch()} /> : filtered.length ? <div className="divide-y divide-border overflow-hidden rounded-panel bg-card">
      {filtered.map((project) => <Link key={project.id} to={`/projects/${project.id}`} className="group flex min-w-0 items-center justify-between gap-4 px-5 py-5 transition-colors hover:bg-secondary/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><h2 className="break-words text-base font-semibold">{project.name}</h2><OwnershipBadge ownership={project.ownership} /></div><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{LIFECYCLES.find((item) => item.key === project.lifecycle)?.label}</span>{project.disciplines.length > 0 && <span>{disciplineNames(project).join(" · ")}</span>}{project.due_date && <span>Due {dateShort(project.due_date)}</span>}</div></div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>)}
    </div> : <section className="rounded-panel bg-card px-6 py-12 text-center">
      <FolderKanban className="mx-auto mb-4 h-7 w-7 text-muted-foreground" aria-hidden="true" /><h2 className="text-lg font-semibold">{projects.data?.length ? "No matching projects" : "Start with a project"}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{projects.data?.length ? "Try a different name or choose all projects." : canCreate ? "Create a client project or give your studio’s own work a home." : "Projects will appear here when a studio manager shares them with you."}</p>
      {projects.data?.length ? <Button variant="outline" className="mt-5" onClick={() => { setSearch(""); setOwnership("all"); }}>Clear filters</Button> : canCreate && !showCreate ? <Button className="mt-5" onClick={() => setShowCreate(true)}><Plus className="mr-1.5 h-4 w-4" />Create a project</Button> : null}
    </section>}
  </div>;
}


function disciplineNames(project: FoundationProject) {
  return DISCIPLINES.filter((discipline) => project.disciplines.includes(discipline.key)).map((discipline) => discipline.label);
}

function OwnershipBadge({ ownership }: { ownership: ProjectOwnership }) {
  return <span className="rounded-pill bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">{ownership === "client" ? "Client" : "Internal"}</span>;
}

function ProjectOverview({ accountId, organization }: { accountId: string; organization: StudioOrganization }) {
  const { id = "" } = useParams();
  const location = useLocation();
  const project = useQuery({ queryKey: keys.project(accountId, organization.id, id), queryFn: () => foundationApi.getProject(organization.id, id), retry: 1 });
  const clients = useQuery({ queryKey: keys.clients(accountId, organization.id), queryFn: () => foundationApi.listClients(organization.id), retry: 1 });
  const initiatives = useQuery({ queryKey: keys.initiatives(accountId, organization.id), queryFn: () => foundationApi.listInitiatives(organization.id), retry: 1 });
  const back = <Link to="/projects" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" />All projects</Link>;
  if (project.isPending) return <>{back}<Loading>Opening project…</Loading></>;
  if (project.isError) return <>{back}<ErrorState title="Couldn’t open this project" description="Try again to load the saved overview." onRetry={() => void project.refetch()} /></>;
  if (!project.data) return <>{back}<section className="rounded-panel bg-card p-6"><h1 className="text-xl font-semibold">Project unavailable</h1><p className="mt-2 max-w-prose text-sm text-muted-foreground">This project is not available in the selected workspace. Return to Projects or choose another studio you have access to.</p></section></>;
  const saved = project.data;
  const isClient = saved.ownership === "client";
  const parentQuery = isClient ? clients : initiatives;
  const parentId = isClient ? saved.client_organization_id : saved.internal_initiative_id;
  const parent = parentQuery.data?.find((item) => item.id === parentId);
  return <div className="max-w-4xl">
    {back}
    {location.state?.created && <p role="status" className="mb-5 inline-flex items-center gap-2 rounded-small bg-secondary px-4 py-3 text-sm text-secondary-foreground"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Project created and saved.</p>}
    <div className="mb-7 space-y-3"><div className="flex flex-wrap items-center gap-3"><h1 className="break-words text-3xl font-semibold tracking-[-.025em]">{saved.name}</h1><OwnershipBadge ownership={saved.ownership} /></div>{saved.description && <p className="max-w-prose whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{saved.description}</p>}</div>
    <section className="rounded-panel bg-card p-5 sm:p-7" aria-labelledby="foundation-overview-title">
      <h2 id="foundation-overview-title" className="mb-6 text-lg font-semibold">Project overview</h2>
      <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        <OverviewField label="Workspace">{organization.name}</OverviewField>
        <OverviewField label={isClient ? "Client business" : "Internal initiative"}>{parentId ? parentQuery.isPending ? "Loading…" : parentQuery.isError ? <span className="flex flex-wrap items-center gap-2"><span>Couldn’t load the name.</span><button type="button" className="text-primary underline underline-offset-2" onClick={() => void parentQuery.refetch()}>Try again</button></span> : parent?.name ?? "Name unavailable" : "No initiative"}</OverviewField>
        <OverviewField label="Lifecycle">{LIFECYCLES.find((item) => item.key === saved.lifecycle)?.label}</OverviewField>
        <OverviewField label="Due date">{saved.due_date ? dateShort(saved.due_date) : "No due date"}</OverviewField>
        <OverviewField label="Disciplines">{disciplineNames(saved).length ? disciplineNames(saved).join(", ") : "Not specified"}</OverviewField>
        <OverviewField label="Created">{dateShort(saved.created_at.slice(0, 10))}</OverviewField>
      </dl>
    </section>
  </div>;
}

function OverviewField({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="mb-1.5 text-xs text-muted-foreground">{label}</dt><dd className="break-words text-sm font-medium">{children}</dd></div>;
}
