import { useEffect, useRef, useState, type FormEvent } from "react";
import { Checkbox, Description, Drawer, Dropdown, Label, Modal } from "@heroui/react";
import * as Dialog from "@radix-ui/react-dialog";
import { closestCenter, pointerWithin, DndContext, KeyboardSensor, PointerSensor, useDroppable, useSensor, useSensors, type DragEndEvent, type CollisionDetection } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowRight, CalendarDays, Check, GripVertical, LayoutGrid, List, MoreHorizontal, Moon, Plus, Settings2, Sun, X } from "lucide-react";
import { OrdoButton, OrdoMemberPicker, OrdoTextField, PriorityPicker } from "./controls";
import { OrdoLogo } from "./OrdoLogo";
import { members } from "./options";

export type Task = {id:string;title:string;description:string;column:string;priority:string;due:string;assignees:string[]};
const initialTasks:Task[] = [
  {id:"task-identity",title:"Refine the visual identity",description:"Explore the type and color direction, then prepare a focused presentation for internal review.",column:"production",priority:"high",due:"2026-11-06",assignees:["designer","pamilerin"]},
  {id:"task-copy",title:"Draft the launch story",description:"Bring the product’s purpose into a clear and confident narrative.",column:"production",priority:"normal",due:"",assignees:["writer"]},
  {id:"task-site",title:"Review the homepage direction",description:"Check the hierarchy, rhythm and responsive behavior.",column:"review",priority:"normal",due:"2026-11-09",assignees:["pamilerin"]},
];
const initialColumns=[{id:"production",name:"In progress"},{id:"review",name:"Internal review"}];
const blank = ():Task=>({id:"",title:"",description:"",column:"production",priority:"normal",due:"",assignees:[]});

