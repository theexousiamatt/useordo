import { useState } from "react";
import { AlertTriangle, CalendarClock, Check, CheckCircle2, ChevronDown, Circle, Pencil, Tag, UserRound } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { InlineTaskTitle, InlineLabelPicker, InlineDatePicker, InlineMemberPicker } from "@/components/ordo";
import { LabelBadge } from "@/components/ordo/LabelBadge";
import type { LabelColor } from "@/lib/labelColors";
import type { ProjectLabel } from "@/hooks/useLabels";
import type { ProjectStage } from "@/hooks/useProjectStages";
import type { TaskRow } from "@/hooks/useProjectData";
import type { ProjectMemberProfile } from "@/hooks/useProjects";
import { isTaskCompleted } from "@/lib/taskCompletion";
import { dateShort } from "@/lib/format";
import { useProjectSubtasks } from "@/hooks/useSubtasks";
import { resolveStageTheme, STAGE_THEME_STYLES } from "@/lib/stageThemes";
import { cn } from "@/lib/utils";

export interface TaskDrawerEditing {
  stages: ProjectStage[];
  labels: ProjectLabel[];
  labelIds: string[];
  onRename: (title: string) => void;
  onToggleComplete: () => void;
  onMoveStage: (stageId: string) => void;
  onMembers: (ids: string[]) => void;
  onDueDate: (date: string | null) => void;
  onToggleLabel: (id: string) => void;
  onCreateLabel: (name: string, color: LabelColor) => void;
  onRenameLabel: (id: string, name: string) => void;
  onRecolorLabel: (id: string, color: LabelColor) => void;
  onDeleteLabel: (id: string) => void;
}

