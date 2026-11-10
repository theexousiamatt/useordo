import {expect,it} from "vitest";
import {filterUnifiedBase,matchesUnifiedDue,unifiedDueCounts} from "./unifiedTaskFilters";
import type {UnifiedTask} from "./api";
const task=(extra:Partial<UnifiedTask>={})=>({id:"one",work_context_id:"project-a",category:"todo",priority:"high",archived_at:null,due_date:"2026-11-10",board_archived:false,assignees:[{id:"me",name:"Me"}],...extra}) as UnifiedTask;
const filters={assignee:"me",context:"",priority:"",status:"open"};
it("keeps open assignments on archived boards but excludes archived/completed tasks",()=>{
 const rows=filterUnifiedBase([task({board_archived:true}),task({id:"done",category:"done"}),task({id:"archived",archived_at:"2026-11-10"})],filters);expect(rows.map(t=>t.id)).toEqual(["one"]);
});
it("uses Monday through Sunday boundaries on date-only values",()=>{
 expect(matchesUnifiedDue(task({due_date:"2026-11-09"}),"this-week","2026-11-10")).toBe(true);
 expect(matchesUnifiedDue(task({due_date:"2026-11-15"}),"this-week","2026-11-10")).toBe(true);
 expect(matchesUnifiedDue(task({due_date:"2026-11-16"}),"this-week","2026-11-10")).toBe(false);
});
it("counts each authoritative task once and supports every deadline bucket",()=>{
 const rows=[task({assignees:[{id:"me",name:"Me"},{id:"writer",name:"Writer"}]}),task({id:"old",due_date:"2026-11-08"}),task({id:"future",due_date:"2026-11-15"}),task({id:"none",due_date:null})];
 expect(unifiedDueCounts(filterUnifiedBase(rows,filters),"2026-11-10")).toEqual({all:4,today:1,"this-week":2,overdue:1,upcoming:2,none:1});
});
it("applies context, status, priority and assignee filters before counts",()=>{
 const rows=[task(),task({id:"ops",work_context_id:"ops",priority:"normal"}),task({id:"writer",assignees:[{id:"writer",name:"Writer"}]}),task({id:"review",category:"review"})];
 expect(filterUnifiedBase(rows,{...filters,context:"project-a",priority:"high",status:"todo"}).map(t=>t.id)).toEqual(["one"]);
 expect(filterUnifiedBase(rows,{...filters,assignee:"writer"}).map(t=>t.id)).toEqual(["writer"]);
});
it("requires explicit completed status access and excludes completion from open deadline views",()=>{
 const rows=filterUnifiedBase([task({category:"done",due_date:null})],{...filters,status:"done"});expect(rows).toHaveLength(1);expect(matchesUnifiedDue(rows[0],"none","2026-11-10")).toBe(false);expect(matchesUnifiedDue(rows[0],"all","2026-11-10")).toBe(true);
});
