import { describe, expect, it } from "vitest";
import { buildTaskFeed, taskView, type FeedTask, type FeedProject } from "./myTasks";

const now = new Date(2026,10,14,12);
const projects: FeedProject[] = [
  { id:"project-a",name:"Website redesign",status:"active",archived_at:null },
  { id:"archived-project",name:"Hidden",status:"archived",archived_at:"2026-11-12" },
];
const base: FeedTask = {
  id:"a",project_id:"project-a",title:"Build homepage",stage_id:"stage-done",
  assignee_id:"somebody-else",due_date:"2026-11-14",completed_at:null,
  archived_at:null,updated_at:"2026-11-14T10:00:00Z",
};
const tasks: FeedTask[] = [
  { ...base,id:"a" },
  { ...base,id:"b",title:"Fix keyboard",due_date:"2026-11-12" },
  { ...base,id:"c",title:"QA release",due_date:"2026-11-17" },
  { ...base,id:"d",title:"No due date",due_date:null },
  { ...base,id:"e",title:"Approved",due_date:"2026-11-08",completed_at:"2026-11-13T10:00:00Z" },
  { ...base,id:"f",title:"Old task",project_id:"archived-project" },
  { ...base,id:"g",title:"Archived task",archived_at:"2026-11-12" },
];

describe("My Tasks read model",()=>{
  it("includes assignments from the multi-assignee table, not just the legacy assignee column",()=>{
    const assigned=[{task_id:"a",user_id:"me"},{task_id:"b",user_id:"me"},{task_id:"c",user_id:"other"}];
    expect(buildTaskFeed(tasks,projects,assigned,"me","mine","today","",now).map(t=>t.id)).toEqual(["b","a"]);
    expect(buildTaskFeed(tasks,projects,assigned,"me","mine","upcoming","",now)).toHaveLength(0);
  });
  it("never treats a stage named Done as task completion",()=>{
    expect(taskView(base,"today",now)).toBe(true);
    expect(taskView({...base,completed_at:"2026-11-14T10:00:00Z"},"completed",now)).toBe(true);
    expect(taskView({...base,completed_at:"2026-11-14T10:00:00Z"},"overdue",now)).toBe(false);
  });
  it("sorts overdue first, excludes archived items and finds undated work in All",()=>{
    const result=buildTaskFeed(tasks,projects,[],"me","team","all","",now);
    expect(result.map(t=>t.id)).toEqual(["b","a","c","d"]);
    expect(buildTaskFeed(tasks,projects,[],"me","team","completed","",now).map(t=>t.id)).toEqual(["e"]);
    expect(buildTaskFeed(tasks,projects,[],"me","team","all","keyboard",now).map(t=>t.id)).toEqual(["b"]);
  });
});
