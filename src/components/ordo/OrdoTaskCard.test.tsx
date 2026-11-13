import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OrdoTaskCard } from "./OrdoTaskCard";

describe("task cards inherit board themes", () => {
  it("uses the ocean card appearance without changing the Done status badge", () => {
    const html = renderToStaticMarkup(createElement(OrdoTaskCard, {
      title: "Create IG account", status: "done", boardTheme: "ocean", progress: 100,
    }));
    expect(html).toContain("bg-[#EBF4FF]");
    expect(html).toContain("bg-[#3B82F6]");
    expect(html).toContain("bg-emerald-100");
    expect(html).toContain("Done");
    expect(html).toContain("100%");
  });

  it("applies one board theme to tasks in different workflow stages", () => {
    const todo = renderToStaticMarkup(createElement(OrdoTaskCard, {
      title: "Write brief", status: "todo", boardTheme: "forest",
    }));
    const done = renderToStaticMarkup(createElement(OrdoTaskCard, {
      title: "Write brief", status: "done", boardTheme: "forest",
    }));
    expect(todo).toContain("bg-[#EAF9F1]");
    expect(done).toContain("bg-[#EAF9F1]");
    expect(todo).toContain("To do");
    expect(done).toContain("Done");
  });
});
