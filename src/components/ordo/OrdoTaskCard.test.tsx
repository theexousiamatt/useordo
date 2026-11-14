import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OrdoTaskCard } from "./OrdoTaskCard";

describe("task cards inherit stage themes", () => {
  it("uses the ocean card appearance without changing the Done status badge", () => {
    const html = renderToStaticMarkup(createElement(OrdoTaskCard, {
      title: "Create IG account", status: "done", stageTheme: "ocean", progress: 100,
    }));
    expect(html).toContain("bg-[#EBF4FF]");
    expect(html).toContain("bg-[#3B82F6]");
    expect(html).toContain("bg-emerald-100");
    expect(html).toContain("Done");
    expect(html).toContain("100%");
  });

  it("applies one stage theme to tasks in different task statuses", () => {
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
