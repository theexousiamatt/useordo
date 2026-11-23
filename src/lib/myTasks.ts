import { differenceInCalendarDays, parseISO, isValid } from "date-fns";

export interface WorkTask {
  id: string;
  title: string;
  project_id: string;
  due_date: string | null;
  completed_at: string | null;
  archived_at: string | null;
  assignee_id: string | null;
  position: number;
}

export type WorkView = "today" | "upcoming" | "overdue" | "completed" | "unscheduled" | "open" | "week";

export function dueDays(date: string | null, now = new Date()): number | null {
  if (!date) return null;
  const parsed = parseISO(date);
  return isValid(parsed) ? differenceInCalendarDays(parsed, now) : null;
}

export function workRangeStart(value: string | null, fallback = new Date()): Date {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : fallback;
}

/**
 * Completion is exclusively controlled by completed_at.
 * "Today" also includes overdue tasks so nothing urgent gets missed.
 * Upcoming starts tomorrow; unscheduled tasks have no due date.
 */
export function workViewFor(task: WorkTask, now = new Date()): WorkView {
  if (task.completed_at) return "completed";
  const days = dueDays(task.due_date, now);
  if (days === null) return "unscheduled";
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  return "upcoming";
}

export function filterWorkTasks(
  tasks: readonly WorkTask[],
  assignees: ReadonlyMap<string, readonly string[]>,
  userId: string | null | undefined,
  view: WorkView,
  mineOnly = true,
  now = new Date(),
  completedProjects: ReadonlySet<string> = new Set(),
) {
  const filtered = tasks.filter((task) => {
    if (task.archived_at) return false;
    if (mineOnly && (!userId || !(
      task.assignee_id === userId || (assignees.get(task.id) ?? []).includes(userId)
    ))) return false;
    if (view === "open") return !task.completed_at;
    if (view === "overdue" && completedProjects.has(task.project_id)) return false;
    if (view === "week") {
      const days = dueDays(task.due_date, now);
      return !task.completed_at && !completedProjects.has(task.project_id) && days !== null && days >= 0 && days < 7;
    }
    const kind = workViewFor(task, now);
    return kind === view || (view === "today" && kind === "overdue");
  });
  return [...filtered].sort((a, b) => {
    const aDays = dueDays(a.due_date, now);
    const bDays = dueDays(b.due_date, now);
    return (aDays ?? Infinity) - (bDays ?? Infinity) || a.position - b.position || a.title.localeCompare(b.title);
  });
}
