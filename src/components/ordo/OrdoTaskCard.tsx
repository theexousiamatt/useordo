import { forwardRef, type KeyboardEvent, type ReactNode } from "react";
import {
  Calendar,
  MessageSquare,
  Paperclip,
  GripVertical,
  Plus,
  AlertTriangle,
  Circle,
  CheckCircle2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { dateShort, initials } from "@/lib/format";
import { LabelBadge } from "@/components/ordo/LabelBadge";
import type { TaskStatus } from "@/lib/projectConstants";
import { STAGE_THEME_STYLES, resolveStageTheme, type StageTheme } from "@/lib/stageThemes";
import type { ProjectMemberProfile } from "@/hooks/useProjects";

export interface TaskLabelChip {
  id: string;
  name: string;
  color: string;
}

/** Progress is meaningful only for tasks containing at least one subtask. */
export interface SubtaskProgress {
  completed: number;
  total: number;
}

export function calculateSubtaskPercent(subtasks: SubtaskProgress | undefined): number | null {
  if (!subtasks || subtasks.total <= 0) return null;
  const completed = Math.min(subtasks.total, Math.max(0, subtasks.completed));
  return Math.round((completed / subtasks.total) * 100);
}

export interface OrdoTaskCardProps {
  title: string;
  /** Kept only for older callers; workflow presentation uses stageName. */
  status?: TaskStatus;
  /** Explicit task completion, independent of stage location and checklist. */
  completed?: boolean;
  onToggleCompleted?: () => void;
  description?: string | null;
  dueDate?: string | null;
  labels?: TaskLabelChip[];
  /** Only tasks with one or more subtasks show a progress bar. */
  subtasks?: SubtaskProgress;
  /** Opens the lightweight board label picker instead of task details. */
  onEditLabels?: () => void;
  assignees?: ProjectMemberProfile[];
  commentCount?: number;
  attachmentCount?: number;
  /** Marks the card with the orange "blocked" treatment. */
  blocked?: boolean;
  /** Inherited from the column stage. */
  stageTheme?: StageTheme;
  /** Visible workflow name; reporting status stays an internal compatibility field. */
  stageName?: string;
  interactive?: boolean;
  onOpen?: () => void;
  /** When provided, replaces the title with an inline editor. */
  titleEditor?: ReactNode;
  dragHandleProps?: Record<string, unknown>;
  /** Render in the drag overlay (slight tilt + stronger shadow). */
  overlay?: boolean;
  className?: string;
}

export const OrdoTaskCard = forwardRef<HTMLDivElement, OrdoTaskCardProps>(
  (
    {
      title,
      completed,
      onToggleCompleted,
      description,
      dueDate,
      labels = [],
      subtasks,
      onEditLabels,
      assignees = [],
      commentCount = 0,
      attachmentCount = 0,
      blocked,
      stageTheme = "neutral",
      stageName,
      interactive = true,
      onOpen,
      titleEditor,
      dragHandleProps,
      overlay,
      className,
    },
    ref,
  ) => {
    const tokens = STAGE_THEME_STYLES[resolveStageTheme(stageTheme)];
    const isBlocked = blocked ?? false;
    const pct = calculateSubtaskPercent(subtasks);


    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      if (onOpen && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        onOpen();
      }
    };

    return (
      <div
        ref={ref}
        role={onOpen ? "button" : undefined}
        tabIndex={onOpen ? 0 : undefined}
        onClick={onOpen}
        onKeyDown={handleKeyDown}
        aria-label={onOpen ? `Open task: ${title}` : undefined}
        className={cn(
          "group rounded-card bg-card p-1.5 shadow-subtle outline-none",
          interactive &&
            "cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-hover focus-visible:ring-2 focus-visible:ring-ring",
          overlay && "rotate-1 shadow-hover",
          className,
        )}
      >
        <div className={cn("rounded-[16px] border p-4 transition-colors", tokens.surface, tokens.border)}>
          {/* Stage is a name and theme only, never a completion category. */}
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex min-w-0 max-w-[70%] items-center gap-1.5 rounded-pill bg-background/65 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              {isBlocked && <AlertTriangle className="h-3 w-3 shrink-0 text-orange-600" aria-label="Task blocked" />}
              <span className="truncate">{stageName ?? "Stage"}</span>
            </span>
            <div className="flex shrink-0 items-center gap-1">
              {onToggleCompleted && (
                <button type="button"
                  onClick={event=>{event.stopPropagation();onToggleCompleted();}}
                  aria-label={completed ? "Reopen task" : "Mark task complete"}
                  title={completed ? "Reopen task" : "Mark task complete"}
                  className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {completed ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> :
                    <Circle className="h-4 w-4" />}
                </button>
              )}
              {!onToggleCompleted && completed && (
                <span title="Task completed" aria-label="Task completed">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </span>
              )}
              {dragHandleProps && (
                <button {...dragHandleProps}
                  className="cursor-grab touch-none rounded-md p-0.5 text-muted-foreground/40 opacity-0 transition-opacity hover:text-muted-foreground group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label="Drag task" onClick={event=>event.stopPropagation()}>
                  <GripVertical className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Body: title + description */}
          <div className="mt-3">
            {titleEditor ? (
              titleEditor
            ) : (
              <h4 className="text-sm font-semibold leading-snug text-foreground line-clamp-2">
                {title}
              </h4>
            )}
            {description && (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                {description}
              </p>
            )}
            {(labels.length > 0 || onEditLabels) && (
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {labels.map((label) => (
                  <LabelBadge key={label.id} name={label.name} color={label.color} size="sm"
                    onClick={onEditLabels} />
                ))}
                {onEditLabels && (
                  <button type="button"
                    onClick={(event) => { event.stopPropagation(); onEditLabels(); }}
                    aria-label={`Add or edit labels for ${title}`}
                    className="inline-flex h-6 items-center gap-1 rounded-pill border border-dashed border-border/70 px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Plus className="h-3 w-3" aria-hidden="true" />
                    {labels.length === 0 ? "Add label" : <span className="sr-only">Edit labels</span>}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* A single task has no artificial percentage; only actual subtasks contribute. */}
          {pct !== null && (
            <div className="mt-4" aria-label={`Subtasks: ${subtasks!.completed} of ${subtasks!.total} complete`}>
              <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  Subtasks · {subtasks!.completed}/{subtasks!.total}
                  {completed === true && pct < 100 && (
                    <span
                      role="note"
                      tabIndex={0}
                      title={`${subtasks!.total - subtasks!.completed} unfinished checklist item${subtasks!.total - subtasks!.completed === 1 ? "" : "s"}`}
                      aria-label="This task is complete but some checklist items remain unfinished"
                      className="inline-flex shrink-0 items-center text-amber-600/75 dark:text-amber-400/75 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                    </span>
                  )}
                </span>
                <span className="tabular-nums text-foreground">{pct}%</span>
              </div>
              <div className={cn("h-1.5 w-full overflow-hidden rounded-pill", tokens.track)}
                role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Subtask completion">
                <div className={cn("h-full rounded-pill transition-all", tokens.bar)}
                  style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}

          {/* Footer: assignees + meta */}
          <div className={cn("mt-4 flex items-center justify-between border-t pt-3", tokens.divider)}>
            <div className="flex -space-x-2">
              {assignees.slice(0, 3).map((m) => (
                <Avatar key={m.user_id} className="h-6 w-6 ring-2 ring-card">
                  {m.avatar_url && <AvatarImage src={m.avatar_url} alt={m.full_name ?? ""} />}
                  <AvatarFallback className="bg-muted text-[10px] text-muted-foreground">
                    {initials(m.full_name)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {assignees.length > 3 && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-card">
                  +{assignees.length - 3}
                </div>
              )}
              {assignees.length === 0 && (
                <div className="h-6 w-6 rounded-full border border-dashed border-border" aria-hidden />
              )}
            </div>

            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              {dueDate && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {dateShort(dueDate)}
                </span>
              )}
              {commentCount > 0 && (
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {commentCount}
                </span>
              )}
              {attachmentCount > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Paperclip className="h-3.5 w-3.5" />
                  {attachmentCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  },
);
OrdoTaskCard.displayName = "OrdoTaskCard";
