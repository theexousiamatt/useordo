import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Drawer } from "@heroui/react";
import { Plus, X } from "lucide-react";
import { OrdoButton as Button, OrdoTextField, OrdoSelectField } from "@/design-system/controls";
import { cn } from "@/lib/utils";
import { foundationApi } from "./api";
import { keys } from "./queryKeys";
import { useRequestId } from "./useRequestId";
import { DISCIPLINES, LIFECYCLES, type CreateFoundationProject, type DisciplineKey, type ProjectLifecycle, type ProjectOwnership, type ProjectParent } from "./types";
function message(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") return error.message;
  return fallback;
}
export default function ProjectCreateDialog({ accountId, organizationId, onClose, onCreated }: { accountId: string; organizationId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const queryClient = useQueryClient();
  const clients = useQuery({ queryKey: keys.clients(accountId, organizationId), queryFn: () => foundationApi.listClients(organizationId), retry: 1 });
  const initiatives = useQuery({ queryKey: keys.initiatives(accountId, organizationId), queryFn: () => foundationApi.listInitiatives(organizationId), retry: 1 });
  const [name, setName] = useState("");
  const [ownership, setOwnership] = useState<ProjectOwnership>("client");
  const [clientId, setClientId] = useState("");
  const [initiativeId, setInitiativeId] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [disciplines, setDisciplines] = useState<DisciplineKey[]>([]);
  const [lifecycle, setLifecycle] = useState<ProjectLifecycle>("fixed_scope");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [newParent, setNewParent] = useState(false);
  const [parentName, setParentName] = useState("");
  const [parentError, setParentError] = useState("");
  const [error, setError] = useState("");
  const [closeWarning, setCloseWarning] = useState(false);
  const requestId = useRequestId();
  const parentRequestId = useRequestId();
  const submitting = useRef(false);
  const savingParent = useRef(false);
  const create = useMutation({ mutationFn: ({ input, id }: { input: CreateFoundationProject; id: string }) => foundationApi.createProject(input, id) });
  const createParent = useMutation({ mutationFn: ({ kind, name, id }: { kind: ProjectOwnership; name: string; id: string }) => kind === "client" ? foundationApi.createClient(organizationId, name, id) : foundationApi.createInitiative(organizationId, name, id) });
  const parentQuery = ownership === "client" ? clients : initiatives;
  const pending = create.isPending || createParent.isPending;

  const dirty = !!(name || description || dueDate || parentName || clientId || initiativeId || disciplines.length || ownership !== "client" || lifecycle !== "fixed_scope");
  const requestClose = () => {
    if (pending || submitting.current || savingParent.current) return;
    if (dirty) { setCloseWarning(true); return; }
    onClose();
  };
  const saveParent = async () => {
    if (savingParent.current || !parentName.trim()) return;
    savingParent.current = true; setParentError("");
    const input = { kind: ownership, name: parentName.trim() };
    try {
      const id = await createParent.mutateAsync({ ...input, id: parentRequestId({ organizationId, ...input }) });
      const queryKey = ownership === "client" ? keys.clients(accountId, organizationId) : keys.initiatives(accountId, organizationId);
      queryClient.setQueryData<ProjectParent[]>(queryKey, (current) => [...(current ?? []).filter((item) => item.id !== id), { id, organization_id: organizationId, name: input.name }]);
      if (ownership === "client") setClientId(id); else setInitiativeId(id);
      setNewParent(false); setParentName("");
      void queryClient.invalidateQueries({ queryKey });
    } catch (failure) { setParentError(message(failure, "Couldn’t save this name. Your details are still here; try again.")); }
    finally { savingParent.current = false; }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting.current || pending) return;
    if (!name.trim()) { setError("Give your project a name."); return; }
    if (ownership === "client" && !clientId) { setError("Choose or add the client business for this project."); return; }
    if (newParent && parentName.trim()) { setError(`Save the ${ownership === "client" ? "client business" : "initiative"} first, or cancel adding it.`); return; }
    const input: CreateFoundationProject = {
      organizationId, name: name.trim(), ownership, disciplineKeys: disciplines, lifecycle,
      clientOrganizationId: ownership === "client" ? clientId : null,
      internalInitiativeId: ownership === "internal" ? initiativeId || null : null,
      description: description.trim() || null, dueDate: dueDate || null,
    };
    submitting.current = true; setError("");
    try {
      const id = await create.mutateAsync({ input, id: requestId(input) });
      void queryClient.invalidateQueries({ queryKey: keys.projects(accountId, organizationId) });
      onCreated(id);
    } catch (failure) { setError(message(failure, "Couldn’t create the project. Your draft is still here; try again.")); }
    finally { submitting.current = false; }
  };

  return <Drawer.Backdrop isOpen isDismissable={!pending} isKeyboardDismissDisabled={pending} onOpenChange={open => { if (!open) requestClose(); }} className="client-os ordo-ui">
    <Drawer.Content placement="right"><Drawer.Dialog>
    <form noValidate onSubmit={(event) => void submit(event)} aria-busy={pending} className="project-create-form">
      <Drawer.Header><div><Drawer.Heading>New project</Drawer.Heading><p className="mt-1.5 text-sm text-muted-foreground">Start with the essentials. Add more detail when you need it.</p></div><Button type="button" variant="ghost" isIconOnly aria-label="Close project form" isDisabled={pending} onPress={requestClose}><X className="h-4 w-4" aria-hidden="true" /></Button></Drawer.Header>
      <Drawer.Body>
      {closeWarning && <div className="space-y-3"><p role="alert">You have unsaved changes. Keep editing or discard this draft.</p><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onPress={() => setCloseWarning(false)}>Keep editing</Button><Button type="button" variant="ghost" onPress={onClose}>Discard draft</Button></div></div>}
    <fieldset disabled={pending} className="space-y-5">
      <fieldset><legend className="mb-2 text-sm font-medium">Who is this work for?</legend><div className="flex flex-wrap gap-3">
        {(["client", "internal"] as const).map((kind) => <label key={kind} className={cn("flex cursor-pointer items-center gap-3 rounded-small border px-4 py-3 text-sm", ownership === kind ? "border-primary/40 bg-secondary" : "border-border")}><input type="radio" name="foundation-ownership" value={kind} checked={ownership === kind} onChange={() => { setOwnership(kind); setNewParent(false); setParentName(""); setParentError(""); setError(""); }} className="h-4 w-4 accent-primary" />{kind === "client" ? "Client project" : "Internal project"}</label>)}
      </div></fieldset>
      <OrdoTextField label="Project name" value={name} isRequired autoFocus maxLength={200} placeholder={ownership === "internal" ? "Lora" : "Devine website"} onChange={setName} error={error === "Give your project a name." ? error : undefined} />
      <div className="space-y-3">
        {parentQuery.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading {ownership === "client" ? "client businesses" : "initiatives"}…</p> : parentQuery.isError ? <div role="alert" className="flex flex-wrap items-center gap-3 text-sm"><span className="text-destructive">Couldn’t load {ownership === "client" ? "client businesses" : "initiatives"}.</span><Button type="button" variant="outline" size="sm" onPress={() => void parentQuery.refetch()}>Try again</Button></div> : <OrdoSelectField isRequired={ownership === "client"} label={ownership === "client" ? "Client business" : "Internal initiative"} hint={ownership === "client" ? "A business record, independent of any person’s login or invitation." : "Optional. Group related internal work under an initiative."} value={ownership === "client" ? clientId : initiativeId} onChange={ownership === "client" ? setClientId : setInitiativeId} isDisabled={pending} options={[{id:"",name:ownership === "client" ? "Choose a client business" : "No initiative"}, ...(parentQuery.data ?? []).map(parent => ({id:parent.id,name:parent.name}))]} />}
        {!newParent ? <Button type="button" variant="outline" size="sm" onPress={() => { setNewParent(true); setParentError(""); }}><Plus className="mr-1.5 h-4 w-4" />{ownership === "client" ? "Add client business" : "Add initiative"}</Button> : <div className="space-y-3 rounded-small bg-secondary/60 p-4">
          <OrdoTextField label={ownership === "client" ? "Business name" : "Initiative name"} value={parentName} maxLength={200} onChange={setParentName} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void saveParent(); } }} />
          {parentError && <p role="alert" className="text-sm text-destructive">{parentError}</p>}
          <div className="flex flex-wrap gap-2"><Button type="button" size="sm" isPending={createParent.isPending} isDisabled={!parentName.trim() || pending} onPress={() => void saveParent()}>{ownership === "client" ? "Save client business" : "Save initiative"}</Button><Button type="button" size="sm" variant="ghost" isDisabled={pending} onPress={() => { setNewParent(false); setParentError(""); }}>Cancel</Button></div>
        </div>}
      </div>
      {detailsOpen && <div id="foundation-project-details" className="space-y-5 border-t border-border pt-6">
        <fieldset><legend className="text-sm font-medium">Disciplines</legend><p className="mb-3 mt-1 text-xs text-muted-foreground">Choose any that apply. A project can span several disciplines.</p><div className="flex flex-wrap gap-2">{DISCIPLINES.map((discipline) => <label key={discipline.key} className={cn("inline-flex cursor-pointer items-center gap-2 rounded-small border px-3 py-2.5 text-sm", disciplines.includes(discipline.key) ? "border-primary/40 bg-secondary" : "border-border")}><input type="checkbox" className="h-4 w-4 accent-primary" checked={disciplines.includes(discipline.key)} onChange={(event) => setDisciplines((current) => event.target.checked ? [...current, discipline.key] : current.filter((key) => key !== discipline.key))} />{discipline.label}</label>)}</div></fieldset>
        <OrdoSelectField label="Lifecycle" hint={LIFECYCLES.find(item => item.key === lifecycle)?.description} value={lifecycle} onChange={value => setLifecycle(value as ProjectLifecycle)} isDisabled={pending} options={LIFECYCLES.map(item => ({id:item.key,name:item.label}))} />
        <OrdoTextField label="Description" value={description} maxLength={5000} placeholder="What are you setting out to do?" onChange={setDescription} multiline />
        <div className="ordo-field"><label className="label" htmlFor="foundation-project-due">Due date</label><input className="input" id="foundation-project-due" type="date" value={dueDate} disabled={pending} onChange={event => setDueDate(event.currentTarget.value)} /></div>
      </div>}
    </fieldset>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <span role="status" className="sr-only">{pending ? "Saving project details…" : ""}</span>
    </Drawer.Body>
    <Drawer.Footer><Button type="button" variant="ghost" isDisabled={pending} aria-expanded={detailsOpen} aria-controls="foundation-project-details" onPress={() => setDetailsOpen(value => !value)}>{detailsOpen ? "Hide details" : "Add details"}</Button><Button type="submit" isPending={create.isPending} isDisabled={pending || (ownership === "client" && parentQuery.isPending)}>Create project</Button></Drawer.Footer>
    </form></Drawer.Dialog></Drawer.Content>
  </Drawer.Backdrop>;
}
