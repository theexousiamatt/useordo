import { describe, expect, it } from "vitest";
import { computeProjectCompletion, isTaskCompleted, requiresChecklistCompletionConfirmation } from "./taskCompletion";
import type { TaskRow } from "@/hooks/useProjectData";

const task = (id:string, stage_id:string, completed_at: string | null = null): TaskRow => ({
  id, stage_id, completed_at, project_id: "p", workspace_id: "w", title: id,
  description: null, status: stage_id === "done" ? "done" : "todo",
  position: 0, assignee_id: null, created_by: null, due_date: null,
  archived_at: null, created_at: "", updated_at: "",
});
const finished = "2026-11-14T09:00:00Z";

describe("independent completion with fully customizable stages", () => {
  it("does not complete tasks placed in a stage called Done or with legacy status done", () => {
    expect(isTaskCompleted(task("t", "done"))).toBe(false);
    expect(isTaskCompleted(task("t", "anything", finished))).toBe(true);
  });

  it("does not change task completion when a task is moved between stages", () => {
    const original = task("t", "research", finished);
    expect(isTaskCompleted({...original,stage_id:"done",status:"done"})).toBe(true);
    expect(isTaskCompleted({...original,stage_id:"backlog"})).toBe(true);
    expect(isTaskCompleted(task("u", "done"))).toBe(false);
  });

  it("calculates project progress exclusively from tasks explicitly marked complete", () => {
    expect(computeProjectCompletion([task("a","done"),task("b","research",finished),task("c","review",finished)]))
      .toEqual({ total:3, completed:2, percent:67 });
    expect(computeProjectCompletion([])).toEqual({total:0,completed:0,percent:0});
  });

  it("excludes archived tasks from project progress", () => {
    const archived = {...task("a","done",finished),archived_at:finished};
    expect(computeProjectCompletion([archived,task("b","review")]))
      .toEqual({total:1,completed:0,percent:0});
  });

  it("warns only when explicitly finishing a task with an incomplete checklist", () => {
    expect(requiresChecklistCompletionConfirmation(task("a","done"),{total:3,completed:1})).toBe(true);
    expect(requiresChecklistCompletionConfirmation(task("a","done"),{total:3,completed:3})).toBe(false);
    expect(requiresChecklistCompletionConfirmation(task("a","done"),undefined)).toBe(false);
    expect(requiresChecklistCompletionConfirmation(task("a","design",finished),{total:3,completed:1})).toBe(false);
  });
});
