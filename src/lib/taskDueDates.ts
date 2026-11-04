import { addDays, parseISO, startOfWeek } from "date-fns";
import { localDateKey } from "./format";

export type TaskDueFilter = "all" | "overdue" | "today" | "this-week" | "upcoming" | "none" | "custom";

export interface TaskDueRange {
  from?: string;
  to?: string;
}

/** Task deadlines are date-only values, so weeks follow the local calendar. */
export function taskWeekRange(today = localDateKey()): { from: string; to: string } {
  const monday = startOfWeek(parseISO(today), { weekStartsOn: 1 });
  return { from: localDateKey(monday), to: localDateKey(addDays(monday, 6)) };
}

export function matchesTaskDueDate(
  task: { due_date: string | null; status: string },
  filter: TaskDueFilter,
  range: TaskDueRange = {},
  today = localDateKey(),
): boolean {
  if (filter === "all") return true;
  if (filter === "none") return !task.due_date;
  if (task.status === "done") return false;

  if (filter === "custom") {
    if (range.from && range.to && range.from > range.to) return false;
    if (!range.from && !range.to) return true;
    if (!task.due_date) return false;
    return (!range.from || task.due_date >= range.from) && (!range.to || task.due_date <= range.to);
  }

  if (!task.due_date) return false;
  if (filter === "overdue") return task.due_date < today;
  if (filter === "today") return task.due_date === today;
  if (filter === "upcoming") return task.due_date >= today;

  const week = taskWeekRange(today);
  return task.due_date >= week.from && task.due_date <= week.to;
}
