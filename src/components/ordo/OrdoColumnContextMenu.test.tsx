import { describe, expect, it, vi } from "vitest";
import { buildColumnMenuConfig, type ColumnMenuHandlers } from "./OrdoColumnContextMenu";

function makeHandlers(): ColumnMenuHandlers {
  return {
    onAddTask: vi.fn(),
    onToggleCollapse: vi.fn(),
    onAction: vi.fn(),
  };
}

describe("project stage actions", () => {
  it("offers working stage removal when two columns remain", () => {
    const handlers = makeHandlers();
    const config = buildColumnMenuConfig("stage-1", false, handlers, true, true);
    const action = config.flatMap((section) => section.items).find((item) => item.id === "delete");

    expect(action).toMatchObject({ label: "Remove stage", disabled: false, destructive: true });
    action?.onSelect?.();
    expect(handlers.onAction).toHaveBeenCalledWith("stage-1", "Remove stage");
  });

  it("keeps the final column and avoids dead-end actions", () => {
    const config = buildColumnMenuConfig("last", false, makeHandlers(), true, false);
    const items = config.flatMap((section) => section.items);
    expect(items.find((item) => item.id === "delete")?.disabled).toBe(true);
    expect(items.some((item) => item.ai || item.label.includes("coming soon"))).toBe(false);
  });

  it("hides management actions from members who cannot configure stages", () => {
    const config = buildColumnMenuConfig("stage-1", true, makeHandlers(), false, true);
    const items = config.flatMap((section) => section.items);
    expect(items.map((item) => item.id)).toEqual(["add", "collapse"]);
    expect(items.find((item) => item.id === "collapse")?.label).toBe("Expand stage");
  });
});
