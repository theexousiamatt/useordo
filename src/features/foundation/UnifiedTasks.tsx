import { lazy, Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { foundationApi, type UnifiedTask } from "./api";
import { filterUnifiedBase, matchesUnifiedDue, unifiedDueCounts, UNIFIED_DUE_FILTERS } from "./unifiedTaskFilters";
import { invalidateTaskViews } from "./taskViewCache";
import { ErrorState } from "@/components/states/ErrorState";
import { Button } from "@/components/ui/button";
import { useLocalDateKey } from "@/hooks/useLocalDateKey";
import { dateShort } from "@/lib/format";
const ProductionEditor=lazy(()=>import("./ProductionEditor"));
const selectClass="mt-1 h-11 w-full min-w-0 rounded-small border border-border bg-card px-3 text-sm";
const statuses=[{id:"open",name:"Open work"},{id:"all",name:"All statuses"},{id:"backlog",name:"Backlog"},{id:"todo",name:"To do"},{id:"in_progress",name:"In progress"},{id:"review",name:"Review"},{id:"done",name:"Completed"}];
function TaskFromUnified({task,accountId,organizationId,onClose,onSaved}: {task:UnifiedTask;accountId:string;organizationId:string;onClose:()=>void;onSaved:()=>void}) {
 const context=useQuery({queryKey:["foundation",accountId,organizationId,"task-context",task.work_context_id],queryFn:()=>foundationApi.getTaskContext(organizationId,task.work_context_id)});
 if(context.isPending)return <p role="status">Opening task…</p>;
 if(context.isError)return <div><ErrorState title="Couldn’t open task" description="Your task details are still saved. Try again." onRetry={()=>void context.refetch()}/><Button onClick={onClose}>Close task</Button></div>;
 return <Suspense fallback={<p role="status">Opening editor…</p>}><ProductionEditor accountId={accountId} organizationId={organizationId} projectId={task.project_id ?? ""} workContextId={task.context_kind==="operational" ? task.work_context_id : undefined} readOnly={!task.can_write} people={task.assignees} edit={{kind:"task",item:task,boardId:task.board_id ?? "",columnId:task.column_id ?? undefined,assignees:task.assignees.map(person=>person.id)}} boards={context.data.boards} columns={context.data.columns} onClose={onClose} onSaved={onSaved}/></Suspense>;
}
export default function UnifiedTasks({accountId,organizationId}: {accountId:string;organizationId:string}) {
 const today=useLocalDateKey(),client=useQueryClient();const [params,setParams]=useSearchParams();
 const [opened,setOpened]=useState<UnifiedTask|null>(null),[notice,setNotice]=useState("");
 const query=useQuery({queryKey:["foundation",accountId,organizationId,"my-tasks"],queryFn:()=>foundationApi.listUnifiedTasks(organizationId),retry:1});
 const setFilter=(key:string,value:string)=>{const next=new URLSearchParams(params);if(value)next.set(key,value);else next.delete(key);setParams(next);};
 if(query.isPending)return <p role="status">Loading your tasks…</p>;
 if(query.isError)return <ErrorState title="Couldn’t load your tasks" description="Your assignments could not be loaded. Try again." onRetry={()=>void query.refetch()}/>;
 const tasks=query.data;
 const contexts=[...new Map(tasks.map(task=>[task.work_context_id,{id:task.work_context_id,name:task.context_name,kind:task.context_kind}])).values()].sort((a,b)=>a.name.localeCompare(b.name));
 const people=[...new Map(tasks.flatMap(task=>task.assignees).map(person=>[person.id,person])).values()].sort((a,b)=>a.name.localeCompare(b.name));
 const rawAssignee=params.get("assignee") ?? accountId;
 const assignee=["all","unassigned",accountId,...people.map(p=>p.id)].includes(rawAssignee) ? rawAssignee : accountId;
 const context=contexts.some(c=>c.id===params.get("context")) ? params.get("context")! : "";
 const priority=["low","normal","high","urgent"].includes(params.get("priority") ?? "") ? params.get("priority")! : "";
 const status=statuses.some(s=>s.id===params.get("status")) ? params.get("status")! : "open";
 const due=UNIFIED_DUE_FILTERS.find(filter=>filter.id===params.get("due"))?.id ?? "all";
 const base=filterUnifiedBase(tasks,{assignee,context,priority,status}),counts=unifiedDueCounts(base,today);
 const visible=base.filter(task=>matchesUnifiedDue(task,due,today));
 const close=()=>{setOpened(null);void invalidateTaskViews(client,accountId,organizationId);};
 return <div className="space-y-6">
  <div><h1 className="text-3xl font-semibold tracking-tight">My Tasks</h1><p className="mt-2 text-sm text-muted-foreground">Your authorized work across this studio’s projects and operations.</p></div>
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
   <label className="min-w-0 text-sm font-medium">Project or work context<select className={selectClass} value={context} onChange={event=>setFilter("context",event.target.value)}><option value="">All projects and operations</option>{contexts.map(c=><option key={c.id} value={c.id}>{c.name}{c.kind==="operational" ? " · Operations" : ""}</option>)}</select></label>
   <label className="min-w-0 text-sm font-medium">Priority<select className={selectClass} value={priority} onChange={event=>setFilter("priority",event.target.value)}><option value="">All priorities</option>{["low","normal","high","urgent"].map(p=><option key={p} value={p}>{p}</option>)}</select></label>
   <label className="min-w-0 text-sm font-medium">Task status<select className={selectClass} value={status} onChange={event=>setFilter("status",event.target.value)}>{statuses.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
   <label className="min-w-0 text-sm font-medium">Assignee<select className={selectClass} value={assignee} onChange={event=>setFilter("assignee",event.target.value)}><option value={accountId}>Me</option><option value="all">Everyone I can view</option><option value="unassigned">Unassigned</option>{people.filter(p=>p.id!==accountId).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
  </div>
  <nav aria-label="Task deadlines" className="flex flex-wrap gap-2">{UNIFIED_DUE_FILTERS.map(filter=><Button key={filter.id} size="sm" variant={due===filter.id ? "default" : "outline"} aria-pressed={due===filter.id} onClick={()=>setFilter("due",filter.id==="all" ? "" : filter.id)}>{filter.label} ({counts[filter.id]})</Button>)}</nav>
  <p role="status" className="text-sm text-muted-foreground">{notice ? `${notice} ` : ""}{visible.length} {visible.length===1 ? "task" : "tasks"} shown.</p>
  {!visible.length ? <section className="rounded-panel bg-card p-6"><h2 className="font-semibold">No tasks match these filters.</h2><p className="mt-2 text-sm text-muted-foreground">Assignments will appear here when they are shared with you. Archived boards keep their open assignments visible.</p><Button className="mt-4" variant="outline" onClick={()=>setParams({})}>Clear filters</Button></section> : <ul className="divide-y divide-border overflow-hidden rounded-panel bg-card">{visible.map(task=><li key={task.id} className="flex min-w-0 flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0"><button type="button" aria-label={`Open task: ${task.title}`} className="break-words text-left text-base font-semibold text-primary underline-offset-4 hover:underline focus-visible:underline" onClick={()=>{setNotice("");setOpened(task);}}>{task.title}</button>
     <p className="mt-1 break-words text-sm text-muted-foreground">{task.project_id ? <Link to={`/projects/${task.project_id}`} className="underline underline-offset-2">{task.context_name}</Link> : task.context_name} · {task.context_kind==="operational" ? "Operational work" : task.ownership==="client" ? "Client project" : "Internal project"}{task.initiative_name ? ` · ${task.initiative_name}` : ""}</p>
     <p className="mt-1 text-xs text-muted-foreground">{task.board_name ?? "No board"}{task.board_archived ? " · Archived board" : ""}{!task.can_write ? " · Read only" : ""} · {task.assignees.map(p=>p.id===accountId ? "You" : p.name).join(", ") || "Unassigned"}</p>
    </div><div className="shrink-0 text-sm"><p>{task.priority} · {task.category.replace(/_/g," ")}</p><p className="mt-1 text-muted-foreground">{task.due_date ? `Due ${dateShort(task.due_date)}` : "No due date"}</p></div>
   </li>)}</ul>}
  {opened && <TaskFromUnified task={opened} accountId={accountId} organizationId={organizationId} onClose={close} onSaved={()=>{setNotice("Task saved.");close();}}/>}
 </div>;
}
