import { useState, type FormEvent } from "react";
import { Layers } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DeliverableAttachment, deliverableLink } from "@/components/projects/DeliverableAttachment";
import { DeliverableBadge } from "@/components/projects/ProjectBadges";
import { useCreateDeliverable, useProjectDeliverables, useProjectReviewers, useUpdateDeliverableStatus } from "@/hooks/useProjectData";
import { DeliverableReviewHistory } from "@/components/projects/DeliverableReviewHistory";
import { useProjectFiles } from "@/hooks/useProjectFiles";

type Source = "upload" | "link" | "project";
const assets = "/jenri/project-detail/";

export function TaskDeliverables({ projectId, taskId }: { projectId: string; taskId?: string }) {
  const query = useProjectDeliverables(projectId);
  const update = useUpdateDeliverableStatus(projectId);
  const reviewers = useProjectReviewers(projectId);
  const deliverables = (query.data ?? []).filter(item => !taskId || item.task_id === taskId);
  const reviewerNames = reviewers.data?.map(reviewer => reviewer.full_name || "Client reviewer").join(", ");
  const requestReview = async (id: string, action: "request" | "sign-off") => {
    try {
      await update.mutateAsync({ id, action });
      toast.success(action === "request" ? "Sent to the client for review." : "Studio sign-off saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the deliverable.");
    }
  };

  return <section className="jerin-task-deliverables" aria-label="Deliverables">
    <header><h3>Deliverables</h3><span>{deliverables.length}</span></header>
    {query.isPending ? <p role="status">Loading deliverables…</p> : query.isError ? (
      <p role="alert">Couldn’t load deliverables. <button type="button" onClick={() => void query.refetch()}>Try again</button></p>
    ) : !deliverables.length ? <div className="jerin-deliverable-empty">
      <img src={assets + "file.svg"} alt="" />
      <strong>No deliverables yet</strong>
      <p>Add a design, file or link as a deliverable to share and get approval.</p>
    </div> : <ul className="grid gap-3">
      {deliverables.map(item => <li className="jerin-deliverable-card" key={item.id}>
        <div className="flex flex-wrap justify-between gap-2">
          <strong className="break-words">{item.title}</strong>
          <DeliverableBadge status={item.status} requiresApproval={item.requires_approval} />
        </div>
        {item.version_label && <p className="text-xs text-muted-foreground">{item.version_label}</p>}
        {item.description && <p className="whitespace-pre-wrap break-words text-sm">{item.description}</p>}
        <DeliverableAttachment source={item} projectId={projectId} />
        {item.requires_approval ? <>
          <p className="text-sm font-medium">
            {reviewers.isPending ? "Loading client reviewers…" : reviewers.isError ? "Client reviewers could not be loaded." :
              reviewerNames ? `Can review: ${reviewerNames}` : "Add an active client reviewer in project settings."}
          </p>
          {(item.status === "draft" || item.status === "rejected") && <button
            type="button" className="jerin-deliverable-request" disabled={update.isPending || !reviewerNames}
            onClick={() => void requestReview(item.id, "request")}
          >{item.status === "rejected" ? "Request approval again" : "Request client approval"}</button>}
          {item.status !== "draft" && <details className="text-sm"><summary className="cursor-pointer font-medium">Client decisions</summary>
            <DeliverableReviewHistory deliverableId={item.id} projectId={projectId} />
          </details>}
        </> : <>
          <p className="text-sm font-medium">Project collaborators can record studio sign-off.</p>
          {item.status === "draft" && <button type="button" className="jerin-deliverable-request"
            disabled={update.isPending} onClick={() => void requestReview(item.id, "sign-off")}
          >Sign off and share</button>}
        </>}
      </li>)}
    </ul>}
    <AddTaskDeliverable projectId={projectId} taskId={taskId} />
  </section>;
}

