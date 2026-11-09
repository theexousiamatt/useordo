import { useEffect, useRef, useState } from "react";
import {
  AlignLeft, MessageSquare, History, Send, Trash2, Loader2,
  CalendarDays, CircleDot, Users, Tag,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrdoTextarea } from "@/components/ordo/OrdoTextarea";
import { InlineDatePicker, InlineLabelPicker, InlineMemberPicker } from "@/components/ordo";
import { ErrorState } from "@/components/states/ErrorState";
import { EmptyState } from "@/components/states/EmptyState";
import { dateShort, initials, timeAgo } from "@/lib/format";
import { TASK_COLUMNS } from "@/lib/projectConstants";
import { useAuth } from "@/hooks/useAuth";
import type { TaskRow } from "@/hooks/useProjectData";
import { useProjectActivity, useTaskAssignees } from "@/hooks/useProjectData";
import {
  useProjectLabels, useTaskLabelMap, useSetTaskLabels, useCreateLabel,
  useUpdateLabel, useDeleteLabel,
} from "@/hooks/useLabels";
import { LabelBadge } from "@/components/ordo/LabelBadge";
import type { ProjectMemberProfile } from "@/hooks/useProjects";
import {
  useTaskComments, useAddTaskComment, useDeleteTaskComment,
} from "@/hooks/useTaskComments";
import { TaskAttachmentsSection } from "@/components/projects/TaskAttachmentsSection";

const STATUS_LABEL = Object.fromEntries(TASK_COLUMNS.map((column) => [column.id, column.title]));

