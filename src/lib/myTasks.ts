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

export type WorkView = "today" | "upcoming" | "overdue" | "completed" | "unscheduled";

export function dueDays(date: string | null, now = new Date()): number | null {
  if (!date) return null;
  const parsed = parseISO(date);
  return isValid(parsed) ? differenceInCalendarDays(parsed, now) : null;
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
) {
  const filtered = tasks.filter((task) => {
    if (task.archived_at) return false;
    if (mineOnly && (!userId || !(
      task.assignee_id === userId || (assignees.get(task.id) ?? []).includes(userId)
    ))) return false;
    const kind = workViewFor(task, now);
    return kind === view || (view === "today" && kind === "overdue");
  });
  return [...filtered].sort((a, b) => {
    const aDays = dueDays(a.due_date, now);
    const bDays = dueDays(b.due_date, now);
    return (aDays ?? Infinity) - (bDays ?? Infinity) || a.position - b.position || a.title.localeCompare(b.title);
  });
}
