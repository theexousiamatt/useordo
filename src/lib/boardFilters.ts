import { localDateKey } from "./format";
import { matchesTaskDueDate, type TaskDueFilter } from "./taskDueDates";
import type { TaskRow } from "@/hooks/useProjectData";
import type { TaskStatus } from "@/lib/projectConstants";

export interface BoardFilters {
  query: string;
  assignee: string;
  status: TaskStatus | "all";
  label: string;
  due: TaskDueFilter;
  dueFrom: string;
  dueTo: string;
}

export const EMPTY_BOARD_FILTERS: BoardFilters = {
  query: "", assignee: "all", status: "all", label: "all", due: "all", dueFrom: "", dueTo: "",
};

export function filterBoardTasks(
  tasks: TaskRow[],
  filters: BoardFilters,
  assignees: Map<string, string[]> | undefined,
  labels: Map<string, string[]> | undefined,
  today = localDateKey(),
): TaskRow[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return tasks.filter((task) => {
    if (query && !`${task.title} ${task.description ?? ""}`.toLocaleLowerCase().includes(query)) return false;
    if (filters.status !== "all" && task.status !== filters.status) return false;
    if (filters.assignee !== "all") {
      const ids = assignees?.get(task.id) ?? (task.assignee_id ? [task.assignee_id] : []);
      if (filters.assignee === "unassigned" ? ids.length > 0 : !ids.includes(filters.assignee)) return false;
    }
    if (filters.label !== "all" && !(labels?.get(task.id) ?? []).includes(filters.label)) return false;
    return matchesTaskDueDate(task, filters.due, { from: filters.dueFrom, to: filters.dueTo }, today);
  });
}

export function hasBoardFilters(filters: BoardFilters): boolean {
  return !!filters.query.trim() || filters.assignee !== "all" || filters.status !== "all" || filters.label !== "all" || filters.due !== "all";
}
