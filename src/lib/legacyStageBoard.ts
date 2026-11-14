import type { TaskRow } from "@/hooks/useProjectData";

export type BoardStage = { id:string; position:number };
export type BoardTask = Pick<TaskRow,"id"|"stage_id"|"position">;

/** Legacy tasks without a stage appear in the first stage; never infer from names/status. */
export function stageForTaskId(task:BoardTask,stages:readonly BoardStage[]):string|undefined {
  if(task.stage_id && stages.some(stage=>stage.id===task.stage_id))return task.stage_id;
  return [...stages].sort((a,b)=>a.position-b.position)[0]?.id;
}

/** Dropping a column on another column puts it after when moving right. */
export function stageInsertBefore(stages:readonly BoardStage[],sourceId:string,targetId:string):string|null {
  const ordered=[...stages].sort((a,b)=>a.position-b.position);
  const from=ordered.findIndex(stage=>stage.id===sourceId);
  const to=ordered.findIndex(stage=>stage.id===targetId);
  if(from<0 || to<0 || from===to)return null;
  return from<to ? ordered[to+1]?.id ?? null : targetId;
}

/** Choose a nearby surviving stage so removing a column is one click, not a blocked form. */
export function stageRemovalDestination(stages: readonly BoardStage[], stageId: string): string | null {
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  const index = ordered.findIndex((stage) => stage.id === stageId);
  if (index < 0 || ordered.length <= 1) return null;
  return (ordered[index + 1] ?? ordered[index - 1]).id;
}

/** Empty stages need no transfer controls; zero counts still require a confirmation. */
export function hasStageTasks(taskCount: number | null | undefined): boolean {
  return typeof taskCount === "number" && taskCount > 0;
}

/** A choice is optional; the backend always receives a valid surviving stage for safety. */
export function resolveStageRemovalDestination(
  stages: readonly BoardStage[],
  removingId: string,
  chosenId?: string | null,
): string | null {
  if (chosenId && chosenId !== removingId &&
      stages.some((stage) => stage.id === chosenId)) return chosenId;
  return stageRemovalDestination(stages, removingId);
}

export function moveTaskWithinStages<T extends BoardTask>(
  items:readonly T[],stages:readonly BoardStage[],movingId:string,hoveredId:string,
):{next:T[];updates:{id:string;stage_id:string|null;position:number}[]}|null {
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
  const updates:{id:string;stage_id:string|null;position:number}[]=[];

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
      updates.push({id:task.id,stage_id:task.stage_id??stageId,position});
    });
  }
  return {next,updates};
}
