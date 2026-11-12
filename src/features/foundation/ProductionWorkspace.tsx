import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { foundationApi, type ProductionTask } from "./api";
import { ErrorState } from "@/components/states/ErrorState";
import type { ProductionEdit } from "./ProductionEditor";
import { Button } from "@/components/ui/button";
import { ProductionDragTask, ProductionDropColumn } from "./ProductionDrag";
import { ProjectTeamPanel } from "./ProjectTeamPanel";
import { productionCollision, productionKeyboard, productionDropBefore } from "./productionDragSensors";
import { invalidateTaskViews } from "./taskViewCache";
import { dateShort } from "@/lib/format";
const ProductionEditor=lazy(()=>import("./ProductionEditor"));
type Action={action:string;id:string;revision:number;columnId:string|null;beforeId:string|null;requestId:string};
export default function ProductionWorkspace({accountId,organizationId,projectId}: {accountId:string;organizationId:string;projectId:string}) {
  const queryClient=useQueryClient();
  const [selectedId,setSelectedId]=useState("");const [edit,setEdit]=useState<ProductionEdit|null>(null);
  const [showArchived,setShowArchived]=useState(false),[showArchivedTasks,setShowArchivedTasks]=useState(false);
  const [removeColumnId,setRemoveColumnId]=useState<string|null>(null),[removeTo,setRemoveTo]=useState("");
  const [saving,setSaving]=useState(false),[failure,setFailure]=useState<{command:Action;message:string}|null>(null),[notice,setNotice]=useState("");
  const busy=useRef(false),focusTask=useRef<string|null>(null),root=useRef<HTMLElement>(null);
  const workspace=useQuery({queryKey:["foundation",accountId,organizationId,"production",projectId],queryFn:()=>foundationApi.getProductionWorkspace(organizationId,projectId)});
  const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:8}}),useSensor(KeyboardSensor,{coordinateGetter:productionKeyboard}));
  useEffect(()=>{if(focusTask.current){root.current?.querySelector<HTMLButtonElement>(`[data-task-handle="${focusTask.current}"]`)?.focus();focusTask.current=null;}},[workspace.data]);
  const command=async(input:Action)=>{if(busy.current)return;busy.current=true;setSaving(true);setFailure(null);setNotice("");try{
    if(input.action==="move_column" || input.action==="remove_column") {
      await foundationApi.changeProductionColumn(organizationId,projectId,input.action,input.id,input.revision,input.columnId,input.requestId);
    } else {
      await foundationApi.changeProductionItem(organizationId,projectId,input.action,input.id,input.revision,input.columnId,input.beforeId,input.requestId);
    }
    focusTask.current=input.action==="move_task" ? input.id : null;setNotice("Changes saved.");await invalidateTaskViews(queryClient,accountId,organizationId);}catch(error){setFailure({command:input,message:typeof error==="object" && error && "message" in error ? String(error.message) : "Save could not be confirmed. Retry safely or reload saved work."});}finally{busy.current=false;setSaving(false);}};
  const act=(action:string,id:string,revision:number,columnId:string|null=null,beforeId:string|null=null)=>void command({action,id,revision,columnId,beforeId,requestId:crypto.randomUUID()});
  if (workspace.isPending) return <p role="status">Loading production workspace…</p>;
  if (workspace.isError) return <ErrorState title="Couldn’t load production workspace" description="Your saved work could not be loaded." onRetry={()=>void workspace.refetch()} />;
  const data=workspace.data,boards=data.boards.filter(b=>showArchived || !b.archived_at),board=boards.find(b=>b.id===selectedId) ?? boards[0];
  const permissions=data.permissions ?? {can_write:false,can_configure:false};const locked=saving || !!failure;
  const move=(event:DragEndEvent)=>{
    if(locked || !event.over || event.active.id===event.over.id)return;
    const stageId=event.active.data.current?.stageId;
    const destination=event.over.data.current;
    if(stageId) {
      const stage=data.columns.find(c=>c.id===stageId),target=data.columns.find(c=>c.id===destination?.columnId);
      if(permissions.can_configure && stage && target && stage.id!==target.id && stage.board_id===board?.id && target.board_id===stage.board_id && !board?.archived_at) {
        const stages=data.columns.filter(c=>c.board_id===stage.board_id).sort((a,b)=>a.position-b.position);
        const from=stages.findIndex(c=>c.id===stage.id),to=stages.findIndex(c=>c.id===target.id);
        const beforeId=from<to ? (stages[to+1]?.id ?? null) : target.id;
        act("move_column",stage.id,stage.revision,beforeId);
      }
      return;
    }
    const task=data.tasks.find(t=>t.id===event.active.id);
    if(task && destination?.columnId)act("move_task",task.id,task.revision,destination.columnId,productionDropBefore(data.tasks,task,{columnId:destination.columnId,taskId:destination.taskId}));
  };
  const taskEditor=(task:ProductionTask)=>setEdit({kind:"task",item:task,boardId:task.board_id!,assignees:data.assignments.filter(a=>a.task_id===task.id).map(a=>a.user_id)});
  const removing=data.columns.find(column=>column.id===removeColumnId && column.board_id===board?.id);
  const removalTaskCount=removing ? data.tasks.filter(task=>task.column_id===removing.id).length : 0;
  const replacementStages=removing ? data.columns.filter(column=>column.board_id===removing.board_id && column.id!==removing.id) : [];
  return <section ref={root} aria-label="Production workspace" className="mb-7 space-y-4" aria-busy={saving}>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showArchived} onChange={event=>setShowArchived(event.target.checked)}/>Include archived boards</label>
    {failure && <div role="alert" className="space-y-2"><p>{failure.message}</p><Button onClick={()=>void command(failure.command)}>Retry save</Button><Button variant="outline" onClick={()=>{setFailure(null);void workspace.refetch();}}>Reload saved work</Button></div>}
    <p role="status" className="text-sm">{saving ? "Saving…" : notice}</p>
    {permissions.can_configure && <ProjectTeamPanel accountId={accountId} organizationId={organizationId} projectId={projectId}/>}
    {permissions.can_configure && <Button disabled={locked} onClick={()=>setEdit({kind:"board",boardId:board?.id ?? ""})}>Create board</Button>}
    {!board ? <p>No active boards in this project.</p> : <>
      {permissions.can_configure && <div className="flex flex-wrap gap-2">{!board.archived_at && <><Button disabled={locked} variant="outline" onClick={()=>setEdit({kind:"board",item:board,boardId:board.id})}>Edit board</Button><Button disabled={locked} variant="outline" onClick={()=>setEdit({kind:"column",boardId:board.id})}>Add stage</Button></>}<Button disabled={locked} variant="outline" onClick={()=>act(board.archived_at ? "restore_board" : "archive_board",board.id,board.revision)}>{board.archived_at ? "Restore board" : "Archive board"}</Button></div>}
      {board.archived_at && <p role="status">This board is archived. Its tasks and assignments are retained.</p>}
      <label className="flex flex-wrap items-center gap-3 text-sm font-medium">Project board<select className="rounded-small border border-border bg-card px-3 py-2" value={board.id} onChange={event=>setSelectedId(event.target.value)}>{boards.map(item=><option key={item.id} value={item.id}>{item.name}{item.archived_at ? " (archived)" : ""}</option>)}</select></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showArchivedTasks} onChange={event=>setShowArchivedTasks(event.target.checked)}/>Show archived tasks</label>
      {removing && <div role="dialog" aria-label="Remove project stage" className="max-w-xl space-y-3 rounded-card border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Remove {removing.name}?</h3>
        {removalTaskCount>0 ? <><p className="text-sm text-muted-foreground">{removalTaskCount} task{removalTaskCount===1 ? "" : "s"} (including archived tasks) will be moved before this stage is removed. Task details and assignments are preserved.</p>
          <label className="block space-y-1 text-sm">Move tasks to
            <select className="block w-full rounded-small border border-border bg-card px-3 py-2" value={removeTo} onChange={event=>setRemoveTo(event.target.value)}>
              <option value="">Choose destination stage</option>
              {replacementStages.map(column=><option key={column.id} value={column.id}>{column.name}</option>)}
            </select>
          </label>
        </> : <p className="text-sm text-muted-foreground">This stage has no tasks. Removing it will not affect other stages.</p>}
        {removalTaskCount>0 && replacementStages.length===0 && <p role="alert" className="text-sm text-destructive">Create another stage first, then choose where to move these tasks.</p>}
        <div className="flex flex-wrap gap-2">
          <Button disabled={locked || (removalTaskCount>0 && !removeTo)} onClick={()=>{
            act("remove_column",removing.id,removing.revision,removalTaskCount>0 ? removeTo : null);
            setRemoveColumnId(null);setRemoveTo("");
          }}>Confirm removal</Button>
          <Button variant="outline" disabled={locked} onClick={()=>{setRemoveColumnId(null);setRemoveTo("");}}>Cancel</Button>
        </div>
      </div>}
      <DndContext sensors={sensors} collisionDetection={productionCollision} onDragEnd={move}>
      <div className="flex gap-4 overflow-x-auto pb-4" aria-label="Board columns">
        {data.columns.filter(column=>column.board_id===board.id).sort((a,b)=>a.position-b.position).map(column=>{const tasks=data.tasks.filter(t=>t.board_id===board.id && t.column_id===column.id && (!!t.archived_at===showArchivedTasks));return <ProductionDropColumn key={column.id} id={column.id} name={column.name} draggable={permissions.can_configure && !board.archived_at && !locked}>
          {permissions.can_configure && !board.archived_at && <div className="mb-3 flex flex-wrap gap-1">
            <Button disabled={locked} variant="ghost" size="sm" onClick={()=>setEdit({kind:"column",item:column,boardId:board.id})}>Edit stage</Button>
            <Button disabled={locked} variant="ghost" size="sm" onClick={()=>{setRemoveColumnId(column.id);setRemoveTo("");}}>Remove stage</Button>
          </div>}
          {permissions.can_write && !board.archived_at && <Button disabled={locked} variant="ghost" size="sm" onClick={()=>setEdit({kind:"task",boardId:board.id,columnId:column.id})}>Add task</Button>}
          <ul className="space-y-3">{tasks.map((task,index)=><ProductionDragTask key={task.id} id={task.id} title={task.title} columnId={column.id} disabled={locked || !!board.archived_at || !!task.archived_at || !permissions.can_write}>
            <p className="break-words text-sm font-medium">{task.title}</p><p className="text-xs text-muted-foreground">{data.assignments?.filter(a=>a.task_id===task.id).length ?? 0} assignees</p><p className="mt-2 text-xs text-muted-foreground">{task.priority}{task.due_date ? ` · Due ${dateShort(task.due_date)}` : ""}</p>
            {permissions.can_write && !board.archived_at && <div className="mt-2 flex flex-wrap gap-1">{!task.archived_at && <><Button disabled={locked} variant="ghost" size="sm" onClick={()=>taskEditor(task)}>Edit task</Button><Button disabled={locked || index===0} variant="ghost" size="sm" aria-label={`Move ${task.title} up`} onClick={()=>act("move_task",task.id,task.revision,column.id,tasks[index-1].id)}>Up</Button><Button disabled={locked || index===tasks.length-1} variant="ghost" size="sm" aria-label={`Move ${task.title} down`} onClick={()=>act("move_task",task.id,task.revision,column.id,tasks[index+2]?.id ?? null)}>Down</Button></>}<Button disabled={locked} variant="ghost" size="sm" onClick={()=>act(task.archived_at ? "restore_task" : "archive_task",task.id,task.revision)}>{task.archived_at ? "Restore task" : "Archive task"}</Button></div>}
          </ProductionDragTask>)}</ul>{!tasks.length && <p className="text-xs text-muted-foreground">No tasks yet.</p>}
        </ProductionDropColumn>;})}
        {permissions.can_configure && !board.archived_at && <div className="w-56 shrink-0"><Button disabled={locked} variant="outline" onClick={()=>setEdit({kind:"column",boardId:board.id})}>+ Add stage</Button></div>}
      </div></DndContext>
    </>}
    {edit && <Suspense fallback={<p role="status">Opening editor…</p>}><ProductionEditor edit={edit} organizationId={organizationId} projectId={projectId} accountId={accountId} boards={data.boards.filter(b=>!b.archived_at)} columns={data.columns} onClose={()=>{setEdit(null);void invalidateTaskViews(queryClient,accountId,organizationId);}} onSaved={(id,destinationBoard)=>{if(edit.kind==="board")setSelectedId(id);if(destinationBoard){setSelectedId(destinationBoard);setShowArchivedTasks(false);}setEdit(null);setNotice("Changes saved.");void invalidateTaskViews(queryClient,accountId,organizationId);}} /></Suspense>}
  </section>;
}
