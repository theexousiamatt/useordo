import { differenceInCalendarDays, isValid, parseISO } from "date-fns";

/** The dashboard reads only projects already visible to the signed-in workspace member. */
export interface StudioProject {
  id: string;
  name: string;
  status: string;
  health: string;
  due_date: string | null;
  updated_at: string;
  archived_at: string | null;
}

export interface StudioTask {
  id: string;
  project_id: string;
  title: string;
  due_date: string | null;
  completed_at: string | null;
  archived_at: string | null;
}

export interface StudioMilestone {
  id: string;
  project_id: string;
  title: string;
  due_date: string | null;
  completed: boolean;
}

export interface StudioDeliverable {
  id: string;
  project_id: string;
  title: string;
  status: string;
  requires_approval: boolean;
  created_at: string;
}

export interface StudioActivity {
  id: string;
  project_id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface StudioDashboardData {
  projects: StudioProject[];
  tasks: StudioTask[];
  milestones: StudioMilestone[];
  deliverables: StudioDeliverable[];
  activity: StudioActivity[];
}

export type DeadlineKind = "task" | "milestone" | "project";
export interface StudioDeadline {
  id: string;
  project_id: string;
  project_name: string;
  title: string;
  kind: DeadlineKind;
  due_date: string;
  days_until: number;
}

function daysUntil(date: string | null, now: Date): number | null {
  if (!date) return null;
  const parsed = parseISO(date);
  if (!isValid(parsed)) return null;
  return differenceInCalendarDays(parsed, now);
}

export function activityDescription(activity: StudioActivity): string {
  const title = activity.metadata?.title;
  const suffix = typeof title === "string" && title.trim() ? ": " + title.trim() : "";
  const labels: Record<string, string> = {
    task_created: "Task created",
    task_status_changed: "Task moved",
    task_completed: "Task completed",
    milestone_created: "Milestone added",
    milestone_status_changed: "Milestone updated",
    deliverable_created: "Deliverable created",
    deliverable_status_changed: "Deliverable updated",
    comment_added: "Comment added",
  };
  return (labels[activity.action] ?? activity.action.replace(/[._]/g, " ")) + suffix;
}

/**
 * Stage names never determine completion. Only tasks.completed_at contributes
 * to completed tasks or project progress; an empty project has 0% progress.
 */
export function buildStudioOverview(data: StudioDashboardData, now = new Date()) {
  const projects = data.projects.filter((p) => !p.archived_at && p.status !== "archived");
  const byId = new Map(projects.map((p) => [p.id, p]));
  const tasks = data.tasks.filter((task) => byId.has(task.project_id) && !task.archived_at);
  const activeProjects = projects.filter((p) => p.status === "active");
  const openTasks = tasks.filter((task) => !task.completed_at);
  const deadlines: StudioDeadline[] = [];

  const addDeadline = (
    id: string, projectId: string, title: string, kind: DeadlineKind, dueDate: string | null,
  ) => {
    const project = byId.get(projectId);
    const days = daysUntil(dueDate, now);
    if (!project || days === null || !dueDate) return;
    deadlines.push({
      id, project_id: projectId, project_name: project.name,
      title, kind, due_date: dueDate, days_until: days,
    });
  };

  for (const task of openTasks) {
    const project = byId.get(task.project_id);
    if (project?.status !== "completed") {
      addDeadline(task.id, task.project_id, task.title, "task", task.due_date);
    }
  }
  for (const milestone of data.milestones) {
    if (!milestone.completed && byId.get(milestone.project_id)?.status !== "completed") {
      addDeadline(milestone.id, milestone.project_id, milestone.title, "milestone", milestone.due_date);
    }
  }
  for (const project of projects) {
    if (project.status !== "completed") {
      addDeadline(project.id, project.id, project.name, "project", project.due_date);
    }
  }

  const byDueDate = (a: StudioDeadline, b: StudioDeadline) =>
    a.days_until - b.days_until || a.title.localeCompare(b.title);
  const overdueTasks = deadlines.filter((d) => d.kind === "task" && d.days_until < 0).sort(byDueDate);
  const upcoming = deadlines.filter((d) => d.days_until >= 0 && d.days_until <= 14).sort(byDueDate);
  const pendingApprovals = data.deliverables
    .filter((d) => byId.has(d.project_id) && d.requires_approval && d.status === "submitted")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const recentActivity = data.activity
    .filter((a) => byId.has(a.project_id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 8);

  const taskTotals = new Map<string, { total: number; completed: number }>();
  for (const task of tasks) {
    const entry = taskTotals.get(task.project_id) ?? { total: 0, completed: 0 };
    entry.total += 1;
    if (task.completed_at) entry.completed += 1;
    taskTotals.set(task.project_id, entry);
  }

  const projectProgress = (projectId: string) => {
    const entry = taskTotals.get(projectId);
    return {
      total: entry?.total ?? 0,
      completed: entry?.completed ?? 0,
      percent: entry?.total ? Math.round(entry.completed / entry.total * 100) : 0,
    };
  };

  const healthOrder: Record<string, number> = { blocked: 0, at_risk: 1, on_track: 2 };
  const featuredProjects = [...activeProjects].sort((a, b) =>
    (healthOrder[a.health] ?? 3) - (healthOrder[b.health] ?? 3) ||
    a.name.localeCompare(b.name)
  );

  return {
    projects,
    activeProjects,
    featuredProjects,
    openTasks,
    overdueTasks,
    upcoming,
    pendingApprovals,
    recentActivity,
    projectProgress,
    projectName: (projectId: string) => byId.get(projectId)?.name ?? "Project",
  };
}
