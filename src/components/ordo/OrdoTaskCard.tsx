import { forwardRef, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import {
  Calendar,
  MessageSquare,
  Paperclip,
  GripVertical,
  AlertTriangle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { dateShort, initials, localDateKey } from "@/lib/format";
import { LabelBadge } from "@/components/ordo/LabelBadge";
import { TASK_COLUMNS, type TaskStatus } from "@/lib/projectConstants";
import type { ProjectMemberProfile } from "@/hooks/useProjects";

const STATUS_LABEL = Object.fromEntries(TASK_COLUMNS.map((column) => [column.id, column.title]));

export interface TaskLabelChip {
  id: string;
  name: string;
  color: string;
}

export interface OrdoTaskCardProps {
  title: string;
  status: TaskStatus;
  description?: string | null;
  dueDate?: string | null;
  labels?: TaskLabelChip[];
  /** Only show progress when backed by actual task data. */
  progress?: number;
  assignees?: ProjectMemberProfile[];
  commentCount?: number;
  attachmentCount?: number;
  /** Marks the card with the orange "blocked" treatment. */
  blocked?: boolean;
  interactive?: boolean;
  onOpen?: () => void;
  /** When provided, replaces the title with an inline editor. */
  titleEditor?: ReactNode;
  dragHandleProps?: Record<string, unknown>;
  actions?: ReactNode;
  titleButtonProps?: ButtonHTMLAttributes<HTMLButtonElement> & { "data-task-open"?: boolean };
  /** Render in the drag overlay (slight tilt + stronger shadow-sm). */
  overlay?: boolean;
  className?: string;
}

export const OrdoTaskCard = forwardRef<HTMLDivElement, OrdoTaskCardProps>(
  (
    {
      title,
      status,
      description,
      dueDate,
      labels = [],
      progress,
      assignees = [],
      commentCount = 0,
      attachmentCount = 0,
      blocked,
      interactive = true,
      onOpen,
      titleEditor,
      dragHandleProps,
      actions,
      titleButtonProps,
      overlay,
      className,
    },
    ref,
  ) => {
    const isBlocked = blocked ?? false;
    const pct = progress == null ? null : Math.max(0, Math.min(100, progress));
    const isOverdue = !!dueDate && dueDate < localDateKey() && status !== "done";


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
          "group rounded-[var(--board-card-radius)] border border-[hsl(var(--board-border))] bg-[hsl(var(--board-card))] p-4 shadow-[var(--board-card-shadow)] outline-hidden",
          interactive &&
            "cursor-pointer transition-[box-shadow,border-color] duration-150 hover:border-[hsl(var(--board-border-strong))] hover:shadow-[var(--board-card-hover-shadow)] focus-visible:ring-2 focus-visible:ring-ring",
          overlay && "shadow-[var(--board-card-hover-shadow)]",
          status === "done" && "opacity-80",
          className,
        )}
      >
        <div>
          <span className="sr-only">{STATUS_LABEL[status]}</span>
          <div className="flex items-start gap-1">
            <div className="min-w-0 flex-1 break-words text-[14px] font-semibold leading-snug text-foreground">
              {titleEditor ?? <h4>{(titleButtonProps ? <button {...titleButtonProps} type="button"
                className="block min-h-9 w-full rounded-sm text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                <span className="line-clamp-3">{title}</span>
              </button> : <span className="line-clamp-3">{title}</span>)}</h4>}
            </div>
            {dragHandleProps && <button {...dragHandleProps}
              className="flex h-9 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Drag task: ${title}`} onClick={(event) => event.stopPropagation()}>
              <GripVertical className="h-4 w-4" />
            </button>}
            {actions}
          </div>
          <div>
            {isBlocked && <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> Blocked</span>}
            {description && (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                {description}
              </p>
            )}
            {labels.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {labels.map((label) => (
                  <LabelBadge key={label.id} name={label.name} color={label.color} size="sm" />
                ))}
              </div>
            )}
          </div>

          {pct !== null && <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
              <span>Progress</span>
              <span className="tabular-nums text-foreground">{pct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-pill bg-black/5">
              <div
                className="h-full rounded-pill bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>}

          {/* Footer: assignees + meta */}
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
            <div className="flex shrink-0 -space-x-2">
              {assignees.slice(0, 3).map((m) => (
                <Avatar key={m.user_id} className="h-6 w-6 ring-2 ring-card" title={m.full_name ?? "Member"}>
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
              {assignees.length === 0 && <span className="text-xs text-muted-foreground">Unassigned</span>}
            </div>

            <div className="flex flex-wrap justify-end gap-2 text-[11px] text-muted-foreground">
              {dueDate && (
                <span className={cn("inline-flex items-center gap-1", isOverdue && "font-medium text-destructive")}>
                  <Calendar className="h-3.5 w-3.5" />
                  {isOverdue ? "Overdue · " : ""}{dateShort(dueDate)}
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

/** Per-column header theming exported for board composition. */
export const COLUMN_THEME: Record<TaskStatus, { dot: string; header: string }> = {
  backlog: { dot: "bg-slate-400", header: "text-slate-600" },
  todo: { dot: "bg-slate-500", header: "text-slate-600" },
  in_progress: { dot: "bg-[hsl(178,100%,8%)]", header: "text-[hsl(178,100%,8%)]" },
  review: { dot: "bg-sky-500", header: "text-sky-700" },
  done: { dot: "bg-emerald-500", header: "text-emerald-700" },
};
