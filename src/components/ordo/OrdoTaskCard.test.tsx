import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OrdoTaskCard, calculateSubtaskPercent } from "./OrdoTaskCard";

describe("all task stages behave identically",()=>{
  it("shows a stage named Done as neutral, not completed",()=>{
    const html=renderToStaticMarkup(createElement(OrdoTaskCard,{
      title:"Create IG account",stageName:"Done",status:"done",stageTheme:"lavender",
    }));
    expect(html).toContain("Done");
    expect(html).toContain("bg-[#F3EDFF]");
    expect(html).not.toContain("Task completed");
    expect(html).not.toContain('role="progressbar"');
  });

  it("shows task completion independently of stage name or legacy status",()=>{
    const html=renderToStaticMarkup(createElement(OrdoTaskCard,{
      title:"Build site",stageName:"Research",status:"backlog",completed:true,
    }));
    expect(html).toContain("Task completed");
    expect(html).toContain("Research");
    expect(html).not.toContain('role="progressbar"');
  });

  it("shows completion progress only for actual checklist items, themed by stage",()=>{
    const html=renderToStaticMarkup(createElement(OrdoTaskCard,{
      title:"Launch site",stageName:"Done",stageTheme:"forest",
      subtasks:{total:3,completed:2},
    }));
    expect(html).toContain("bg-[#EAF9F1]");
    expect(html).toContain("bg-[#10B981]");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain("2/3");
    expect(html).toContain("67%");
  });

  it("shows an unfinished-checklist warning only when task is explicitly completed",()=>{
    const html=renderToStaticMarkup(createElement(OrdoTaskCard,{
      title:"Work",stageName:"Review",completed:true,subtasks:{total:2,completed:1},
    }));
    expect(html).toContain("Completed with unfinished checklist items");
    const moved=renderToStaticMarkup(createElement(OrdoTaskCard,{
      title:"Work",stageName:"Done",subtasks:{total:2,completed:1},
    }));
    expect(moved).not.toContain("Completed with unfinished checklist items");
  });

  it("clamps invalid checklist counts and hides empty progress",()=>{
    expect(calculateSubtaskPercent(undefined)).toBeNull();
    expect(calculateSubtaskPercent({total:0,completed:0})).toBeNull();
    expect(calculateSubtaskPercent({total:4,completed:-10})).toBe(0);
    expect(calculateSubtaskPercent({total:4,completed:10})).toBe(100);
  });

  it("keeps labels editable directly on the card",()=>{
    const empty=renderToStaticMarkup(createElement(OrdoTaskCard,{
      title:"Outreach",stageName:"Custom",onEditLabels:()=>{},
    }));
    expect(empty).toContain("Add label");
    expect(empty).toContain("Add or edit labels for Outreach");
    const labeled=renderToStaticMarkup(createElement(OrdoTaskCard,{
      title:"Outreach",stageName:"Custom",labels:[{id:"a",name:"Marketing",color:"blue"}],onEditLabels:()=>{},
    }));
    expect(labeled).toContain("Marketing");
  });

  it("exposes an explicit completion control without changing stage",()=>{
    const html=renderToStaticMarkup(createElement(OrdoTaskCard,{
      title:"Anything",stageName:"Done",onToggleCompleted:()=>{},
    }));
    expect(html).toContain("Mark task complete");
    expect(html).toContain("Done");
  });
});
