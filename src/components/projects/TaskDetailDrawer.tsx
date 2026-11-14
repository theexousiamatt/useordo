import { useEffect, useRef, useState } from "react";
import { ChevronDown, History, Loader2, MessageSquare, Pencil, Send, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { OrdoTextarea } from "@/components/ordo/OrdoTextarea";
import { initials, timeAgo } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import type { TaskRow } from "@/hooks/useProjectData";
import { useProjectActivity, useTaskAssignees } from "@/hooks/useProjectData";
import type { ProjectMemberProfile } from "@/hooks/useProjects";
import {
  useTaskComments,
  useAddTaskComment,
  useDeleteTaskComment,
} from "@/hooks/useTaskComments";
import { TaskAttachmentsSection } from "@/components/projects/TaskAttachmentsSection";
import { TaskSubtaskChecklist } from "@/components/projects/TaskSubtaskChecklist";
import { TaskDrawerProperties, type TaskDrawerEditing } from "@/components/projects/TaskDrawerProperties";

interface Props {
  task: TaskRow | null;
  members: ProjectMemberProfile[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveDescription: (id: string, description: string | null) => void;
  editor: TaskDrawerEditing;
}

/**
 * A task is one workspace, not three disconnected tabs.
 * Quick edits live in its header, work and conversation stay in the scroll,
 * and secondary activity can be expanded only when needed.
 */
export function TaskDetailDrawer({ task, members, open, onOpenChange, onSaveDescription, editor }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="client-os !left-0 !right-auto flex h-[100dvh] w-screen max-w-[100vw] min-w-0 flex-col gap-0 overflow-x-hidden border-l border-border/70 bg-card p-0 shadow-hover sm:!left-auto sm:!right-0 sm:w-full sm:max-w-[620px]"
      >
        <SheetTitle className="sr-only">{task ? `Task details: ${task.title}` : "Task details"}</SheetTitle>
        {task && <DrawerBody key={task.id} task={task} members={members} onSaveDescription={onSaveDescription} editor={editor} />}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({
  task, members, onSaveDescription, editor,
}: {
  task: TaskRow;
  members: ProjectMemberProfile[];
  onSaveDescription: (id: string, description: string | null) => void;
  editor: TaskDrawerEditing;
}) {
  const { data: assigneesMap } = useTaskAssignees(task.project_id);
  const assigneeIds = assigneesMap?.get(task.id) ?? (task.assignee_id ? [task.assignee_id] : []);

  return (
    <>
      <header className="shrink-0 border-b border-border/70 px-5 pb-4 pr-12 pt-6 sm:px-7 sm:pr-14 sm:pt-7">
        <TaskDrawerProperties task={task} members={members} assigneeIds={assigneeIds} editor={editor} />
      </header>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 pb-12 pt-5 sm:px-7 sm:pt-6" aria-label="Task details">
        <TaskDescriptionSection task={task} onSaveDescription={onSaveDescription} />
        <section className="border-t border-border/70 pt-5">
          <TaskSubtaskChecklist projectId={task.project_id} taskId={task.id} />
        </section>
        <section className="border-t border-border/70 pt-5">
          <TaskAttachmentsSection taskId={task.id} projectId={task.project_id} />
        </section>
        <section className="border-t border-border/70 pt-5" aria-label="Discussion">
          <TaskDiscussion task={task} />
        </section>
        <section className="border-t border-border/70 pt-2">
          <ActivityHistory task={task} members={members} />
        </section>
      </div>
    </>
  );
}

export function TaskDescriptionSection({
  task, onSaveDescription,
}: {
  task: TaskRow;
  onSaveDescription: (id: string, description: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.description ?? "");
  const original = useRef(task.description ?? "");

  useEffect(() => {
    // Do not replace a user's in-progress edit with a background query refresh.
    if (editing) return;
    original.current = task.description ?? "";
    setDraft(task.description ?? "");
  }, [editing, task.description, task.id]);

  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    if (next === original.current.trim()) return;
    original.current = next;
    onSaveDescription(task.id, next || null);
  };

  const cancel = () => {
    setDraft(original.current);
    setEditing(false);
  };

  return (
    <section aria-label="Description" className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Description</h3>
        {!editing && task.description && (
          <button type="button" onClick={() => setEditing(true)}
            aria-label="Edit description"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Pencil className="h-3 w-3" aria-hidden="true" /> Edit
          </button>
        )}
      </div>
      {editing ? (
        <div>
          <OrdoTextarea
            autoFocus
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={event => {
              if (event.key === "Escape") {
                event.preventDefault();
                cancel();
              } else if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                commit();
              }
            }}
            aria-label="Task description"
            placeholder="What needs to be done? Add context or acceptance criteria…"
            rows={4}
            className="min-h-[104px] resize-y"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">Saves when you click away · ⌘/Ctrl + Enter to save · Esc to cancel</p>
        </div>
      ) : (
        <button type="button" onClick={() => setEditing(true)} aria-label={task.description ? "Edit task description" : "Add a description"}
          className="group/description flex min-h-12 w-full items-start rounded-lg px-2 py-2 text-left text-sm leading-relaxed text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {task.description ? (
            <span className="w-full whitespace-pre-wrap break-words">{task.description}</span>
          ) : (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Add context, instructions or acceptance criteria…
            </span>
          )}
        </button>
      )}
    </section>
  );
}

