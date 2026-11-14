import { describe,expect,it } from "vitest";
import { moveTaskWithinStages,stageForTaskId,stageInsertBefore,stageRemovalDestination,resolveStageRemovalDestination,hasStageTasks,type BoardStage } from "./legacyStageBoard";

const stages:BoardStage[]=[
  {id:"backlog",position:0},
  {id:"todo-1",position:1},
  {id:"todo-2",position:2},
  {id:"done",position:3},
];
const tasks=[
  {id:"a",status:"todo" as const,stage_id:"todo-1",position:0,archived_at:null},
  {id:"b",status:"todo" as const,stage_id:"todo-1",position:1,archived_at:null},
  {id:"c",status:"todo" as const,stage_id:"todo-2",position:0,archived_at:null},
];

describe("legacy Ordo customizable stages",()=>{
  it("places unassigned legacy tasks into the first stage regardless of status or its name",()=>{
    expect(stageForTaskId({id:"old",position:0,stage_id:null},stages)).toBe("backlog");
    expect(stageForTaskId({id:"old",position:0,stage_id:"done"},stages)).toBe("done");
  });

  it("places dragged stages after the target when moving right",()=>{
    expect(stageInsertBefore(stages,"todo-1","todo-2")).toBe("done");
    expect(stageInsertBefore(stages,"done","todo-1")).toBe("todo-1");
    expect(stageInsertBefore(stages,"backlog","done")).toBeNull();
  });

  it("lets a five-stage project be reduced to two without requiring any category",()=>{
    const two=[stages[0],stages[3]];
    expect(stageRemovalDestination(stages,"todo-1")).toBe("todo-2");
    expect(stageRemovalDestination(stages,"done")).toBe("todo-2");
    expect(stageRemovalDestination(two,"backlog")).toBe("done");
    expect(stageRemovalDestination(two,"done")).toBe("backlog");
  });

  it("never proposes deleting the final stage or an unknown stage",()=>{
    expect(stageRemovalDestination([stages[0]],"backlog")).toBeNull();
    expect(stageRemovalDestination([], "backlog")).toBeNull();
    expect(stageRemovalDestination(stages,"missing")).toBeNull();
  });

  it("moves one task between arbitrary user-defined stages",()=>{
    const result=moveTaskWithinStages(tasks,stages,"a","todo-2");
    expect(result).not.toBeNull();
    expect(result!.next.find(task=>task.id==="a")).toMatchObject({stage_id:"todo-2",status:"todo"});
    expect(result!.updates.filter(task=>task.stage_id==="todo-1")).toHaveLength(1);
    expect(result!.updates.filter(task=>task.stage_id==="todo-2")).toHaveLength(2);
  });

  it("never changes status or completion when moved to a stage named Done",()=>{
    const result=moveTaskWithinStages(tasks,stages,"a","done");
    expect(result!.next.find(task=>task.id==="a")).toMatchObject({stage_id:"done",status:"todo",position:0});
    expect(result!.next.find(task=>task.id==="b")).toMatchObject({stage_id:"todo-1",position:0});
    expect(result!.updates.some(update => "status" in update)).toBe(false);
  });

  it("reorders inside a column without duplicating cards",()=>{
    const result=moveTaskWithinStages(tasks,stages,"a","b");
    const inStage=result!.next.filter(task=>task.stage_id==="todo-1").sort((a,b)=>a.position-b.position);
    expect(inStage.map(task=>task.id)).toEqual(["b","a"]);
    expect(new Set(result!.updates.map(task=>task.id)).size).toBe(2);
  });

  it("shows transfer options only when a stage contains tasks",()=>{
    expect(hasStageTasks(0)).toBe(false);
    expect(hasStageTasks(null)).toBe(false);
    expect(hasStageTasks(undefined)).toBe(false);
    expect(hasStageTasks(1)).toBe(true);
    expect(hasStageTasks(3)).toBe(true);
  });

  it("uses a neighboring stage automatically when transfer selection is skipped",()=>{
    expect(resolveStageRemovalDestination(stages,"todo-1","")).toBe("todo-2");
    expect(resolveStageRemovalDestination(stages,"todo-1",undefined)).toBe("todo-2");
    expect(resolveStageRemovalDestination(stages,"todo-1","done")).toBe("done");
    expect(resolveStageRemovalDestination(stages,"todo-1","todo-1")).toBe("todo-2");
    expect(resolveStageRemovalDestination(stages,"todo-1","missing")).toBe("todo-2");
    expect(resolveStageRemovalDestination([stages[0]],"backlog","")).toBeNull();
  });

  it("does not move a task to itself or an unknown stage",()=>{
    expect(moveTaskWithinStages(tasks,stages,"a","a")).toBeNull();
    expect(moveTaskWithinStages(tasks,stages,"a","unknown")).toBeNull();
  });

  it("keeps other task properties when moving between stages",()=>{
    const copy=[{...tasks[0],archived_at:"2026-11-11T00:00:00Z"},...tasks.slice(1)];
    const result=moveTaskWithinStages(copy,stages,"a","done");
    expect(result!.next.find(task=>task.id==="a")?.archived_at).toBe("2026-11-11T00:00:00Z");
  });
});
