import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TaskRow } from "@/hooks/useProjectData";
import { TaskDescriptionSection } from "./TaskDetailDrawer";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const task = (description: string | null): TaskRow => ({
  id: "task-1", project_id: "project-1", workspace_id: "workspace-1",
  title: "Create brand assets", description, status: "todo", stage_id: "stage-1",
  completed_at: null, archived_at: null, due_date: null, position: 0,
  assignee_id: null, created_by: null, created_at: "", updated_at: "",
});

describe("task drawer description: direct editing", () => {
  it("starts compact and opens an editor with one click", () => {
    const onSaveDescription = vi.fn();
    render(<TaskDescriptionSection task={task(null)} onSaveDescription={onSaveDescription} />);
    expect(screen.getByRole("button", { name: "Add a description" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Task description" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add a description" }));
    expect(screen.getByRole("textbox", { name: "Task description" })).toBeInTheDocument();
    expect(onSaveDescription).not.toHaveBeenCalled();
  });

  it("saves edits on blur without opening another menu", () => {
    const onSaveDescription = vi.fn();
    render(<TaskDescriptionSection task={task("Brief")} onSaveDescription={onSaveDescription} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit task description" }));
    const textarea = screen.getByRole("textbox", { name: "Task description" });
    fireEvent.change(textarea, { target: { value: "  Revised brief  " } });
    fireEvent.blur(textarea);
    expect(onSaveDescription).toHaveBeenCalledTimes(1);
    expect(onSaveDescription).toHaveBeenCalledWith("task-1", "Revised brief");
  });

  it("supports Ctrl+Enter save and Escape cancel without data loss", () => {
    const onSaveDescription = vi.fn();
    render(<TaskDescriptionSection task={task("Original description")} onSaveDescription={onSaveDescription} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit task description" }));
    let textarea = screen.getByRole("textbox", { name: "Task description" });
    fireEvent.change(textarea, { target: { value: "Draft not saved" } });
    fireEvent.keyDown(textarea, { key: "Escape" });
    expect(onSaveDescription).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Edit task description" })).toHaveTextContent("Original description");
    fireEvent.click(screen.getByRole("button", { name: "Edit task description" }));
    textarea = screen.getByRole("textbox", { name: "Task description" });
    fireEvent.change(textarea, { target: { value: "Approved changes" } });
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });
    expect(onSaveDescription).toHaveBeenCalledOnce();
    expect(onSaveDescription).toHaveBeenCalledWith("task-1", "Approved changes");
  });

  it("avoids writes when content was not modified", () => {
    const onSaveDescription = vi.fn();
    render(<TaskDescriptionSection task={task("Unchanged")} onSaveDescription={onSaveDescription} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit task description" }));
    fireEvent.blur(screen.getByRole("textbox", { name: "Task description" }));
    expect(onSaveDescription).not.toHaveBeenCalled();
  });
});
