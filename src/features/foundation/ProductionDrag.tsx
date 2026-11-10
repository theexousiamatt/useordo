import type { ReactNode } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
export function ProductionDropColumn({id,name,children}: {id:string;name:string;children:ReactNode}) {
  const drop=useDroppable({id:`column:${id}`,data:{columnId:id}});
  return <section ref={drop.setNodeRef} aria-label={name} className={`w-64 shrink-0 rounded-card bg-secondary p-4 ${drop.isOver ? "ring-2 ring-primary" : ""}`}>{children}</section>;
}
export function ProductionDragTask({id,columnId,title,disabled,children}: {id:string;columnId:string;title:string;disabled:boolean;children:ReactNode}) {
  const drag=useDraggable({id,disabled,data:{taskId:id,columnId}});const drop=useDroppable({id,disabled,data:{taskId:id,columnId}});
  return <li ref={node=>{drag.setNodeRef(node);drop.setNodeRef(node);}} style={{transform:CSS.Translate.toString(drag.transform),opacity:drag.isDragging ? .5 : 1}} className="rounded-small bg-card p-4">
    {!disabled && <button type="button" ref={drag.setActivatorNodeRef} {...drag.attributes} {...drag.listeners} data-task-handle={id} aria-label={`Drag ${title}`} className="mb-2 rounded-small px-2 py-1 text-xs text-muted-foreground touch-none cursor-grab">Move</button>}{children}
  </li>;
}
