import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskComposer } from "./TaskComposer";

const notify = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("sonner", () => ({ toast: notify }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("mobile task creation", () => {
  it("has accessible 44px touch targets, is not a draggable card, and keeps the Add hit area isolated", () => {
    const parentPointer = vi.fn();
    const parentClick = vi.fn();
    render(
      <div onPointerDown={parentPointer} onClick={parentClick}>
        <TaskComposer stageName="Backlog" onAdd={vi.fn().mockResolvedValue(undefined)} onCancel={vi.fn()} />
      </div>,
    );

    const form = screen.getByRole("form", { name: "New task in Backlog" });
    const add = screen.getByRole("button", { name: "Add" });
    const cancel = screen.getByRole("button", { name: "Cancel" });

    expect(form).toHaveClass("relative", "z-20", "isolate", "pointer-events-auto");
    expect(add).toHaveClass("min-h-11", "touch-manipulation");
    expect(cancel).toHaveClass("min-h-11", "touch-manipulation");
    expect(screen.getByRole("textbox", { name: "Task title" })).toHaveClass("min-h-11");
    fireEvent.pointerDown(add);
    fireEvent.click(add);
    expect(parentPointer).not.toHaveBeenCalled();
    expect(parentClick).not.toHaveBeenCalled();
  });

  it("creates once via native form submit and closes after database success", async () => {
    let resolve!: () => void;
    const pending = new Promise<void>(r => { resolve = r; });
    const onAdd = vi.fn().mockReturnValue(pending);
    const onCancel = vi.fn();
    render(<TaskComposer stageName="Review" onAdd={onAdd} onCancel={onCancel} />);
    const input = screen.getByRole("textbox", { name: "Task title" });
    fireEvent.change(input, { target: { value: "  Create mobile task  " } });
    fireEvent.submit(screen.getByRole("form", { name: "New task in Review" }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith("Create mobile task");
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Adding…" })).toBeDisabled();
    resolve();
    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
  });

  it("preserves the title on a failed request so a second tap can retry", async () => {
    const onAdd = vi.fn()
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce(undefined);
    const onCancel = vi.fn();
    render(<TaskComposer stageName="Research" onAdd={onAdd} onCancel={onCancel} />);
    const input = screen.getByRole("textbox", { name: "Task title" });
    fireEvent.change(input, { target: { value: "My draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(notify.error).toHaveBeenCalledTimes(1));
    expect(input).toHaveValue("My draft");
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
    expect(onAdd).toHaveBeenCalledTimes(2);
  });

  it("supports an accessible Cancel button and Escape key without accidentally submitting", () => {
    const onAdd = vi.fn();
    const onCancel = vi.fn();
    const view = render(<TaskComposer stageName="Design" onAdd={onAdd} onCancel={onCancel} />);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Task title" }), { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    view.rerender(<TaskComposer stageName="Design" onAdd={onAdd} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onAdd).not.toHaveBeenCalled();
  });
});