function TaskSurface({task,onEdit,onMove}: {task:Task;onEdit:(task:Task)=>void;onMove:(id:string)=>void}) {
  const {attributes,listeners,setNodeRef,setActivatorNodeRef,transform,transition,isDragging}=useSortable({id:task.id});
  return <article ref={setNodeRef} style={{transform:CSS.Transform.toString(transform),transition}} className={`task-surface ${isDragging ? "is-dragging" : ""}`} data-task-id={task.id}>
    <div className="task-top"><span className={`priority priority-${task.priority}`}>{task.priority}</span>
      <div className="task-actions"><button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Reorder ${task.title}`} className="drag-handle"><GripVertical size={16} /></button>
        <Dropdown><OrdoButton variant="ghost" isIconOnly aria-label={`Actions for ${task.title}`}><MoreHorizontal size={18}/></OrdoButton>
          <Dropdown.Popover className="ordo-popover"><Dropdown.Menu onAction={key=>key==="edit"?onEdit(task):onMove(task.id)}>
            <Dropdown.Item id="edit" textValue="Edit task"><Label>Edit task</Label></Dropdown.Item>
            <Dropdown.Item id="move" textValue="Move to other column"><Label>Move to other column</Label></Dropdown.Item>
          </Dropdown.Menu></Dropdown.Popover>
        </Dropdown>
      </div>
    </div>
    <button className="task-title" type="button" onClick={()=>onEdit(task)}>{task.title}</button>
    <p className="task-description">{task.description}</p>
    <div className="task-bottom"><span className="task-date"><CalendarDays size={14}/>{task.due?new Intl.DateTimeFormat("en",{month:"short",day:"numeric"}).format(new Date(task.due+"T12:00:00")):"No due date"}</span>
      <span className="avatar-group" aria-label={task.assignees.map(id=>members.find(m=>m.id===id)?.name).join(", ")}>{task.assignees.map(id=><span className="avatar" key={id} title={members.find(m=>m.id===id)?.name}>{members.find(m=>m.id===id)?.initials}</span>)}</span>
    </div>
  </article>;
}
function Column({id,name,tasks,onEdit,onMove,onCreate}: {id:string;name:string;tasks:Task[];onEdit:(task:Task)=>void;onMove:(id:string)=>void;onCreate:()=>void}) {
  const {setNodeRef,isOver}=useDroppable({id});
  return <section ref={setNodeRef} className={`board-column ${isOver?"is-over":""}`} aria-label={name}>
    <div className="column-header"><h2>{name}</h2><span>{tasks.length}</span></div>
    <SortableContext items={tasks.map(t=>t.id)} strategy={verticalListSortingStrategy}>
      <div className="column-tasks">{tasks.map(task=><TaskSurface key={task.id} task={task} onEdit={onEdit} onMove={onMove}/>)}
        {!tasks.length&&<p className="empty-column">A clear space for the next step.</p>}
      </div>
    </SortableContext>
    <OrdoButton variant="ghost" className="add-task" onPress={onCreate}><Plus size={16}/> Add task</OrdoButton>
  </section>;
}

export function App() {
  const [tasks,setTasks]=useState(initialTasks);
  const [columns,setColumns]=useState(initialColumns);
  const [theme,setTheme]=useState<"light"|"dark">("light");
  const [view,setView]=useState("board");
  const [reducedMotion,setReducedMotion]=useState(false);
  useEffect(()=>{document.documentElement.dataset.reduceMotion=String(reducedMotion);return()=>{delete document.documentElement.dataset.reduceMotion;};},[reducedMotion]);
  const [draft,setDraft]=useState<Task|null>(null);
  const original=useRef<Task|null>(null);
  const lastDraft=useRef<Task|null>(null);
  useEffect(()=>{if(draft)lastDraft.current=draft;},[draft]);
  const shownDraft=draft??lastDraft.current;
  const opener=useRef<HTMLElement|null>(null);
  const [pending,setPending]=useState(false);
  const [error,setError]=useState("");
  const [closeNotice,setCloseNotice]=useState(false);
  const [failNext,setFailNext]=useState(false);
  const [notice,setNotice]=useState("");
  const [configOpen,setConfigOpen]=useState(false);
  const [columnName,setColumnName]=useState("Internal review");
  const [legacyOpen,setLegacyOpen]=useState(false);
  const [legacyPriority,setLegacyPriority]=useState("normal");
  const [legacyPortal,setLegacyPortal]=useState<HTMLDivElement|null>(null);
  const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:8}}),useSensor(KeyboardSensor,{coordinateGetter:sortableKeyboardCoordinates}));
  useEffect(()=>{document.documentElement.dataset.theme=`ordo-${theme}`;document.documentElement.classList.toggle("dark",theme==="dark");return()=>{document.documentElement.classList.remove("dark");document.documentElement.dataset.theme="ordo-light";}},[theme]);
  const dirty=!!draft&&JSON.stringify(draft)!==JSON.stringify(original.current);
  const edit=(task?:Task,column="production")=>{
    opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const next=task?{...task,assignees:[...task.assignees]}:{...blank(),column};
    original.current=next;setDraft(next);setError("");setCloseNotice(false);setNotice("");
  };
  const close=()=>{if(pending)return;setDraft(null);setCloseNotice(false);requestAnimationFrame(()=>opener.current?.focus());};
  const requestClose=()=>{if(pending)return;if(dirty){setCloseNotice(true);return;}close();};
  const save=async(event:FormEvent)=>{
    event.preventDefault();if(pending||!draft)return;
    if(!draft.title.trim()){setError("Give this task a name.");return;}
    setPending(true);setError("");
    await new Promise(resolve=>setTimeout(resolve,650));
    if(failNext){setFailNext(false);setError("The preview save failed. Your changes are still here; try again.");setPending(false);return;}
    const saved={...draft,id:draft.id||crypto.randomUUID(),title:draft.title.trim()};
    setTasks(current=>saved.id===draft.id?current.map(t=>t.id===saved.id?saved:t):[...current,saved]);
    setPending(false);setDraft(null);setCloseNotice(false);setNotice("Task saved in this preview.");requestAnimationFrame(()=>opener.current?.focus());
  };
  const move=(id:string)=>{setTasks(current=>current.map(t=>t.id===id?{...t,column:t.column==="production"?"review":"production"}:t));setNotice("Task moved in this preview.");};
  const collision:CollisionDetection = args=>{
    const emptyColumn=pointerWithin(args).find(hit=>columns.some(column=>column.id===hit.id)&&!tasks.some(task=>task.column===hit.id));
    if(emptyColumn)return [emptyColumn];
    return closestCenter({...args,droppableContainers:args.droppableContainers.filter(container=>tasks.some(task=>task.id===container.id))});
  };
  const drop=({active,over}:DragEndEvent)=>{
    if(!over||active.id===over.id)return;
    setTasks(current=>{
      const activeIndex=current.findIndex(t=>t.id===active.id);const targetIndex=current.findIndex(t=>t.id===over.id);
      if(activeIndex<0)return current;
      const destination=targetIndex>=0?current[targetIndex].column:columns.find(c=>c.id===over.id)?.id;
      if(!destination)return current;
      const updated=current.map(t=>t.id===active.id?{...t,column:destination}:t);
      return targetIndex>=0?arrayMove(updated,activeIndex,targetIndex):updated;
    });setNotice("Task order updated in this preview.");
  };
  return <>
    <header className="app-header"><OrdoLogo tone={theme==="dark"?"dark":"light"}/><div className="workspace-name">Inspirare Studio <span>Interface preview</span></div>
      <OrdoButton variant="ghost" isIconOnly aria-label={theme==="light"?"Switch to dark theme":"Switch to light theme"} onPress={()=>setTheme(t=>t==="light"?"dark":"light")}>{theme==="light"?<Moon size={18}/>:<Sun size={18}/>}</OrdoButton>
    </header>
    <main className="workspace">
      <nav className="breadcrumb" aria-label="Project context"><span>Projects</span><ArrowRight size={14}/><span>Lora</span></nav>
      <div className="project-heading"><div><h1>Lora production</h1><p>A shared space for the work taking shape.</p></div><OrdoButton onPress={()=>edit()}><Plus size={17}/> New task</OrdoButton></div>
      <div className="project-toolbar"><div className="view-switch" aria-label="Project view"><OrdoButton variant={view==="board"?"secondary":"ghost"} aria-pressed={view==="board"} onPress={()=>setView("board")}><LayoutGrid size={16}/> Board</OrdoButton><OrdoButton variant={view==="list"?"secondary":"ghost"} aria-pressed={view==="list"} onPress={()=>setView("list")}><List size={16}/> List</OrdoButton></div><OrdoButton variant="outline" onPress={()=>{setColumnName(columns[1].name);setConfigOpen(true);}}><Settings2 size={16}/> Configure board</OrdoButton></div>
      <div role="status" className={`save-notice ${notice?"has-notice":""}`}>{notice&&<><Check size={15}/>{notice}</>}</div>
      {view==="board"?<DndContext sensors={sensors} collisionDetection={collision} onDragEnd={drop}>
        <div className="board" aria-label="Sample production board">{columns.map(column=><Column key={column.id} {...column} tasks={tasks.filter(t=>t.column===column.id)} onEdit={edit} onMove={move} onCreate={()=>edit(undefined,column.id)}/>)}</div>
      </DndContext>:<section className="task-list" aria-label="Sample project tasks">{tasks.map(task=><button type="button" key={task.id} className="task-list-row" onClick={()=>edit(task)}><span>{task.title}</span><span>{columns.find(c=>c.id===task.column)?.name}</span><span className={`priority priority-${task.priority}`}>{task.priority}</span></button>)}</section>}
      <section className="preview-notes" aria-labelledby="preview-title"><div><h2 id="preview-title">Try the interactions</h2><p>Sample data only. Changes stay in this preview until reload.</p></div><div className="preview-actions"><Checkbox isSelected={reducedMotion} onChange={setReducedMotion}><Checkbox.Content><Checkbox.Control><Checkbox.Indicator/></Checkbox.Control>Reduce motion</Checkbox.Content></Checkbox><Checkbox isSelected={failNext} onChange={setFailNext}><Checkbox.Content><Checkbox.Control><Checkbox.Indicator/></Checkbox.Control>Make the next save fail</Checkbox.Content></Checkbox><OrdoButton variant="outline" onPress={()=>setLegacyOpen(true)}>Open retained drawer</OrdoButton></div></section>
    </main>
    <Drawer.Backdrop isOpen={!!draft} onOpenChange={open=>{if(!open)requestClose();}} isDismissable={!pending} isKeyboardDismissDisabled={pending} className="ordo-backdrop">
      <Drawer.Content placement="right" className="ordo-drawer"><Drawer.Dialog>
        <form onSubmit={save} noValidate className="task-form" aria-busy={pending}>
          <Drawer.Header><Drawer.Heading>{shownDraft?.id?"Task details":"New task"}</Drawer.Heading><OrdoButton variant="ghost" isIconOnly aria-label="Close task details" isDisabled={pending} onPress={requestClose}><X size={18}/></OrdoButton></Drawer.Header>
          <Drawer.Body><p className="drawer-context">Lora / {columns.find(c=>c.id===shownDraft?.column)?.name}</p>
            {shownDraft&&<><OrdoTextField label="Task name" name="title" value={shownDraft.title} onChange={title=>setDraft(d=>d&&({...d,title}))} error={!shownDraft.title.trim()?error||undefined:undefined} isRequired isDisabled={pending} autoFocus/>
              <OrdoTextField multiline label="Description" value={shownDraft.description} onChange={description=>setDraft(d=>d&&({...d,description}))} isDisabled={pending}/>
              <PriorityPicker value={shownDraft.priority} onChange={priority=>setDraft(d=>d&&({...d,priority}))} disabled={pending}/>
              <OrdoMemberPicker value={shownDraft.assignees} onChange={assignees=>setDraft(d=>d&&({...d,assignees}))} disabled={pending}/>
              <OrdoTextField label="Due date" type="date" hint="Dates follow your local calendar." value={shownDraft.due} onChange={due=>setDraft(d=>d&&({...d,due}))} isDisabled={pending}/>
            </>}
            {error&&<p role="alert" className="error-message">{error}</p>}{closeNotice&&<p role="alert" className="error-message">You have unsaved changes. Save them or choose Discard changes.</p>}
          </Drawer.Body>
          <Drawer.Footer><span role="status" className="sr-only">{pending?"Saving task":""}</span><OrdoButton variant="tertiary" isDisabled={pending} onPress={close}>{dirty?"Discard changes":"Cancel"}</OrdoButton><OrdoButton type="submit" isPending={pending}>Save task</OrdoButton></Drawer.Footer>
        </form>
      </Drawer.Dialog></Drawer.Content>
    </Drawer.Backdrop>
    <Modal.Backdrop isOpen={configOpen} onOpenChange={setConfigOpen} className="ordo-backdrop"><Modal.Container><Modal.Dialog className="ordo-dialog">
      <form onSubmit={event=>{event.preventDefault();if(!columnName.trim())return;setColumns(c=>c.map(item=>item.id==="review"?{...item,name:columnName.trim()}:item));setConfigOpen(false);setNotice("Board configuration updated in this preview.");}}>
        <Modal.Header><Modal.Heading>Configure board</Modal.Heading><Modal.CloseTrigger/></Modal.Header>
        <Modal.Body><p>Rename a stage without changing its task identities or reporting category.</p><OrdoTextField label="Review column name" value={columnName} onChange={setColumnName} isRequired autoFocus/><p className="field-hint">Reporting category: review</p></Modal.Body>
        <Modal.Footer><OrdoButton variant="tertiary" onPress={()=>setConfigOpen(false)}>Cancel</OrdoButton><OrdoButton type="submit">Save configuration</OrdoButton></Modal.Footer>
      </form>
    </Modal.Dialog></Modal.Container></Modal.Backdrop>
    <Dialog.Root open={legacyOpen} onOpenChange={setLegacyOpen}><Dialog.Portal><Dialog.Overlay className="legacy-backdrop"/><Dialog.Content className="legacy-sheet" aria-describedby="legacy-description">
      <Dialog.Title>Retained drawer check</Dialog.Title><Dialog.Description id="legacy-description">A Radix dialog with a HeroUI selector. This stress test reproduces a known issue: Escape in the selector can also dismiss this drawer. This mixed overlay composition is not approved for adoption.</Dialog.Description>
      <div ref={setLegacyPortal} className="legacy-fields"><PriorityPicker value={legacyPriority} onChange={setLegacyPriority} portalContainer={legacyPortal??undefined}/></div>
      <Description>Selected priority: {legacyPriority}</Description><Dialog.Close className="legacy-close" aria-label="Close retained drawer"><X size={18}/></Dialog.Close>
    </Dialog.Content></Dialog.Portal></Dialog.Root>
  </>;
}
