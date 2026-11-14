import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OrdoTaskCard, calculateSubtaskPercent } from "./OrdoTaskCard";

describe("task card progress only from real subtasks", () => {
  it("hides all progress for tasks with no subtasks, including Done tasks", () => {
    const done = renderToStaticMarkup(createElement(OrdoTaskCard, {
      title: "Create IG account", status: "done", stageTheme: "ocean",
    }));
    expect(done).toContain("bg-[#EBF4FF]");
    expect(done).toContain("Done");
    expect(done).not.toContain('role="progressbar"');
    expect(done).not.toContain("100%");
    const empty = renderToStaticMarkup(createElement(OrdoTaskCard, {
      title: "No subtasks", status: "in_progress", subtasks: { total: 0, completed: 0 },
    }));
    expect(empty).not.toContain('role="progressbar"');
  });

  it("renders percentage, completed count and theme accent for real subtasks", () => {
    const html = renderToStaticMarkup(createElement(OrdoTaskCard, {
      title: "Launch site", status: "todo", stageTheme: "forest",
      subtasks: { total: 3, completed: 2 },
    }));
    expect(html).toContain("bg-[#EAF9F1]");
    expect(html).toContain("bg-[#10B981]");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain("2/3");
    expect(html).toContain("67%");
  });

  it("clamps impossible counts and ignores zero/undefined totals", () => {
    expect(calculateSubtaskPercent(undefined)).toBeNull();
    expect(calculateSubtaskPercent({ total: 0, completed: 0 })).toBeNull();
    expect(calculateSubtaskPercent({ total: 4, completed: -10 })).toBe(0);
    expect(calculateSubtaskPercent({ total: 4, completed: 10 })).toBe(100);
    expect(calculateSubtaskPercent({ total: 4, completed: 1 })).toBe(25);
  });

  it("keeps task-label editing on the card, including when no labels exist", () => {
    const empty = renderToStaticMarkup(createElement(OrdoTaskCard, {
      title: "Outreach", status: "todo", onEditLabels: () => {},
    }));
    expect(empty).toContain("Add label");
    expect(empty).toContain("Add or edit labels for Outreach");
    const labeled = renderToStaticMarkup(createElement(OrdoTaskCard, {
      title: "Outreach", status: "todo",
      labels: [{ id: "a", name: "Marketing", color: "blue" }],
      onEditLabels: () => {},
    }));
    expect(labeled).toContain("Marketing");
    expect(labeled).toContain("Add or edit labels for Outreach");
    expect(labeled).not.toContain("Add label");
  });

  it("preserves independent stage-colour skins and task status", () => {
    const todo = renderToStaticMarkup(createElement(OrdoTaskCard, {
      title: "Write brief", status: "todo", stageTheme: "forest",
    }));
    const done = renderToStaticMarkup(createElement(OrdoTaskCard, {
      title: "Write brief", status: "done", stageTheme: "forest",
    }));
    expect(todo).toContain("bg-[#EAF9F1]");
    expect(done).toContain("bg-[#EAF9F1]");
    expect(todo).toContain("To do");
    expect(done).toContain("Done");
  });
});