function TaskDiscussion({ task }: { task: TaskRow }) {
  const { user } = useAuth();
  const { data: comments, isLoading, isError, refetch } = useTaskComments(task.id);
  const add = useAddTaskComment(task.id, task.project_id);
  const del = useDeleteTaskComment(task.id);
  const [draft, setDraft] = useState("");

  const submit = () => {
    const content = draft.trim();
    if (!content || add.isPending) return;
    add.mutate(content, { onSuccess: () => setDraft("") });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">Discussion</h3>
        {!!comments?.length && <span className="text-xs tabular-nums text-muted-foreground">{comments.length}</span>}
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground" role="status">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Loading comments…
        </div>
      ) : isError ? (
        <div role="alert" className="flex items-center justify-between gap-2 text-xs text-destructive">
          Couldn't load comments.
          <Button size="sm" variant="outline" onClick={() => void refetch()}>Retry</Button>
        </div>
      ) : !comments?.length ? (
        <p className="text-sm text-muted-foreground">No comments yet. Keep decisions and feedback with the task.</p>
      ) : (
        <ol className="space-y-4" aria-label="Task comments">
          {comments.map(comment => (
            <li key={comment.id} className="group/comment flex gap-3">
              <Avatar className="h-8 w-8 shrink-0">
                {comment.author_avatar && <AvatarImage src={comment.author_avatar} alt={comment.author_name ?? ""} />}
                <AvatarFallback className="bg-muted text-[11px] text-muted-foreground">
                  {initials(comment.author_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-sm font-medium text-foreground">{comment.author_name ?? "Member"}</span>
                  <span className="text-xs text-muted-foreground">{timeAgo(comment.created_at)}</span>
                  {comment.author_id === user?.id && (
                    <button type="button" onClick={() => del.mutate(comment.id)}
                      disabled={del.isPending} aria-label="Delete comment"
                      className="ml-auto rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:opacity-0 sm:group-hover/comment:opacity-100 sm:focus-visible:opacity-100">
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">{comment.content}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="space-y-2">
        <OrdoTextarea
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          aria-label="Write a comment"
          placeholder="Share an update or leave feedback…"
          rows={2}
          className="min-h-[84px]"
        />
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={submit} disabled={!draft.trim() || add.isPending} className="gap-1.5">
            {add.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Send className="h-3.5 w-3.5" aria-hidden="true" />}
            Post comment
          </Button>
        </div>
      </div>
    </div>
  );
}

function ActivityHistory({ task, members }: { task: TaskRow; members: ProjectMemberProfile[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex min-h-10 w-full items-center gap-2 rounded-md py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <History className="h-4 w-4" aria-hidden="true" />
        Activity history
        <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-3 pt-3">
        {open && <ActivityTimeline task={task} members={members} />}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ActivityTimeline({ task, members }: { task: TaskRow; members: ProjectMemberProfile[] }) {
  const { data: activity, isLoading, isError, refetch } = useProjectActivity(task.project_id, 50);
  const nameOf = (id: string | null) =>
    members.find(member => member.user_id === id)?.full_name ?? "Someone";
  const rows = (activity ?? []).filter(event => {
    const metadata = event.metadata as Record<string, unknown>;
    return metadata?.task_id === task.id;
  });

  if (isLoading) return <p className="text-xs text-muted-foreground">Loading activity…</p>;
  if (isError) return (
    <div role="alert" className="flex items-center justify-between gap-2 text-xs text-destructive">
      Couldn't load activity.
      <Button variant="outline" size="sm" onClick={() => void refetch()}>Retry</Button>
    </div>
  );
  if (!rows.length) return <p className="text-sm text-muted-foreground">No task activity yet.</p>;

  return (
    <ol className="space-y-3 border-l border-border pl-4">
      {rows.map(event => (
        <li key={event.id} className="relative">
          <span className="absolute -left-[1.23rem] top-1 h-2 w-2 rounded-full bg-muted-foreground/50" aria-hidden="true" />
          <p className="text-sm text-foreground">
            <span className="font-medium">{nameOf(event.actor_id)}</span>{" "}
            <span className="text-muted-foreground">{event.action.replace(/_/g, " ")}</span>
          </p>
          <p className="text-xs text-muted-foreground">{timeAgo(event.created_at)}</p>
        </li>
      ))}
    </ol>
  );
}
