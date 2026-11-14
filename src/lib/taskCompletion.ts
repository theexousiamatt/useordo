import type { ProjectStage } from "@/hooks/useProjectStages";
import type { TaskRow } from "@/hooks/useProjectData";
import { stageForTaskId } from "@/lib/legacyStageBoard";

export type CompletionStage = Pick<ProjectStage, "id" | "category" | "position" | "name" | "is_completion">;

export function isCompletionStage(stage: Pick<CompletionStage, "is_completion" | "category"> | null | undefined): boolean {
  return stage?.is_completion ?? stage?.category === "done";
}

export function findTaskStage(task: TaskRow, stages: readonly CompletionStage[]): CompletionStage | undefined {
  const id = stageForTaskId(task, stages);
  return stages.find(stage => stage.id === id);
}

export function isTaskCompleted(task: TaskRow, stages: readonly CompletionStage[]): boolean {
  const stage = findTaskStage(task, stages);
  return stage ? isCompletionStage(stage) : !task.stage_id && task.status === "done";
}

/** Project progress counts completed TASKS; checklist percentages are deliberately separate. */
export function computeProjectCompletion(tasks: readonly TaskRow[], stages: readonly CompletionStage[]) {
  const active = tasks.filter(task => !task.archived_at);
  const total = active.length;
  const completed = active.filter(task => isTaskCompleted(task, stages)).length;
  return { total, completed, percent: total === 0 ? 0 : Math.round(completed / total * 100) };
}

export function requiresChecklistCompletionConfirmation(
  task: TaskRow,
  destination: CompletionStage,
  stages: readonly CompletionStage[],
  subtasks: { total: number; completed: number } | undefined,
): boolean {
  return isCompletionStage(destination) && !isTaskCompleted(task, stages) &&
    Boolean(subtasks && subtasks.total > subtasks.completed);
}