function AddTaskDeliverable({ projectId, taskId }: { projectId: string; taskId?: string }) {
  const [open, setOpen] = useState(false);
  return <Sheet open={open} onOpenChange={setOpen}>
    <SheetTrigger asChild>
      <button type="button" className="jerin-deliverable-add"><img src={assets + "plus.svg"} alt="" />Add deliverable</button>
    </SheetTrigger>
    <SheetContent side="bottom" className="client-os jerin-deliverable-sheet" overlayClassName="bg-[#351001]/40">
      <SheetTitle>Add deliverable</SheetTitle>
      <SheetDescription>Attach the work you want to share, review or get approved.</SheetDescription>
      {open && <DeliverableForm projectId={projectId} taskId={taskId} onDone={() => setOpen(false)} />}
    </SheetContent>
  </Sheet>;
}

function DeliverableForm({ projectId, taskId, onDone }: { projectId: string; taskId?: string; onDone: () => void }) {
  const [kind, setKind] = useState<Source>("upload");
  const [upload, setUpload] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [fileId, setFileId] = useState("");
  const [title, setTitle] = useState("");
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [version, setVersion] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const files = useProjectFiles(kind === "project" ? projectId : undefined);
  const create = useCreateDeliverable(projectId);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const attached = files.files.find(file => file.id === fileId);
    const link = deliverableLink(url);
    const source = kind === "upload" && upload ? { kind, file: upload } as const
      : kind === "link" && link ? { kind, url: link } as const
      : kind === "project" && attached ? { kind, fileId: attached.id, name: attached.name } as const : null;
    if (!source) {
      setError(kind === "link" ? "Enter a valid HTTP or HTTPS link." : "Choose a file to attach.");
      return;
    }
    try {
      await create.mutateAsync({ title: title.trim(), description: description.trim(), version: version.trim(), requiresApproval, taskId, source });
      toast.success("Deliverable added.");
      onDone();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not add the deliverable.");
    }
  };
  const sources = [
    { id: "upload", label: "Upload file", icon: <img src={assets + "upload.svg"} alt="" /> },
    { id: "link", label: "Add link", icon: <img src={assets + "link.svg"} alt="" /> },
    { id: "project", label: "From project", icon: <Layers aria-hidden="true" strokeWidth={1.7} /> },
  ] as const;

  return <form onSubmit={submit} className="jerin-deliverable-form">
    <fieldset disabled={create.isPending} aria-label="Deliverable source">
      {sources.map(item => <button key={item.id} type="button" aria-pressed={kind === item.id} onClick={() => { if (kind !== item.id) setUpload(null); setKind(item.id); setError(""); }}>
        {item.icon}{item.label}
      </button>)}
    </fieldset>
    <label>Title <em>*</em><input value={title} maxLength={180} onChange={event => setTitle(event.target.value)} required /></label>
    {kind === "upload" && <label>File <em>*</em><input type="file" onChange={event => {
      const file = event.currentTarget.files?.[0] ?? null;
      setUpload(file);
      if (file && !title.trim()) setTitle(file.name);
    }} required /></label>}
    {kind === "link" && <label>Link <em>*</em><input type="url" placeholder="https://" value={url} onChange={event => setUrl(event.target.value)} required /></label>}
    {kind === "project" && <label>Project file <em>*</em><select required value={fileId} onChange={event => setFileId(event.target.value)}>
      <option value="">{files.loading ? "Loading files…" : files.error ? "Couldn’t load files" : files.files.length ? "Select a file" : "No project files yet"}</option>
      {files.files.map(file => <option key={file.id} value={file.id}>{file.name}</option>)}
    </select></label>}
    <label>Version (optional)<input value={version} maxLength={40} placeholder="V1" onChange={event => setVersion(event.target.value)} /></label>
    <label>Review type<select value={requiresApproval ? "client" : "studio"} onChange={event => setRequiresApproval(event.target.value === "client")}>
      <option value="client">Client approval</option>
      <option value="studio">Studio sign-off</option>
    </select></label>
    <label>Brief (optional)<textarea value={description} rows={3} maxLength={5000} onChange={event => setDescription(event.target.value)} /></label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <button type="submit" disabled={create.isPending || !title.trim()} className="jerin-deliverable-request">
      {create.isPending ? "Adding…" : "Add deliverable"}
    </button>
  </form>;
}
