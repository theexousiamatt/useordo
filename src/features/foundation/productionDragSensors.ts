import { closestCenter, pointerWithin, type CollisionDetection, type KeyboardCoordinateGetter } from "@dnd-kit/core";
export const productionCollision:CollisionDetection=args=>{
  // Stage dragging should never collide with task cards inside a column.
  if(String(args.active.id).startsWith("stage:")) {
    return closestCenter({...args,droppableContainers:args.droppableContainers.filter(c=>
      !!c.data.current?.columnId && !c.data.current?.taskId && c.data.current.columnId!==args.active.data.current?.stageId
    )});
  }
  const available={...args,droppableContainers:args.droppableContainers.filter(c=>c.id!==args.active.id)};
  const hits=pointerWithin(available);const tasks=hits.filter(hit=>available.droppableContainers.find(c=>c.id===hit.id)?.data.current?.taskId);
  return tasks.length ? tasks : args.pointerCoordinates ? hits : closestCenter(available);
};
export const productionKeyboard:KeyboardCoordinateGetter=(event,{context})=>{
  const active=context.collisionRect;if(!active)return;
  const stageId=context.active?.data.current?.stageId;
  if(stageId && event.code!=="ArrowLeft" && event.code!=="ArrowRight")return;
  const horizontal=event.code==="ArrowLeft" || event.code==="ArrowRight";
  const vertical=event.code==="ArrowUp" || event.code==="ArrowDown";if(!horizontal && !vertical)return;
  const direction=["ArrowRight","ArrowDown"].includes(event.code) ? 1 : -1;
  const candidates=context.droppableContainers.getEnabled().filter(c=>
    stageId ? (!!c.data.current?.columnId && !c.data.current?.taskId && c.data.current?.columnId!==stageId)
      : (c.id!==context.active?.id && (horizontal ? !c.data.current?.taskId : !!c.data.current?.taskId))
  ).map(c=>context.droppableRects.get(c.id)).filter(r=>r && (horizontal ? direction*(r.left-active.left)>32 : Math.abs(r.left-active.left)<32 && direction*(r.top-active.top)>8)).sort((a,b)=>horizontal ? Math.abs(a!.left-active.left)-Math.abs(b!.left-active.left) : Math.abs(a!.top-active.top)-Math.abs(b!.top-active.top));
  const target=candidates[0];if(!target)return;event.preventDefault();return {x:target.left+(horizontal ? 16 : 0),y:target.top+(horizontal ? 56 : 0)};
};
/** A downward drop in the same column inserts after the hovered sibling. */
export function productionDropBefore(tasks:{id:string;column_id:string|null;archived_at:string|null}[],task:{id:string;column_id:string|null},destination:{columnId:string;taskId?:string}):string|null {
  if(destination.taskId && destination.columnId===task.column_id){
    const siblings=tasks.filter(item=>item.column_id===destination.columnId && !item.archived_at);
    const source=siblings.findIndex(item=>item.id===task.id),target=siblings.findIndex(item=>item.id===destination.taskId);
    if(source>=0 && target>source)return siblings[target+1]?.id ?? null;
  }
  return destination.taskId ?? null;
}
