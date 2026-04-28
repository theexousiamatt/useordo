import { cn } from "@/lib/utils";

export type ProjectStatus = "on_track" | "at_risk" | "blocked" | "done" | "planning";

const map: Record<ProjectStatus, { label: string; cls: string }> = {
  on_track: { label: "On track", cls: "bg-success/15 text-success border-success/30" },
  at_risk: { label: "At risk", cls: "bg-warning/15 text-warning border-warning/30" },
  blocked: { label: "Blocked", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  done: { label: "Done", cls: "bg-primary/15 text-primary border-primary/30" },
  planning: { label: "Planning", cls: "bg-muted text-muted-foreground border-border" },
};

export function StatusBadge({ status, className }: { status: ProjectStatus; className?: string }) {
  const s = map[status] ?? map.planning;
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border", s.cls, className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current mr-1.5" />
      {s.label}
    </span>
  );
}

const taskStatusMap: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-muted text-muted-foreground border-border" },
  in_progress: { label: "In progress", cls: "bg-primary/15 text-primary border-primary/30" },
  awaiting_approval: { label: "Awaiting approval", cls: "bg-warning/15 text-warning border-warning/30" },
  approved: { label: "Approved", cls: "bg-success/15 text-success border-success/30" },
  changes_requested: { label: "Changes requested", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  done: { label: "Done", cls: "bg-success/15 text-success border-success/30" },
};

export function TaskStatusBadge({ status, className }: { status: string; className?: string }) {
  const s = taskStatusMap[status] ?? taskStatusMap.pending;
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border", s.cls, className)}>
      {s.label}
    </span>
  );
}