interface Props {
  task: TaskRow | null;
  members: ProjectMemberProfile[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPatch: (id: string, patch: Partial<TaskRow>) => Promise<void>;
  onSetAssignees: (taskId: string, userIds: string[]) => void;
  canEdit: boolean;
  onMoveStatus?: (task: TaskRow, status: TaskRow["status"]) => Promise<void>;
  onUnsavedChange?: (state: { dirty: boolean; pending: boolean }) => void;
}

export function TaskDetailDrawer({ task, members, open, onOpenChange, onPatch, onSetAssignees, canEdit, onMoveStatus, onUnsavedChange }: Props) {
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [closeNotice, setCloseNotice] = useState("");
  useEffect(() => { setDirty(false); setPending(false); setCloseNotice(""); }, [task?.id, open]);
  useEffect(() => { onUnsavedChange?.({ dirty, pending }); }, [dirty, pending, onUnsavedChange]);
  useEffect(() => { if (!pending) setCloseNotice(""); }, [pending]);
  const close = (next: boolean) => {
    if (!next && pending) {
      setCloseNotice("Please wait for your changes to finish saving.");
      return;
    }
    if (!next && dirty && !window.confirm("Discard your unsaved task changes?")) return;
    if (!next) setDirty(false);
    onOpenChange(next);
  };

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent side="right" aria-describedby={undefined} overlayClassName="bg-slate-950/30"
        className="client-os flex w-full flex-col gap-0 border-l border-border !bg-card p-0 shadow-hover sm:max-w-[600px] data-[state=open]:duration-200 data-[state=closed]:duration-150">
        {task && <DrawerBody key={task.id} task={task} members={members} onPatch={onPatch}
          onSetAssignees={onSetAssignees} canEdit={canEdit} onDirtyChange={setDirty} onPendingChange={setPending} onMoveStatus={onMoveStatus} />}
        {!task && <div className="space-y-4 p-6">
          <SheetTitle className="pr-8">Task unavailable</SheetTitle>
          <p className="text-sm text-muted-foreground">This task may have been removed or your access may have changed. Close this panel to return to the board.</p>
          <Button variant="outline" onClick={() => close(false)}>Back to board</Button>
        </div>}
        {closeNotice && <p role="status" className="border-t border-border px-5 py-3 text-sm text-muted-foreground">{closeNotice}</p>}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({
  task, members, onPatch, onSetAssignees, canEdit, onDirtyChange, onPendingChange, onMoveStatus,
}: {
  task: TaskRow;
  members: ProjectMemberProfile[];
  onPatch: Props["onPatch"];
  onSetAssignees: Props["onSetAssignees"];
  canEdit: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onPendingChange: (pending: boolean) => void;
  onMoveStatus: Props["onMoveStatus"];
}) {
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [descriptionDraft, setDescriptionDraft] = useState(task.description ?? "");
  const baseline = useRef({ title: task.title, description: task.description ?? "" });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [error, setError] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [commentPending, setCommentPending] = useState(false);
  const saving = useRef(false);
  const { data: assigneesMap } = useTaskAssignees(task.project_id);
  const assigneeIds = assigneesMap?.get(task.id) ?? (task.assignee_id ? [task.assignee_id] : []);
  const assignees = assigneeIds.map((id) => members.find((member) => member.user_id === id)).filter(Boolean) as ProjectMemberProfile[];
  const { data: projectLabels = [] } = useProjectLabels(task.project_id);
  const { data: labelMap } = useTaskLabelMap(task.project_id);
  const setLabels = useSetTaskLabels(task.project_id, task.workspace_id);
  const createLabel = useCreateLabel(task.project_id, task.workspace_id);
  const updateLabel = useUpdateLabel(task.project_id);
  const deleteLabel = useDeleteLabel(task.project_id);
  const labelIds = labelMap?.get(task.id) ?? [];
  const taskLabels = labelIds.map((id) => projectLabels.find((label) => label.id === id))
    .filter((label): label is (typeof projectLabels)[number] => !!label);

  const titleDirty = titleDraft.trim() !== baseline.current.title;
  const descriptionDirty = descriptionDraft.trim() !== baseline.current.description;
  useEffect(() => {
    onDirtyChange(titleDirty || descriptionDirty || !!commentDraft.trim());
  }, [titleDirty, descriptionDirty, commentDraft, onDirtyChange, saveState]);
  useEffect(() => { onPendingChange(saveState === "saving" || commentPending); }, [saveState, commentPending, onPendingChange]);
  // Refresh clean fields after another editor changes them, without replacing a local draft.
  useEffect(() => {
    if (saving.current) return;
    const nextDescription = task.description ?? "";
    setTitleDraft((draft) => draft.trim() === baseline.current.title ? task.title : draft);
    setDescriptionDraft((draft) => draft.trim() === baseline.current.description ? nextDescription : draft);
    baseline.current = { title: task.title, description: nextDescription };
  }, [task.title, task.description]);

  const saveText = async (field: "title" | "description") => {
    if (!canEdit || saving.current) return;
    const value = (field === "title" ? titleDraft : descriptionDraft).trim();
    if (field === "title" && !value) { setError("Task title is required."); return; }
    if (value === baseline.current[field]) return;
    saving.current = true;
    setSaveState("saving");
    setError("");
    try {
      await onPatch(task.id, { [field]: field === "description" ? value || null : value });
      baseline.current[field] = value;
      setSaveState("saved");
    } catch {
      setSaveState("failed");
      setError("Changes could not be saved. Your text is still here; try again.");
    } finally {
      saving.current = false;
    }
  };
  const saveMetadata = async (patch: Partial<TaskRow>) => {
    if (!canEdit || saving.current) return;
    saving.current = true;
    setSaveState("saving");
    setError("");
    try {
      if (patch.status && onMoveStatus) await onMoveStatus(task, patch.status);
      else await onPatch(task.id, patch);
      setSaveState("saved");
    }
    catch { setSaveState("failed"); setError("This change could not be saved. Try again."); }
    finally { saving.current = false; }
  };

  return (
    <Tabs defaultValue="overview" className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 border-b border-border px-5 pb-0 pt-5 sm:px-7">
        <SheetTitle className="pr-8 text-xl font-semibold tracking-tight">Task details</SheetTitle>
        {canEdit ? <div>
          <label htmlFor="task-title" className="sr-only">Task title</label>
          <textarea rows={2} id="task-title" value={titleDraft} onChange={(event) => { setTitleDraft(event.target.value); setSaveState("idle"); }}
            onBlur={() => { void saveText("title"); }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void saveText("title"); }
              if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setTitleDraft(baseline.current.title); setError(""); }
            }}
            className="min-h-12 max-h-32 w-full resize-none rounded-md border border-transparent bg-transparent px-1 py-1 text-lg font-semibold leading-snug outline-hidden focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/20" />
        </div> : <h3 className="break-words text-lg font-semibold">{task.title}</h3>}
        <div className="grid grid-cols-2 gap-2 pb-1 text-sm sm:grid-cols-3">
          <div className="min-w-0">
            <span className="mb-1 block text-xs text-muted-foreground">Status</span>
            {canEdit ? <select aria-label="Task status" value={task.status} disabled={saveState === "saving"}
              onChange={(event) => { void saveMetadata({ status: event.target.value as TaskRow["status"] }); }}
              className="h-10 w-full rounded-small border border-border bg-card px-2 text-sm">
              {TASK_COLUMNS.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}
            </select> : <span className="inline-flex items-center gap-1.5"><CircleDot className="h-4 w-4" />{STATUS_LABEL[task.status]}</span>}
          </div>
          <div className="min-w-0">
            <span className="mb-1 block text-xs text-muted-foreground">Assignee</span>
            {canEdit ? <Popover><PopoverTrigger asChild><button type="button" disabled={saveState === "saving"}
              className="flex h-10 w-full items-center gap-2 truncate rounded-small border border-border px-2 text-left hover:bg-muted">
              <Users className="h-4 w-4 shrink-0" /><span className="truncate">{assignees.length ? assignees.map((member) => member.full_name ?? "Member").join(", ") : "Unassigned"}</span>
            </button></PopoverTrigger><PopoverContent className="client-os w-72 rounded-small p-0" align="start">
              <InlineMemberPicker members={members} value={assigneeIds} onChange={(ids) => onSetAssignees(task.id, ids)} />
            </PopoverContent></Popover> : <span>{assignees.map((member) => member.full_name ?? "Member").join(", ") || "Unassigned"}</span>}
          </div>
          <div className="min-w-0">
            <span className="mb-1 block text-xs text-muted-foreground">Due date</span>
            {canEdit ? <Popover><PopoverTrigger asChild><button type="button" disabled={saveState === "saving"}
              className="flex h-10 w-full items-center gap-2 rounded-small border border-border px-2 text-left hover:bg-muted">
              <CalendarDays className="h-4 w-4 shrink-0" />{task.due_date ? dateShort(task.due_date) : "No date"}
            </button></PopoverTrigger><PopoverContent className="client-os w-auto rounded-small p-0" align="start">
              <InlineDatePicker value={task.due_date} onChange={(value) => { void saveMetadata({ due_date: value }); }} />
            </PopoverContent></Popover> : <span>{task.due_date ? dateShort(task.due_date) : "No date"}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pb-1">
          {taskLabels.map((label) => <LabelBadge key={label.id} name={label.name} color={label.color} />)}
          {canEdit && <Popover><PopoverTrigger asChild><Button type="button" size="sm" variant="outline"><Tag className="mr-1.5 h-3.5 w-3.5" />Labels</Button></PopoverTrigger>
            <PopoverContent className="client-os w-72 rounded-small p-0" align="start">
              <InlineLabelPicker labels={projectLabels} value={labelIds}
                onToggle={(labelId) => setLabels.mutate({ taskId: task.id, labelIds: labelIds.includes(labelId) ? labelIds.filter((id) => id !== labelId) : [...labelIds, labelId] })}
                onCreate={(name, color) => createLabel.mutate({ name, color })}
                onRename={(id, name) => updateLabel.mutate({ id, name })}
                onRecolor={(id, color) => updateLabel.mutate({ id, color })}
                onDelete={(id) => deleteLabel.mutate(id)} />
            </PopoverContent></Popover>}
        </div>
        <TabsList className="h-auto w-full justify-start gap-5 overflow-x-auto rounded-none border-none bg-transparent p-0">
          <DrawerTab value="overview" icon={AlignLeft} label="Overview" />
          <DrawerTab value="comments" icon={MessageSquare} label="Comments" />
          <DrawerTab value="activity" icon={History} label="Activity" />
        </TabsList>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
        {(saveState !== "idle" || error) && <p role="status" className={`mb-4 text-xs ${error ? "text-destructive" : "text-muted-foreground"}`}>
          {error || (saveState === "saving" ? "Saving changes…" : "Saved")}
        </p>}
        <TabsContent value="overview" className="mt-0">
          <div className="space-y-6">
            <section>
              <label htmlFor="task-description" className="mb-2 block text-sm font-medium">Description</label>
              {canEdit ? <>
                <OrdoTextarea id="task-description" value={descriptionDraft}
                  onChange={(event) => { setDescriptionDraft(event.target.value); setSaveState("idle"); }}
                  placeholder="Add context or the outcome this task needs." rows={6} />
                {descriptionDirty && <div className="mt-2 flex items-center gap-2">
                  <Button size="sm" disabled={saveState === "saving"} onClick={() => { void saveText("description"); }}>Save description</Button>
                  <Button size="sm" variant="ghost" onClick={() => setDescriptionDraft(baseline.current.description)}>Discard</Button>
                </div>}
              </> : <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{task.description || "No description"}</p>}
            </section>
            <TaskAttachmentsSection taskId={task.id} projectId={task.project_id} readOnly={!canEdit} />
          </div>
        </TabsContent>
        <TabsContent value="comments" className="mt-0 h-full"><CommentsTab task={task} canEdit={canEdit} draft={commentDraft} onDraftChange={setCommentDraft} onPendingChange={setCommentPending} /></TabsContent>
        <TabsContent value="activity" className="mt-0"><ActivityTabPanel task={task} members={members} /></TabsContent>
      </div>
    </Tabs>
  );
}

