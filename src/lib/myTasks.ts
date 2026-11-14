import { differenceInCalendarDays, isValid, parseISO } from "date-fns";

export type TaskView = "today" | "upcoming" | "overdue" | "completed" | "all";
export type TaskAudience = "mine" | "team";

export interface FeedTask {
  id: string;
  project_id: string;
  title: string;
  due_date: string | null;
  completed_at: string | null;
  archived_at: string | null;
  assignee_id: string | null;
  stage_id: string | null;
  updated_at: string;
}
export interface TaskMembership {
  task_id: string;
  user_id: string;
}
export interface FeedProject {
  id: string;
  name: string;
  status: string;
  archived_at: string | null;
}

export function taskDueDays(date: string | null, now = new Date()): number | null {
  if (!date) return null;
  const parsed = parseISO(date);
  return isValid(parsed) ? differenceInCalendarDays(parsed, now) : null;
}

/** Task completion is determined only by completed_at, never by stage name. */
export function taskView(task: FeedTask, view: TaskView, now = new Date()): boolean {
  if (task.archived_at) return false;
  const completed = Boolean(task.completed_at);
  if (view === "completed") return completed;
  if (completed) return false;
  const days = taskDueDays(task.due_date, now);
  if (view === "overdue") return days !== null && days < 0;
  if (view === "today") return days !== null && days <= 0;
  if (view === "upcoming") return days !== null && days > 0 && days <= 14;
  return true;
}

export function buildTaskFeed(
  tasks: FeedTask[], projects: FeedProject[], memberships: TaskMembership[],
  userId: string, audience: TaskAudience, view: TaskView, search = "", now = new Date(),
) {
  const visible = new Map(
    projects.filter(p => !p.archived_at && p.status !== "archived").map(p => [p.id, p]),
  );
  const mine = new Set(memberships.filter(m => m.user_id === userId).map(m => m.task_id));
  const query = search.trim().toLowerCase();
  const matches = tasks.filter(task =>
    visible.has(task.project_id) &&
    (audience === "team" || mine.has(task.id) || task.assignee_id === userId) &&
    taskView(task, view, now) &&
    (!query || task.title.toLowerCase().includes(query) ||
      visible.get(task.project_id)!.name.toLowerCase().includes(query)));
  matches.sort((a,b) => {
    const aDays = taskDueDays(a.due_date, now);
    const bDays = taskDueDays(b.due_date, now);
    if (aDays === null && bDays !== null) return 1;
    if (bDays === null && aDays !== null) return -1;
    if (aDays !== null && bDays !== null && aDays !== bDays) return aDays - bDays;
    return b.updated_at.localeCompare(a.updated_at) || a.title.localeCompare(b.title);
  });
  return matches;
}
