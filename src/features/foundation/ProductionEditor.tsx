import { useRef, useState, type FormEvent } from "react";
import { Drawer } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { OrdoButton, OrdoTextField, OrdoSelectField } from "@/design-system/controls";
import { foundationApi, type ProductionBoard, type ProductionColumn, type ProductionTask } from "./api";
import { useRequestId } from "./useRequestId";
export type ProductionEdit = {kind:"board"|"column"|"task";item?:ProductionBoard|ProductionColumn|ProductionTask;boardId:string;columnId?:string;assignees?:string[]};
export default function ProductionEditor({edit,organizationId,projectId,accountId,boards,columns,onClose,onSaved}: {edit:ProductionEdit;organizationId:string;projectId:string;accountId:string;boards:ProductionBoard[];columns:ProductionColumn[];onClose:()=>void;onSaved:(id:string,boardId?:string)=>void}) {
  const task=edit.kind==="task" ? edit.item as ProductionTask|undefined : undefined;
  const column=edit.kind==="column" ? edit.item as ProductionColumn|undefined : undefined;
  const initial={name:edit.item && "name" in edit.item ? edit.item.name : "",title:task?.title ?? "",description:task?.description ?? "",priority:task?.priority ?? "normal",due_date:task?.due_date ?? "",category:column?.category ?? "todo",board_id:edit.boardId,column_id:task?.column_id ?? edit.columnId ?? "",assignees:edit.assignees ?? []};
  const [draft,setDraft]=useState(initial),[error,setError]=useState(""),[pending,setPending]=useState(false),[discard,setDiscard]=useState(false);
  const [unconfirmed,setUnconfirmed]=useState(false);
  const busy=useRef(false);const requestId=useRequestId();
  const members=useQuery({queryKey:["foundation",accountId,organizationId,"eligible",projectId],queryFn:()=>foundationApi.listProductionAssignees(organizationId,projectId),enabled:edit.kind==="task"});
  const set=(key:string,value:string)=>setDraft(current=>({...current,[key]:value}));
  const close=()=>{if(busy.current)return;if(JSON.stringify(draft)!==JSON.stringify(initial)){setDiscard(true);return;}onClose();};
  const submit=async(event:FormEvent)=>{
    event.preventDefault();if(busy.current)return;
    if(!(edit.kind==="task" ? draft.title : draft.name).trim()){setError("Enter a name before saving.");return;}
    if(edit.kind==="task" && !draft.column_id){setError("Choose a destination column.");return;}
    busy.current=true;setPending(true);setError("");
    const values=edit.kind==="task" ? {title:draft.title,description:draft.description,priority:draft.priority,due_date:draft.due_date,column_id:draft.column_id,assignees:draft.assignees} : edit.kind==="column" ? {name:draft.name,category:draft.category,board_id:draft.board_id} : {name:draft.name};
    const input={kind:edit.kind,id:edit.item?.id ?? null,revision:edit.item?.revision ?? null,values};
    try {const savedId=await foundationApi.saveProductionItem(organizationId,projectId,input.kind,input.id,input.revision,values,requestId(input));onSaved(savedId,edit.kind==="task" ? draft.board_id : undefined);}
    catch(failure){setUnconfirmed(!edit.item && !(typeof failure==="object" && failure && "code" in failure && failure.code));setError(typeof failure==="object" && failure && "message" in failure ? String(failure.message) : "Save failed. Your draft is retained; try again.");}
    finally {busy.current=false;setPending(false);}
  };
  return <Drawer.Backdrop isOpen isDismissable={!pending} isKeyboardDismissDisabled={pending} onOpenChange={open=>{if(!open)close();}} className="client-os ordo-ui"><Drawer.Content placement="right"><Drawer.Dialog>
    <form onSubmit={event=>void submit(event)} noValidate aria-busy={pending} className="project-create-form">
      <Drawer.Header><Drawer.Heading>{edit.item ? "Edit" : "Create"} {edit.kind}</Drawer.Heading><OrdoButton type="button" variant="ghost" isDisabled={pending} onPress={close}>Close</OrdoButton></Drawer.Header>
      <Drawer.Body>
        {discard && <div><p role="alert">{unconfirmed ? "The save may already have completed. Retry unchanged or reload saved work before another create." : "Discard unsaved changes?"}</p><OrdoButton type="button" variant="ghost" onPress={()=>setDiscard(false)}>Keep editing</OrdoButton><OrdoButton type="button" variant="outline" onPress={onClose}>{unconfirmed ? "Reload saved work" : "Discard draft"}</OrdoButton></div>}
        <fieldset disabled={pending || unconfirmed} className="space-y-5">
        {edit.kind!=="task" ? <OrdoTextField label="Name" value={draft.name} onChange={value=>set("name",value)} isRequired maxLength={200}/> : <>
          <OrdoTextField label="Task title" value={draft.title} onChange={value=>set("title",value)} isRequired maxLength={500}/>
          <OrdoTextField label="Description" multiline value={draft.description} onChange={value=>set("description",value)} maxLength={50000}/>
          <OrdoSelectField label="Priority" value={draft.priority} onChange={value=>set("priority",value)} isDisabled={pending || unconfirmed} options={["low","normal","high","urgent"].map(id=>({id,name:id}))}/>
          <label className="ordo-field">Due date<input className="input" type="date" value={draft.due_date} onChange={event=>set("due_date",event.target.value)}/></label>
          <OrdoSelectField label="Board" value={draft.board_id} onChange={value=>{setDraft(current=>({...current,board_id:value,column_id:columns.find(c=>c.board_id===value)?.id ?? ""}));}} isDisabled={pending || unconfirmed} options={boards.map(b=>({id:b.id,name:b.name}))}/>
          <OrdoSelectField label="Column" value={draft.column_id} onChange={value=>set("column_id",value)} isDisabled={pending || unconfirmed} options={columns.filter(c=>c.board_id===draft.board_id).map(c=>({id:c.id,name:c.name}))}/>
          <fieldset><legend>Assignees</legend>{members.isPending ? <p role="status">Loading eligible team members…</p> : members.isError ? <div role="alert">Couldn’t load assignees. <OrdoButton type="button" variant="ghost" onPress={()=>void members.refetch()}>Try again</OrdoButton></div> : [...members.data,...draft.assignees.filter(id=>!members.data.some(m=>m.id===id)).map(id=>({id,name:"Unavailable assignee — remove to save"}))].map(member=><label key={member.id} className="flex items-center gap-2 py-2"><input type="checkbox" checked={draft.assignees.includes(member.id)} onChange={event=>setDraft(current=>({...current,assignees:event.target.checked ? [...current.assignees,member.id] : current.assignees.filter(id=>id!==member.id)}))}/>{member.name}</label>)}</fieldset>
        </>}
        {edit.kind==="column" && <OrdoSelectField label="Status category" value={draft.category} onChange={value=>set("category",value)} isDisabled={pending} hint="Populated columns must keep their category until their tasks are moved." options={["backlog","todo","in_progress","review","done"].map(id=>({id,name:id}))}/>}
        </fieldset>
        {unconfirmed && <p>A create could not be confirmed. Retry the unchanged draft before editing to avoid duplicate records.</p>}
        {error && <p role="alert">{error}</p>}<span role="status" className="sr-only">{pending ? "Saving…" : ""}</span>
      </Drawer.Body><Drawer.Footer><OrdoButton type="button" variant="ghost" isDisabled={pending} onPress={close}>Cancel</OrdoButton><OrdoButton type="submit" isPending={pending} isDisabled={pending || (edit.kind==="task" && !members.isSuccess)}>Save {edit.kind}</OrdoButton></Drawer.Footer>
    </form>
  </Drawer.Dialog></Drawer.Content></Drawer.Backdrop>;
}
