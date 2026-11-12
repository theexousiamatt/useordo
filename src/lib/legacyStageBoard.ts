import type { TaskRow } from "@/hooks/useProjectData";
import type { TaskStatus } from "@/lib/projectConstants";

export type BoardStage = { id:string; category:TaskStatus; position:number };
export type BoardTask = Pick<TaskRow,"id"|"status"|"stage_id"|"position">;

/** Old tasks without stage_id still appear in a stage after an additive migration. */
export function stageForTaskId(task:BoardTask,stages:readonly BoardStage[]):string|undefined {
  if(task.stage_id && stages.some(stage=>stage.id===task.stage_id))return task.stage_id;
  return stages.find(stage=>stage.category===task.status)?.id ?? stages[0]?.id;
}

/** Dropping a column on another column puts it after when moving right. */
export function stageInsertBefore(stages:readonly BoardStage[],sourceId:string,targetId:string):string|null {
  const ordered=[...stages].sort((a,b)=>a.position-b.position);
  const from=ordered.findIndex(stage=>stage.id===sourceId);
  const to=ordered.findIndex(stage=>stage.id===targetId);
  if(from<0 || to<0 || from===to)return null;
  return from<to ? ordered[to+1]?.id ?? null : targetId;
}

export function moveTaskWithinStages<T extends BoardTask>(
  items:readonly T[],stages:readonly BoardStage[],movingId:string,hoveredId:string,
):{next:T[];updates:{id:string;status:TaskStatus;stage_id:string|null;position:number}[]}|null {
  const movingOriginal=items.find(task=>task.id===movingId);
  if(!movingOriginal)return null;
  const hovered=items.find(task=>task.id===hoveredId);
  const destination=stages.find(stage=>stage.id===(hovered?stageForTaskId(hovered,stages):hoveredId));
  if(!destination)return null;
  const sourceStage=stageForTaskId(movingOriginal,stages);
  if(sourceStage===destination.id && (!hovered || hovered.id===movingId))return null;

  const next=items.map(task=>({...task}));
  const moving=next.find(task=>task.id===movingId)!;
  moving.stage_id=destination.id;
  moving.status=destination.category;
  const updates:{id:string;status:TaskStatus;stage_id:string|null;position:number}[]=[];

  for(const stageId of new Set([sourceStage,destination.id])){
    if(!stageId)continue;
    const group=next.filter(task=>task.id!==movingId && stageForTaskId(task,stages)===stageId)
      .sort((a,b)=>a.position-b.position);
    if(stageId===destination.id){
      const overIndex=hovered?group.findIndex(task=>task.id===hovered.id):-1;
      const sourceIndex=items.filter(task=>stageForTaskId(task,stages)===sourceStage)
        .sort((a,b)=>a.position-b.position).findIndex(task=>task.id===movingId);
      const targetIndex=hovered?items.filter(task=>stageForTaskId(task,stages)===destination.id)
        .sort((a,b)=>a.position-b.position).findIndex(task=>task.id===hovered.id):-1;
      const insertAfter=sourceStage===destination.id && sourceIndex<targetIndex;
      group.splice(overIndex<0?group.length:overIndex+(insertAfter?1:0),0,moving);
    }
    group.forEach((task,position)=>{
      task.position=position;
      updates.push({id:task.id,status:task.status,stage_id:task.stage_id??stageId,position});
    });
  }
  return {next,updates};
}
