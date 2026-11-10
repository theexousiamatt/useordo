import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { foundationApi } from "./api";
import { ErrorState } from "@/components/states/ErrorState";
import type { ProductionEdit } from "./ProductionEditor";
import { Button } from "@/components/ui/button";
const ProductionEditor=lazy(()=>import("./ProductionEditor"));
import { dateShort } from "@/lib/format";

export default function ProductionWorkspace({accountId,organizationId,projectId}: {accountId:string;organizationId:string;projectId:string}) {
  const [selectedId,setSelectedId]=useState("");
  const [edit,setEdit]=useState<ProductionEdit|null>(null);
  const workspace=useQuery({queryKey:["foundation",accountId,organizationId,"production",projectId],queryFn:()=>foundationApi.getProductionWorkspace(organizationId,projectId)});
  if (workspace.isPending) return <p role="status">Loading production workspace…</p>;
  if (workspace.isError) return <ErrorState title="Couldn’t load production workspace" description="Your saved work could not be loaded." onRetry={()=>void workspace.refetch()} />;
  const board=workspace.data.boards.find(item=>item.id===selectedId) ?? workspace.data.boards[0];
  if (!board) return <p className="mb-6 rounded-card bg-card p-5">No active boards in this project.</p>;
  return <section aria-label="Production workspace" className="mb-7 space-y-4">
    {workspace.data.permissions?.can_configure && <div className="flex flex-wrap gap-2"><Button onClick={()=>setEdit({kind:"board",boardId:board.id})}>Create board</Button><Button variant="outline" onClick={()=>setEdit({kind:"board",item:board,boardId:board.id})}>Edit board</Button><Button variant="outline" onClick={()=>setEdit({kind:"column",boardId:board.id})}>Create column</Button></div>}
    {edit && <Suspense fallback={<p role="status">Opening editor…</p>}><ProductionEditor edit={edit} organizationId={organizationId} projectId={projectId} accountId={accountId} boards={workspace.data.boards} columns={workspace.data.columns} onClose={()=>{setEdit(null);void workspace.refetch();}} onSaved={id=>{if(edit.kind==="board")setSelectedId(id);setEdit(null);void workspace.refetch();}} /></Suspense>}
    <label className="flex flex-wrap items-center gap-3 text-sm font-medium">Project board<select className="rounded-small border border-border bg-card px-3 py-2" value={board.id} onChange={event=>setSelectedId(event.target.value)}>{workspace.data.boards.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <div className="flex gap-4 overflow-x-auto pb-4" aria-label="Board columns">
      {workspace.data.columns.filter(column=>column.board_id===board.id).map(column=><section key={column.id} aria-label={column.name} className="w-64 shrink-0 rounded-card bg-secondary p-4">
        <h3 className="mb-4 text-sm font-semibold">{column.name}</h3>
        {workspace.data.permissions?.can_configure && <Button variant="ghost" size="sm" onClick={()=>setEdit({kind:"column",item:column,boardId:board.id})}>Edit column</Button>}
        {workspace.data.permissions?.can_write && <Button variant="ghost" size="sm" onClick={()=>setEdit({kind:"task",boardId:board.id,columnId:column.id})}>Add task</Button>}
        <ul className="space-y-3">{workspace.data.tasks.filter(task=>task.board_id===board.id && task.column_id===column.id).map(task=><li key={task.id} className="rounded-small bg-card p-4"><p className="break-words text-sm font-medium">{task.title}</p>{workspace.data.permissions?.can_write && <Button variant="ghost" size="sm" onClick={()=>setEdit({kind:"task",item:task,boardId:board.id,assignees:workspace.data.assignments.filter(a=>a.task_id===task.id).map(a=>a.user_id)})}>Edit task</Button>}<p className="text-xs text-muted-foreground">{workspace.data.assignments?.filter(a=>a.task_id===task.id).length ?? 0} assignees</p><p className="mt-2 text-xs text-muted-foreground">{task.priority}{task.due_date ? ` · Due ${dateShort(task.due_date)}` : ""}</p></li>)}</ul>
        {!workspace.data.tasks.some(task=>task.board_id===board.id && task.column_id===column.id) && <p className="text-xs text-muted-foreground">No tasks yet.</p>}
      </section>)}
    </div>
  </section>;
}
