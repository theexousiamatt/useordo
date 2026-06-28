export type ProjectStatus = "draft" | "active" | "on_hold" | "completed" | "archived";
export type ProjectHealth = "on_track" | "at_risk" | "blocked";
export type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done";
export type ProjectMemberRole = "owner" | "manager" | "member" | "client";
export type DeliverableStatus = "draft" | "submitted" | "approved" | "rejected";
export type MilestoneStatus = "pending" | "completed";

export const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "draft", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

export const PROJECT_STATUS_STYLES: Record<ProjectStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-primary/15 text-primary",
  on_hold: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  completed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  archived: "bg-muted text-muted-foreground",
};

export const HEALTH_STYLES: Record<ProjectHealth, string> = {
  on_track: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  at_risk: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  blocked: "bg-destructive/15 text-destructive",
};

export const HEALTH_LABELS: Record<ProjectHealth, string> = {
  on_track: "On track",
  at_risk: "At risk",
  blocked: "Blocked",
};

export const TASK_COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: "backlog", title: "Backlog" },
  { id: "todo", title: "To do" },
  { id: "in_progress", title: "In progress" },
  { id: "review", title: "Review" },
  { id: "done", title: "Done" },
];

export const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  high: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  critical: "bg-destructive/15 text-destructive",
};

export const DELIVERABLE_STATUS_STYLES: Record<DeliverableStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  approved: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  rejected: "bg-destructive/15 text-destructive",
};
