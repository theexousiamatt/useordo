import { describe, expect, it } from "vitest";
import { computeProjectCompletion, isCompletionStage, isTaskCompleted, requiresChecklistCompletionConfirmation } from "./taskCompletion";
import type { TaskRow } from "@/hooks/useProjectData";
import type { CompletionStage } from "./taskCompletion";

const stages: CompletionStage[] = [
  { id: "backlog", name: "Backlog", category: "backlog", position: 0, is_completion: false },
  { id: "approved", name: "Client approved", category: "todo", position: 1, is_completion: true },
  { id: "done", name: "Done", category: "done", position: 2, is_completion: true },
];
const task = (id: string, stage_id: string): TaskRow => ({
  id, stage_id, project_id: "p", workspace_id: "w", title: id, description: null,
  status: stage_id === "done" ? "done" : "todo", position: 0, assignee_id: null,
  created_by: null, due_date: null, archived_at: null, created_at: "", updated_at: "",
});

describe("consistent project and task completion", () => {
  it("recognizes explicitly configured completion stages without relying on their names", () => {
    expect(isCompletionStage(stages[1])).toBe(true);
    expect(isTaskCompleted(task("a", "approved"), stages)).toBe(true);
    expect(isTaskCompleted(task("b", "backlog"), stages)).toBe(false);
  });
  it("calculates project progress from finished tasks rather than checklists", () => {
    expect(computeProjectCompletion([task("a", "approved"), task("b", "backlog"), task("c", "done")], stages))
      .toEqual({ total: 3, completed: 2, percent: 67 });
    expect(computeProjectCompletion([], stages)).toEqual({ total: 0, completed: 0, percent: 0 });
  });
  it("omits archived tasks", () => {
    const archived = { ...task("a", "backlog"), archived_at: "2026-11-14" };
    expect(computeProjectCompletion([archived, task("b", "approved")], stages))
      .toEqual({ total: 1, completed: 1, percent: 100 });
  });
  it("warns only on newly completing tasks with unfinished checklist items", () => {
    const destination = stages[1];
    const before = task("a", "backlog");
    expect(requiresChecklistCompletionConfirmation(before, destination, stages, { total: 3, completed: 1 })).toBe(true);
    expect(requiresChecklistCompletionConfirmation(before, destination, stages, { total: 3, completed: 3 })).toBe(false);
    expect(requiresChecklistCompletionConfirmation(task("a", "done"), destination, stages, { total: 3, completed: 1 })).toBe(false);
    expect(requiresChecklistCompletionConfirmation(before, stages[0], stages, { total: 3, completed: 1 })).toBe(false);
  });
});
