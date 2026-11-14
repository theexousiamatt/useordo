import type { TaskRow } from "@/hooks/useProjectData";

/** Task completion is an explicit user action. It never depends on a column. */
export function isTaskCompleted(task: Pick<TaskRow, "completed_at">): boolean {
  return Boolean(task.completed_at);
}

/** Checklist percentage and stage movement never change project progress. */
export function computeProjectCompletion(tasks: readonly TaskRow[]) {
  const active = tasks.filter(task => !task.archived_at);
  const total = active.length;
  const completed = active.filter(isTaskCompleted).length;
  return { total, completed, percent: total === 0 ? 0 : Math.round(completed / total * 100) };
}

/** Only an explicit "Mark complete" action asks about unchecked checklist items. */
export function requiresChecklistCompletionConfirmation(
  task: Pick<TaskRow, "completed_at">,
  subtasks: { total: number; completed: number } | undefined,
): boolean {
  return !isTaskCompleted(task) &&
    Boolean(subtasks && subtasks.total > subtasks.completed);
}
