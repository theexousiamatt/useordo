import { describe,expect,it } from "vitest";
import { moveTaskWithinStages,stageForTaskId,stageInsertBefore,type BoardStage } from "./legacyStageBoard";

const stages:BoardStage[]=[
  {id:"backlog",category:"backlog",position:0},
  {id:"todo-1",category:"todo",position:1},
  {id:"todo-2",category:"todo",position:2},
  {id:"done",category:"done",position:3},
];
const tasks=[
  {id:"a",status:"todo" as const,stage_id:"todo-1",position:0,archived_at:null},
  {id:"b",status:"todo" as const,stage_id:"todo-1",position:1,archived_at:null},
  {id:"c",status:"todo" as const,stage_id:"todo-2",position:0,archived_at:null},
];

describe("legacy Ordo customizable stages",()=>{
  it("maps pre-migration tasks to the first matching reporting category",()=>{
    expect(stageForTaskId({id:"old",status:"todo",position:0,stage_id:null},stages)).toBe("todo-1");
    expect(stageForTaskId({id:"old",status:"review",position:0,stage_id:null},stages)).toBe("backlog");
  });

  it("places dragged stages after the target when moving right",()=>{
    expect(stageInsertBefore(stages,"todo-1","todo-2")).toBe("done");
    expect(stageInsertBefore(stages,"done","todo-1")).toBe("todo-1");
    expect(stageInsertBefore(stages,"backlog","done")).toBeNull();
  });

  it("moves one task between stages that share a reporting status",()=>{
    const result=moveTaskWithinStages(tasks,stages,"a","todo-2");
    expect(result).not.toBeNull();
    expect(result!.next.find(task=>task.id==="a")).toMatchObject({stage_id:"todo-2",status:"todo"});
    expect(result!.updates.filter(task=>task.stage_id==="todo-1")).toHaveLength(1);
    expect(result!.updates.filter(task=>task.stage_id==="todo-2")).toHaveLength(2);
  });

  it("changes reporting category when a task is moved to a differently classified stage",()=>{
    const result=moveTaskWithinStages(tasks,stages,"a","done");
    expect(result!.next.find(task=>task.id==="a")).toMatchObject({stage_id:"done",status:"done",position:0});
    expect(result!.next.find(task=>task.id==="b")).toMatchObject({stage_id:"todo-1",position:0});
  });

  it("reorders inside a column without duplicating cards",()=>{
    const result=moveTaskWithinStages(tasks,stages,"a","b");
    const inStage=result!.next.filter(task=>task.stage_id==="todo-1").sort((a,b)=>a.position-b.position);
    expect(inStage.map(task=>task.id)).toEqual(["b","a"]);
    expect(new Set(result!.updates.map(task=>task.id)).size).toBe(2);
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
