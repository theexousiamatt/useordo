import { forwardRef, type KeyboardEvent, type ReactNode } from "react";
import {
  Calendar,
  MessageSquare,
  Paperclip,
  GripVertical,
  AlertTriangle,
  Circle,
  CircleDot,
  Clock,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { dateShort, initials } from "@/lib/format";
import { LabelBadge } from "@/components/ordo/LabelBadge";
import type { TaskStatus } from "@/lib/projectConstants";
import { STAGE_THEME_STYLES, resolveStageTheme, type StageTheme } from "@/lib/stageThemes";
import type { ProjectMemberProfile } from "@/hooks/useProjects";

/** Task status badges retain semantics regardless of the selected board theme. */
interface StatusPresentation { label: string; pill: string; icon: string; Icon: typeof Circle; }
const STATUS_THEME: Record<TaskStatus, StatusPresentation> = {
  backlog: { label: "Backlog", pill: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-100", icon: "text-slate-400", Icon: Circle },
  todo: { label: "To do", pill: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-100", icon: "text-slate-500", Icon: CircleDot },
  in_progress: { label: "In progress", pill: "bg-[hsl(178,100%,8%)] text-white", icon: "text-white", Icon: Clock },
  review: { label: "Review", pill: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200", icon: "text-sky-500", Icon: Eye },
  done: { label: "Done", pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200", icon: "text-emerald-500", Icon: CheckCircle2 },
};

export interface TaskLabelChip {
  id: string;
  name: string;
  color: string;
}

/** Sensible default fill when a task carries no explicit progress. */
const DEFAULT_PROGRESS: Record<TaskStatus, number> = {
  backlog: 0,
  todo: 0,
  in_progress: 50,
  review: 80,
  done: 100,
};

export interface OrdoTaskCardProps {
  title: string;
  status: TaskStatus;
  description?: string | null;
  dueDate?: string | null;
  labels?: TaskLabelChip[];
  /** 0–100. Falls back to a status-derived default. */
  progress?: number;
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
      status,
      description,
      dueDate,
      labels = [],
      progress,
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
    const theme = STATUS_THEME[status];
    const tokens = STAGE_THEME_STYLES[resolveStageTheme(stageTheme)];
    const isBlocked = blocked ?? false;
    const iconColor = isBlocked ? "text-orange-600" : theme.icon;
    const StatusIcon = isBlocked ? AlertTriangle : theme.Icon;
    const pct = Math.max(0, Math.min(100, progress ?? DEFAULT_PROGRESS[status]));


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
          {/* Header: status pill */}
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11px] font-semibold",
                theme.pill,
              )}
            >
              <StatusIcon className={cn("h-3 w-3", theme.pill.includes("text-white") ? "" : iconColor)} />
              {isBlocked ? "Blocked" : (stageName ?? theme.label)}
            </span>
            {dragHandleProps && (
              <button
                {...dragHandleProps}
                className="cursor-grab touch-none rounded-md p-0.5 text-muted-foreground/40 opacity-0 transition-opacity hover:text-muted-foreground group-hover:opacity-100"
                aria-label="Drag task"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-4 w-4" />
              </button>
            )}
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
            {labels.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {labels.map((label) => (
                  <LabelBadge key={label.id} name={label.name} color={label.color} size="sm" />
                ))}
              </div>
            )}
          </div>

          {/* Progress */}
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
              <span>Progress</span>
              <span className="tabular-nums text-foreground">{pct}%</span>
            </div>
            <div className={cn("h-1.5 w-full overflow-hidden rounded-pill", tokens.track)}>
              <div
                className={cn("h-full rounded-pill transition-all", tokens.bar)}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

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

/** Per-column header theming exported for board composition. */
export const COLUMN_THEME: Record<TaskStatus, { dot: string; header: string }> = {
  backlog: { dot: "bg-slate-400", header: "text-slate-600" },
  todo: { dot: "bg-slate-500", header: "text-slate-600" },
  in_progress: { dot: "bg-[hsl(178,100%,8%)]", header: "text-[hsl(178,100%,8%)]" },
  review: { dot: "bg-sky-500", header: "text-sky-700" },
  done: { dot: "bg-emerald-500", header: "text-emerald-700" },
};
