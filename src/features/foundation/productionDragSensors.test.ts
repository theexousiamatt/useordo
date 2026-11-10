import {expect,it} from "vitest";
import {productionCollision,productionKeyboard,productionDropBefore} from "./productionDragSensors";
it("cancels a pointer drop outside all board targets instead of moving to the nearest column",()=>{
 const args={active:{id:"task-a"},pointerCoordinates:{x:1000,y:1000},collisionRect:{left:0,top:0,right:20,bottom:20,width:20,height:20},droppableContainers:[{id:"column:a",data:{current:{columnId:"a"}}}],droppableRects:new Map([["column:a",{left:0,top:0,right:100,bottom:100,width:100,height:100}]])} as unknown as Parameters<typeof productionCollision>[0];
 expect(productionCollision(args)).toEqual([]);
});
it("provides keyboard access to empty canonical columns without fixed stage names",()=>{
 const context={active:{id:"task-a"},collisionRect:{left:0,top:0},droppableContainers:{getEnabled:()=>[{id:"column:custom",data:{current:{columnId:"custom"}}}]},droppableRects:new Map([["column:custom",{left:200,top:0,width:100,height:200}]])} as unknown as Parameters<typeof productionKeyboard>[1]["context"];
 expect(productionKeyboard(new KeyboardEvent("keydown",{code:"ArrowRight",cancelable:true}),{active:"task-a",currentCoordinates:{x:0,y:0},context})).toEqual({x:216,y:56});
});

it("reorders downward after a sibling and upward before it while excluding archived rows",()=>{
 const tasks=[{id:"a",column_id:"c",archived_at:null},{id:"archived",column_id:"c",archived_at:"2026-11-10"},{id:"b",column_id:"c",archived_at:null},{id:"c",column_id:"c",archived_at:null}];
 expect(productionDropBefore(tasks,tasks[0],{columnId:"c",taskId:"b"})).toBe("c");
 expect(productionDropBefore(tasks,tasks[3],{columnId:"c",taskId:"a"})).toBe("a");
 expect(productionDropBefore(tasks,tasks[0],{columnId:"c",taskId:"c"})).toBeNull();
});