/** One hierarchy: task title/action first, then four direct-edit properties. */
export function TaskDrawerProperties({
  task, members, assigneeIds, editor,
}: {
  task: TaskRow;
  members: ProjectMemberProfile[];
  assigneeIds: string[];
  editor: TaskDrawerEditing;
}) {
  const [renaming, setRenaming] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [dueOpen, setDueOpen] = useState(false);
  const currentStage = editor.stages.find(stage => stage.id === task.stage_id) ?? editor.stages[0];
  const { data: checklist = [] } = useProjectSubtasks(task.project_id);
  const unfinished = checklist.filter(item => item.task_id === task.id && !item.completed).length;
  const assignedNames = assigneeIds.map(id => members.find(member => member.user_id === id)?.full_name ?? "Member");
  const complete = isTaskCompleted(task);
  const selectedLabels = editor.labelIds
    .map(id => editor.labels.find(label => label.id === id))
    .filter((label): label is ProjectLabel => Boolean(label));

  const editable = "group/property flex min-h-9 w-full min-w-0 items-center gap-1.5 rounded-md px-1 py-1 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const chevron = <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/60 opacity-70" aria-hidden="true" />;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <InlineTaskTitle value={task.title} className="text-[22px] font-semibold leading-snug tracking-tight"
              onSave={next => { editor.onRename(next); setRenaming(false); }}
              onCancel={() => setRenaming(false)} />
          ) : (
            <button type="button" onClick={() => setRenaming(true)}
              aria-label="Rename task"
              className="group/title flex min-h-10 w-full items-start gap-2 rounded-md text-left text-[22px] font-semibold leading-snug tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="min-w-0 flex-1 break-words">{task.title}</span>
              <Pencil className="mt-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover/title:opacity-100 group-focus-visible/title:opacity-100" aria-hidden="true" />
            </button>
          )}
        </div>
        <button type="button" onClick={editor.onToggleComplete}
          aria-label={complete ? "Reopen task" : "Mark task complete"}
          className={cn(
            "mt-0.5 inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            complete
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
              : "border-border text-muted-foreground hover:border-foreground/25 hover:bg-muted hover:text-foreground",
          )}>
          {complete ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <Circle className="h-4 w-4" aria-hidden="true" />}
          <span>{complete ? "Completed" : "Complete"}</span>
        </button>
      </div>

      {/* Quiet label/value layout, with no redundant outlined property chips. */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3" aria-label="Editable task properties">
        <div className="min-w-0 space-y-0.5">
          <p className="px-1 text-[11px] font-medium text-muted-foreground">Stage</p>
          <Popover open={stageOpen} onOpenChange={setStageOpen}>
            <PopoverTrigger asChild>
              <button type="button" className={editable} aria-label="Change task stage">
                <span className="truncate">{currentStage?.name ?? "Choose stage"}</span>
                {chevron}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={6} className="client-os w-64 max-w-[calc(100vw-32px)] rounded-xl p-1.5">
              <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Move to stage</p>
              {editor.stages.map(stage => (
                <button key={stage.id} type="button"
                  onClick={() => { setStageOpen(false); if (stage.id !== currentStage?.id) editor.onMoveStage(stage.id); }}
                  aria-current={stage.id === currentStage?.id ? "true" : undefined}
                  className={cn(
                    "flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted",
                    stage.id === currentStage?.id && "bg-muted/70 font-semibold",
                  )}>
                  <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-[4px]"
                    style={{ backgroundColor: STAGE_THEME_STYLES[resolveStageTheme(stage.theme)].previewAccent }} />
                  <span className="min-w-0 flex-1 truncate">{stage.name}</span>
                  {stage.id === currentStage?.id && <Check className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>

        <div className="min-w-0 space-y-0.5">
          <p className="px-1 text-[11px] font-medium text-muted-foreground">Assignees</p>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className={editable} aria-label="Edit task assignees">
                {assignedNames.length ? (
                  <span className="truncate">{assignedNames.slice(0, 2).join(", ")}{assignedNames.length > 2 ? ` +${assignedNames.length - 2}` : ""}</span>
                ) : (
                  <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
                    <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Assign
                  </span>
                )}
                {chevron}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={6} className="client-os w-72 max-w-[calc(100vw-32px)] overflow-hidden rounded-xl p-0">
              <InlineMemberPicker members={members} value={assigneeIds} onChange={editor.onMembers} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="min-w-0 space-y-0.5">
          <p className="px-1 text-[11px] font-medium text-muted-foreground">Due date</p>
          <Popover open={dueOpen} onOpenChange={setDueOpen}>
            <PopoverTrigger asChild>
              <button type="button" className={editable} aria-label="Edit task due date">
                <CalendarClock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className={cn("truncate", !task.due_date && "text-muted-foreground")}>{task.due_date ? dateShort(task.due_date) : "Set due date"}</span>
                {chevron}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={6} className="client-os w-fit max-w-[calc(100vw-32px)] overflow-hidden rounded-xl p-0">
              <InlineDatePicker value={task.due_date} onChange={date => { editor.onDueDate(date); setDueOpen(false); }} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="min-w-0 space-y-0.5">
          <p className="px-1 text-[11px] font-medium text-muted-foreground">Labels</p>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className={editable} aria-label="Edit task labels">
                {selectedLabels.length ? (
                  <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
                    {selectedLabels.slice(0, 2).map(label => <LabelBadge key={label.id} name={label.name} color={label.color} size="sm" />)}
                    {selectedLabels.length > 2 && <span className="shrink-0 text-xs text-muted-foreground">+{selectedLabels.length - 2}</span>}
                  </span>
                ) : (
                  <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
                    <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Add labels
                  </span>
                )}
                {chevron}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={6} className="client-os w-72 max-w-[calc(100vw-32px)] overflow-hidden rounded-xl p-0">
              <InlineLabelPicker labels={editor.labels} value={editor.labelIds}
                onToggle={editor.onToggleLabel} onCreate={editor.onCreateLabel}
                onRename={editor.onRenameLabel} onRecolor={editor.onRecolorLabel}
                onDelete={editor.onDeleteLabel} />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {complete && unfinished > 0 && (
        <p role="note" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600/75 dark:text-amber-400/75" aria-hidden="true" />
          {unfinished} checklist item{unfinished === 1 ? "" : "s"} still unfinished
        </p>
      )}
    </div>
  );
}
