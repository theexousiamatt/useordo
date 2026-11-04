import type { TaskRow } from "@/hooks/useProjectData";
import { TASK_COLUMNS, type TaskStatus } from "@/lib/projectConstants";

export type TaskPosition = Pick<TaskRow, "id" | "status" | "position"> & { expected_updated_at: string };
export interface BoardMoveResult { tasks: TaskRow[]; updates: TaskPosition[] }

export const compareBoardTasks = (a: TaskRow, b: TaskRow) =>
  a.position - b.position || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);

/** The same column-major order people see on the board, including filtered views. */
export function boardReadingOrder(tasks: TaskRow[]): TaskRow[] {
  return TASK_COLUMNS.flatMap((column) => tasks.filter((task) => task.status === column.id).sort(compareBoardTasks));
}

/** Append selected tasks without changing the relative order of any other work. */
export function moveBoardTasksToStatus(tasks: TaskRow[], ids: string[], status: TaskStatus): BoardMoveResult | null {
  const selected = new Set(ids);
  const moving = boardReadingOrder(tasks).filter((task) => selected.has(task.id) && task.status !== status);
  if (!moving.length) return null;
  const movingIds = new Set(moving.map((task) => task.id));
  const affected = new Set([...moving.map((task) => task.status), status]);
  const changes = new Map<string, TaskRow>();
  const updates: TaskPosition[] = [];
  for (const column of affected) {
    const columnTasks = tasks.filter((task) => task.status === column && !movingIds.has(task.id)).sort(compareBoardTasks);
    if (column === status) columnTasks.push(...moving);
    columnTasks.forEach((task, position) => {
      changes.set(task.id, { ...task, status: column, position });
      updates.push({ id: task.id, status: column, position, expected_updated_at: task.updated_at });
    });
  }
  return { tasks: tasks.map((task) => changes.get(task.id) ?? task), updates };
}

/** Restore relative order using valid contiguous positions and current metadata. */
export function restoreBoardMove(before: TaskRow[], latest: TaskRow[], moved: BoardMoveResult): BoardMoveResult | null {
  const ids = new Set(moved.updates.map((entry) => entry.id));
  const currentById = new Map(latest.map((task) => [task.id, task]));
  if (moved.updates.some((entry) => {
    const current = currentById.get(entry.id);
    return !current || current.status !== entry.status || current.position !== entry.position;
  })) return null;
  const affected = new Set(before.filter((task) => ids.has(task.id)).map((task) => task.status));
  moved.updates.forEach((entry) => affected.add(entry.status));
  if (latest.some((task) => affected.has(task.status) && !ids.has(task.id))) return null;
  const updates: TaskPosition[] = [];
  for (const column of affected) {
    before.filter((task) => ids.has(task.id) && task.status === column).sort(compareBoardTasks).forEach((task, position) => {
      updates.push({ id: task.id, status: column, position, expected_updated_at: currentById.get(task.id)!.updated_at });
    });
  }
  const byId = new Map(updates.map((entry) => [entry.id, entry]));
  return {
    tasks: latest.map((task) => {
      const position = byId.get(task.id);
      return position ? { ...task, status: position.status, position: position.position } : task;
    }),
    updates,
  };
}

/** Build complete, contiguous positions for both affected columns. */
export function moveBoardTask(
  tasks: TaskRow[],
  activeId: string,
  overId: string,
  after = false,
): BoardMoveResult | null {
  const active = tasks.find((task) => task.id === activeId);
  const target = tasks.find((task) => task.id === overId);
  const status = target?.status ?? (TASK_COLUMNS.some((column) => column.id === overId) ? overId as TaskStatus : null);
  if (!active || !status || activeId === overId) return null;

  const ordered = (column: TaskStatus) => tasks
    .filter((task) => task.status === column && task.id !== activeId)
    .sort(compareBoardTasks);
  const destination = ordered(status);
  const targetIndex = target ? destination.findIndex((task) => task.id === target.id) : destination.length;
  destination.splice(targetIndex < 0 ? destination.length : targetIndex + Number(after), 0, { ...active, status });

  const affected = active.status === status ? [status] : [active.status, status];
  const changes = new Map<string, TaskRow>();
  const updates: TaskPosition[] = [];
  for (const column of affected) {
    const columnTasks = column === status ? destination : ordered(column);
    columnTasks.forEach((task, position) => {
      const next = { ...task, status: column, position };
      changes.set(task.id, next);
      updates.push({ id: task.id, status: column, position, expected_updated_at: tasks.find((original) => original.id === task.id)!.updated_at });
    });
  }
  const next = tasks.map((task) => changes.get(task.id) ?? task);
  if (next.every((task, index) => task.id === tasks[index].id && task.status === tasks[index].status && task.position === tasks[index].position)) return null;
  return { tasks: next, updates };
}
