import { afterEach, describe, expect, it, vi } from "vitest";
import { PointerSensor } from "@dnd-kit/core";
import { BOARD_POINTER_OPTIONS, boardKeyboardCoordinates } from "./boardSensors";

afterEach(() => { if (vi.isFakeTimers()) { vi.runAllTimers(); vi.useRealTimers(); } document.body.replaceChildren(); });

// PointerSensor handles mouse, pen and touch through the browser Pointer Events API.
// These tests exercise its real threshold, movement and completion,
// without pretending jsdom simulates a physical touch device or layout.
describe("retained board input sensors", () => {
  for (const pointerType of ["mouse", "touch"]) it(`activates and finishes ${pointerType} pointer movement`, () => {
    vi.useFakeTimers();
    const handle = document.createElement("button");document.body.append(handle);
    const event = (type: string, x: number) => {
      const value = new MouseEvent(type, {bubbles:true,cancelable:true,clientX:x,clientY:10,button:0});
      Object.defineProperties(value, {pointerType:{value:pointerType},isPrimary:{value:true},pointerId:{value:1}});
      return value;
    };
    const down=event("pointerdown",10);handle.dispatchEvent(down);
    const onStart=vi.fn(),onMove=vi.fn(),onEnd=vi.fn(),onCancel=vi.fn();
    type Props=ConstructorParameters<typeof PointerSensor>[0];
    new PointerSensor({active:"task-a",event:down,options:BOARD_POINTER_OPTIONS,
      // PointerSensor does not consume sortable context; the rendered board supplies it.
      context:{current:{} as Props["context"]["current"]},
      activeNode:{id:"task-a",key:"task-a",node:{current:handle},activatorNode:{current:handle},data:{current:{}}},
      onStart,onMove,onEnd,onCancel,onPending:vi.fn(),onAbort:vi.fn()});
    document.dispatchEvent(event("pointermove",15));expect(onStart).not.toHaveBeenCalled();
    document.dispatchEvent(event("pointermove",30));expect(onStart).toHaveBeenCalledOnce();
    document.dispatchEvent(event("pointermove",50));expect(onMove).toHaveBeenCalledWith({x:50,y:10});
    document.dispatchEvent(event("pointerup",50));expect(onEnd).toHaveBeenCalledOnce();expect(onCancel).not.toHaveBeenCalled();
  });

  it("provides a horizontal destination for an empty column", () => {
    type Context=Parameters<typeof boardKeyboardCoordinates>[1]["context"];
    const rect={left:10,top:20,width:300,height:400,right:310,bottom:420};
    const context={active:null,collisionRect:null,droppableContainers:{getEnabled:()=>[{id:"backlog",data:{current:{empty:true}}}]},droppableRects:new Map([["backlog",rect]])} as unknown as Context;
    const destination=boardKeyboardCoordinates(new KeyboardEvent("keydown",{code:"ArrowLeft",cancelable:true}), {active:"task-a",currentCoordinates:{x:330,y:70},context});
    expect(destination).toEqual({x:26,y:76});
  });
});
