import { cn } from "@/lib/utils";
import { dateShort } from "@/lib/format";
import type { ClientProject, ProjectStatus } from "@/hooks/useClientDashboard";

const statusConfig: Record<ProjectStatus, { label: string; className: string }> = {
  on_track: {
    label: "On track",
    className: "bg-[hsl(var(--badge-green-bg))] text-[hsl(var(--badge-green-text))]",
  },
  at_risk: {
    label: "Needs feedback",
    className: "bg-[hsl(var(--badge-orange-bg))] text-[hsl(var(--badge-orange-text))]",
  },
  blocked: {
    label: "Waiting on client",
    className: "bg-secondary text-muted-foreground",
  },
  planning: {
    label: "Planning",
    className: "bg-secondary text-muted-foreground",
  },
  done: {
    label: "Completed",
    className: "bg-[hsl(var(--badge-green-bg))] text-[hsl(var(--badge-green-text))]",
  },
};

interface ProjectOverviewCardProps {
  project: ClientProject;
  onOpen?: (id: string) => void;
}

export function ProjectOverviewCard({ project, onOpen }: ProjectOverviewCardProps) {
  const status = statusConfig[project.status] ?? statusConfig.planning;
  const progress = Math.max(0, Math.min(100, project.progress ?? 0));

  return (
    <button
      type="button"
      onClick={() => onOpen?.(project.id)}
      className="flex flex-col gap-4 rounded-card bg-card p-6 text-left shadow-panel transition-all hover:-translate-y-0.5 hover:shadow-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold">{project.name}</h3>
          {project.description && (
            <p className="truncate text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>
        <span className={cn("shrink-0 rounded-pill px-2.5 py-1 text-xs font-semibold", status.className)}>
          {status.label}
        </span>
      </div>

      <div className="mt-auto">
        <div className="mb-2 flex items-center justify-between text-sm font-medium">
          <span className="truncate text-muted-foreground">{project.phase ?? "In progress"}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-background">
          <div
            className="h-full rounded-full bg-foreground transition-all"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${project.name} progress`}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>Current phase</span>
        <span>{project.due_date ? `Due ${dateShort(project.due_date)}` : "No due date"}</span>
      </div>
    </button>
  );
}
