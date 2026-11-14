import { useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, CircleDot, Pencil, Tag, UserRound } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { InlineTaskTitle, InlineLabelPicker, InlineDatePicker, InlineMemberPicker } from "@/components/ordo";
import type { LabelColor } from "@/lib/labelColors";
import type { ProjectLabel } from "@/hooks/useLabels";
import type { ProjectStage } from "@/hooks/useProjectStages";
import type { TaskRow } from "@/hooks/useProjectData";
import type { ProjectMemberProfile } from "@/hooks/useProjects";
import { findTaskStage, isCompletionStage } from "@/lib/taskCompletion";
import { dateShort } from "@/lib/format";
import { useProjectSubtasks } from "@/hooks/useSubtasks";
import { cn } from "@/lib/utils";

export interface TaskDrawerEditing {
  stages: ProjectStage[];
  labels: ProjectLabel[];
  labelIds: string[];
  onRename: (title: string) => void;
  onMoveStage: (stageId: string) => void;
  onMembers: (ids: string[]) => void;
  onDueDate: (date: string | null) => void;
  onToggleLabel: (id: string) => void;
  onCreateLabel: (name: string, color: LabelColor) => void;
  onRenameLabel: (id: string, name: string) => void;
  onRecolorLabel: (id: string, color: LabelColor) => void;
  onDeleteLabel: (id: string) => void;
}

/** The drawer reuses the same inline editors and mutations as the board. */
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
  const currentStage = findTaskStage(task, editor.stages);
  const { data: checklist = [] } = useProjectSubtasks(task.project_id);
  const unfinished = checklist.filter(item => item.task_id === task.id && !item.completed).length;
  const assignedNames = assigneeIds.map(id=>members.find(member=>member.user_id===id)?.full_name??"Member");
  const propertyButton = "inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="space-y-3">
      {renaming ? (
        <InlineTaskTitle value={task.title} className="text-xl font-semibold"
          onSave={next=>{editor.onRename(next);setRenaming(false);}}
          onCancel={()=>setRenaming(false)} />
      ) : (
        <button type="button" onClick={()=>setRenaming(true)}
          aria-label="Rename task"
          className="group/title flex w-full items-start gap-2 text-left text-xl font-semibold leading-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="min-w-0 flex-1 break-words">{task.title}</span>
          <Pencil className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-60 group-hover/title:opacity-100" />
        </button>
      )}

      <div className="flex flex-wrap items-center gap-2" aria-label="Editable task properties">
        <Popover open={stageOpen} onOpenChange={setStageOpen}>
          <PopoverTrigger asChild>
            <button type="button" className={propertyButton} aria-label="Change task stage">
              {isCompletionStage(currentStage) ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> :
                <CircleDot className="h-3.5 w-3.5 text-muted-foreground" />}
              {currentStage?.name ?? "Choose stage"}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" sideOffset={8} className="client-os w-60 rounded-xl p-1.5">
            <p className="px-2 py-2 text-xs font-medium text-muted-foreground">Move to stage</p>
            {editor.stages.map(stage=>(
              <button key={stage.id} type="button"
                onClick={()=>{setStageOpen(false);if(currentStage?.id!==stage.id)editor.onMoveStage(stage.id);}}
                className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted",
                  stage.id===currentStage?.id&&"bg-muted font-semibold")}>
                {isCompletionStage(stage) ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> :
                  <CircleDot className="h-4 w-4 text-muted-foreground" />}
                <span className="flex-1 truncate">{stage.name}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className={propertyButton} aria-label="Edit task assignees">
              <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
              {assignedNames.length ? assignedNames.slice(0,2).join(", ") + (assignedNames.length>2? ` +${assignedNames.length-2}`:"") : "Assign"}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" sideOffset={8} className="client-os w-72 overflow-hidden rounded-xl p-0">
            <InlineMemberPicker members={members} value={assigneeIds} onChange={editor.onMembers} />
          </PopoverContent>
        </Popover>

        <Popover open={dueOpen} onOpenChange={setDueOpen}>
          <PopoverTrigger asChild>
            <button type="button" className={propertyButton} aria-label="Edit task due date">
              <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
              {task.due_date ? dateShort(task.due_date) : "Set due date"}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" sideOffset={8} className="client-os w-fit overflow-hidden rounded-xl p-0">
            <InlineDatePicker value={task.due_date} onChange={date=>{editor.onDueDate(date);setDueOpen(false);}} />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className={propertyButton} aria-label="Edit task labels">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              {editor.labelIds.length ? `${editor.labelIds.length} label${editor.labelIds.length===1?"":"s"}` : "Add labels"}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" sideOffset={8} className="client-os w-72 overflow-hidden rounded-xl p-0">
            <InlineLabelPicker labels={editor.labels} value={editor.labelIds}
              onToggle={editor.onToggleLabel} onCreate={editor.onCreateLabel}
              onRename={editor.onRenameLabel} onRecolor={editor.onRecolorLabel}
              onDelete={editor.onDeleteLabel} />
          </PopoverContent>
        </Popover>
      </div>
      {isCompletionStage(currentStage) && unfinished > 0 && (
        <p role="status" className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          This task is marked complete with {unfinished} unfinished checklist item{unfinished===1?"":"s"}.
        </p>
      )}
      {editor.labelIds.length>0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Task labels">
          {editor.labelIds.map(id=>{
            const label=editor.labels.find(x=>x.id===id);
            return label ? <span key={id} className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">{label.name}</span> : null;
          })}
        </div>
      )}
    </div>
  );
}
