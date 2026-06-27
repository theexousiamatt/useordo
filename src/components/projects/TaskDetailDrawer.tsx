import { useEffect, useRef, useState } from "react";
import {
  AlignLeft,
  MessageSquare,
  History,
  CheckSquare,
  Paperclip,
  Send,
  Trash2,
  Loader2,
  CalendarClock,
  Flag,
  CircleDot,
  User as UserIcon,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { OrdoTextarea } from "@/components/ordo/OrdoTextarea";
import { EmptyState } from "@/components/states/EmptyState";
import { cn } from "@/lib/utils";
import { dateShort, initials, timeAgo } from "@/lib/format";
import {
  PRIORITY_STYLES,
  TASK_COLUMNS,
  type TaskPriority,
} from "@/lib/projectConstants";
import { useAuth } from "@/hooks/useAuth";
import type { TaskRow } from "@/hooks/useProjectData";
import { useProjectActivity } from "@/hooks/useProjectData";
import type { ProjectMemberProfile } from "@/hooks/useProjects";
import {
  useTaskComments,
  useAddTaskComment,
  useDeleteTaskComment,
} from "@/hooks/useTaskComments";

const STATUS_LABEL = Object.fromEntries(TASK_COLUMNS.map((c) => [c.id, c.title]));

interface Props {
  task: TaskRow | null;
  members: ProjectMemberProfile[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Persist a description change (optimistic upstream). */
  onSaveDescription: (id: string, description: string | null) => void;
}

/**
 * TaskDetailDrawer — Level 2 deep-work workspace for a single task.
 * Reserved for detailed collaboration: description, comments, and activity.
 * Quick property edits (rename, labels, members, due, move) live inline on the
 * board — they are NOT duplicated here.
 */
export function TaskDetailDrawer({ task, members, open, onOpenChange, onSaveDescription }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="client-os flex w-full flex-col gap-0 border-none bg-card p-0 shadow-hover sm:max-w-xl"
      >
        {task && <DrawerBody key={task.id} task={task} members={members} onSaveDescription={onSaveDescription} />}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({
  task,
  members,
  onSaveDescription,
}: {
  task: TaskRow;
  members: ProjectMemberProfile[];
  onSaveDescription: (id: string, description: string | null) => void;
}) {
  const assignee = members.find((m) => m.user_id === task.assignee_id) ?? null;

  return (
    <Tabs defaultValue="overview" className="flex h-full flex-col">
      {/* Header */}
      <div className="space-y-3 border-b border-border px-6 pb-0 pt-5">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11px] font-semibold capitalize",
            PRIORITY_STYLES[task.priority],
          )}
        >
          <Flag className="h-3 w-3" />
          {task.priority} priority
        </span>
        <h2 className="text-xl font-semibold leading-tight tracking-tight text-foreground">
          {task.title}
        </h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CircleDot className="h-3.5 w-3.5" />
            {STATUS_LABEL[task.status]}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <UserIcon className="h-3.5 w-3.5" />
            {assignee?.full_name ?? "Unassigned"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" />
            {task.due_date ? dateShort(task.due_date) : "No due date"}
          </span>
        </div>
        {task.labels?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pb-1">
            {task.labels.map((l) => (
              <span
                key={l}
                className="inline-flex items-center rounded-pill bg-black/5 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {l}
              </span>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground/70">
          Tip: rename, assign, relabel, reschedule and move from the board — no need to open here.
        </p>
        <TabsList className="h-auto w-full justify-start gap-1 rounded-none border-none bg-transparent p-0">
          <DrawerTab value="overview" icon={AlignLeft} label="Overview" />
          <DrawerTab value="comments" icon={MessageSquare} label="Comments" />
          <DrawerTab value="activity" icon={History} label="Activity" />
        </TabsList>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <TabsContent value="overview" className="mt-0">
          <OverviewTab task={task} onSaveDescription={onSaveDescription} />
        </TabsContent>
        <TabsContent value="comments" className="mt-0 h-full">
          <CommentsTab task={task} />
        </TabsContent>
        <TabsContent value="activity" className="mt-0">
          <ActivityTabPanel task={task} members={members} />
        </TabsContent>
      </div>
    </Tabs>
  );
}

function DrawerTab({ value, icon: Icon, label }: { value: string; icon: typeof AlignLeft; label: string }) {
  return (
    <TabsTrigger
      value={value}
      className="relative gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 pb-2.5 pt-1 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
    >
      <Icon className="h-4 w-4" />
      {label}
    </TabsTrigger>
  );
}

function OverviewTab({
  task,
  onSaveDescription,
}: {
  task: TaskRow;
  onSaveDescription: (id: string, description: string | null) => void;
}) {
  const [draft, setDraft] = useState(task.description ?? "");
  const initial = useRef(task.description ?? "");

  useEffect(() => {
    setDraft(task.description ?? "");
    initial.current = task.description ?? "";
  }, [task.id, task.description]);

  const commit = () => {
    const next = draft.trim();
    if (next === (initial.current ?? "").trim()) return;
    initial.current = next;
    onSaveDescription(task.id, next || null);
  };

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Description
        </h3>
        <OrdoTextarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          placeholder="Add a detailed description, context, acceptance criteria…"
          rows={8}
        />
        <p className="mt-1.5 text-[11px] text-muted-foreground/70">Saves when you click away.</p>
      </section>

      <ReservedSection
        icon={CheckSquare}
        title="Checklist & subtasks"
        note="Break this task into steps. Coming soon."
      />
      <ReservedSection
        icon={Paperclip}
        title="Attachments"
        note="Files, images and documents for this task. Coming soon."
      />
    </div>
  );
}

function ReservedSection({
  icon: Icon,
  title,
  note,
}: {
  icon: typeof CheckSquare;
  title: string;
  note: string;
}) {
  return (
    <section className="rounded-card border border-dashed border-border p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <p className="mt-1 text-xs text-muted-foreground/70">{note}</p>
    </section>
  );
}

function CommentsTab({ task }: { task: TaskRow }) {
  const { user } = useAuth();
  const { data: comments, isLoading } = useTaskComments(task.id);
  const add = useAddTaskComment(task.id, task.project_id);
  const del = useDeleteTaskComment(task.id);
  const [draft, setDraft] = useState("");

  const submit = () => {
    const content = draft.trim();
    if (!content) return;
    add.mutate(content, { onSuccess: () => setDraft("") });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !comments?.length ? (
          <EmptyState
            icon={MessageSquare}
            title="No comments yet"
            description="Start the discussion. Mention teammates and keep decisions in context."
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
                  {c.author_id === user?.id && (
                    <button
                      type="button"
                      onClick={() => del.mutate(c.id)}
                      className="ml-auto text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
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

      <div className="sticky bottom-0 mt-4 border-t border-border bg-card pt-4">
        <OrdoTextarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Write a comment… (⌘↵ to send)"
          rows={3}
        />
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={submit} disabled={!draft.trim() || add.isPending}>
            {add.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />}
            Comment
          </Button>
        </div>
      </div>
    </div>
  );
}

function ActivityTabPanel({ task, members }: { task: TaskRow; members: ProjectMemberProfile[] }) {
  const { data: activity, isLoading } = useProjectActivity(task.project_id, 50);
  const nameOf = (id: string | null) =>
    members.find((m) => m.user_id === id)?.full_name ?? "Someone";

  // Project-level feed, filtered to entries referencing this task when possible.
  const rows = (activity ?? []).filter((a) => {
    const meta = a.metadata as Record<string, unknown>;
    return !meta?.task_id || meta.task_id === task.id;
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!rows.length) {
    return (
      <EmptyState
        icon={History}
        title="No activity yet"
        description="Changes to this task and project will appear here as a timeline."
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