function DrawerTab({ value, icon: Icon, label }: { value: string; icon: typeof AlignLeft; label: string }) {
  return <TabsTrigger value={value}
    className="relative gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 pb-3 pt-1 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none">
    <Icon className="h-4 w-4" />{label}
  </TabsTrigger>;
}

function CommentsTab({ task, canEdit, draft, onDraftChange, onPendingChange }: {
  task: TaskRow; canEdit: boolean; draft: string; onDraftChange: (value: string) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const { user } = useAuth();
  const { data: comments, isLoading, isError, refetch } = useTaskComments(task.id);
  const add = useAddTaskComment(task.id, task.project_id);
  const del = useDeleteTaskComment(task.id);
  const [commentError, setCommentError] = useState("");
  const sending = useRef(false);
  const submit = async () => {
    const content = draft.trim();
    if (!canEdit || !content || sending.current) return;
    sending.current = true;
    onPendingChange(true);
    setCommentError("");
    try {
      await add.mutateAsync(content);
      onDraftChange("");
    } catch {
      setCommentError("Your comment could not be sent. It is still here; try again.");
    } finally { sending.current = false; onPendingChange(false); }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? <ErrorState title="Couldn’t load comments" onRetry={() => { void refetch(); }} /> : !comments?.length ? (
          <EmptyState
            icon={MessageSquare}
            title="No comments yet"
            description={canEdit ? "Start the discussion and keep decisions in context." : "Comments on this task will appear here."}
          />
        ) : (
          comments.map((c) => (
            <div key={c.id} className="group flex gap-3">
              <Avatar className="h-8 w-8 shrink-0">
                {c.author_avatar && <AvatarImage src={c.author_avatar} alt={c.author_name ?? ""} />}
                <AvatarFallback className="bg-muted text-[11px] text-muted-foreground">
                  {initials(c.author_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {c.author_name ?? "Member"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{timeAgo(c.created_at)}</span>
                  {canEdit && c.author_id === user?.id && (
                    <button
                      type="button"
                      disabled={del.isPending}
                      onClick={() => {
                        if (!window.confirm("Delete this comment? This cannot be undone.")) return;
                        setCommentError("");
                        del.mutate(c.id, { onError: () => setCommentError("The comment could not be deleted. Try again.") });
                      }}
                      className="ml-auto rounded-small p-2 text-muted-foreground hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Delete comment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground/90">
                  {c.content}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {commentError && <p role="alert" className="mt-3 text-sm text-destructive">{commentError}</p>}
      {canEdit && <div className="sticky bottom-0 mt-4 border-t border-border bg-card pt-4">
        <OrdoTextarea
          value={draft}
          aria-label="Comment"
          disabled={add.isPending}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="Write a comment… (⌘↵ to send)"
          rows={3}
        />
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={() => { void submit(); }} disabled={!draft.trim() || add.isPending}>
            {add.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />}
            Comment
          </Button>
        </div>
      </div>}
    </div>
  );
}

function ActivityTabPanel({ task, members }: { task: TaskRow; members: ProjectMemberProfile[] }) {
  const { data: activity, isLoading, isError, refetch } = useProjectActivity(task.project_id, 50);
  const nameOf = (id: string | null) =>
    members.find((m) => m.user_id === id)?.full_name ?? "Someone";

  // Project-level feed must not leak unrelated project activity into a task.
  const rows = (activity ?? []).filter((a) => {
    const meta = a.metadata as Record<string, unknown>;
    return meta?.task_id === task.id || meta?.id === task.id;
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) return <ErrorState title="Couldn’t load activity" onRetry={() => { void refetch(); }} />;

  if (!rows.length) {
    return (
      <EmptyState
        icon={History}
        title="No activity yet"
        description="Changes to this task will appear here when activity is recorded."
      />
    );
  }

  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {rows.map((a) => (
        <li key={a.id} className="relative">
          <span className="absolute -left-[1.45rem] top-1 h-2 w-2 rounded-full bg-primary" />
          <p className="text-sm text-foreground">
            <span className="font-medium">{nameOf(a.actor_id)}</span>{" "}
            <span className="text-muted-foreground">{a.action.replace(/_/g, " ")}</span>
          </p>
          <p className="text-[11px] text-muted-foreground">{timeAgo(a.created_at)}</p>
        </li>
      ))}
    </ol>
  );
}
