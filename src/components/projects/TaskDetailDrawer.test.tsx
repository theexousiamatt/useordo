import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskRow } from "@/hooks/useProjectData";
import { TaskDetailDrawer } from "./TaskDetailDrawer";

const mocks = vi.hoisted(() => ({
  add: vi.fn(), deleteComment: vi.fn(), commentsError: false,
  refetchComments: vi.fn(), activityError: false,
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "me" } }) }));
vi.mock("@/hooks/useProjectData", () => ({
  useTaskAssignees: () => ({ data: new Map() }),
  useProjectActivity: () => ({ data: [], isLoading: false, isError: mocks.activityError, refetch: vi.fn() }),
}));
vi.mock("@/hooks/useLabels", () => ({
  useProjectLabels: () => ({ data: [] }), useTaskLabelMap: () => ({ data: new Map() }),
  useSetTaskLabels: () => ({ mutate: vi.fn() }), useCreateLabel: () => ({ mutate: vi.fn() }),
  useUpdateLabel: () => ({ mutate: vi.fn() }), useDeleteLabel: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/hooks/useTaskComments", () => ({
  useTaskComments: () => ({ data: [], isLoading: false, isError: mocks.commentsError, refetch: mocks.refetchComments }),
  useAddTaskComment: () => ({ mutateAsync: mocks.add, isPending: false }),
  useDeleteTaskComment: () => ({ mutate: mocks.deleteComment, isPending: false }),
}));
vi.mock("./TaskAttachmentsSection", () => ({ TaskAttachmentsSection: () => <div>Attachment section</div> }));
vi.mock("@/components/ordo", () => ({ InlineDatePicker: () => null, InlineLabelPicker: () => null, InlineMemberPicker: () => null }));
const task = { id: "task-1", project_id: "project-1", workspace_id: "workspace-1", title: "Review concepts", description: "Original brief", status: "todo", assignee_id: null, due_date: null } as TaskRow;
function show(extra: Partial<React.ComponentProps<typeof TaskDetailDrawer>> = {}) {
  const onPatch = vi.fn().mockResolvedValue(undefined);
  const onOpenChange = vi.fn();
  const props = { task, members: [], open: true, onOpenChange, onPatch, onSetAssignees: vi.fn(), canEdit: true, ...extra };
  const result = render(<TaskDetailDrawer {...props} />);
  return { ...result, props, onPatch, onOpenChange };
}
function tab(name: string) { fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0, ctrlKey: false }); }
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); mocks.commentsError = false; mocks.activityError = false; mocks.add.mockResolvedValue(undefined); vi.spyOn(window, "confirm").mockReturnValue(false); });
describe("task detail recovery", () => {
  it("explains a removed or inaccessible task instead of presenting an empty sheet", () => {
    const { onOpenChange } = show({ task: null });
    expect(screen.getByRole("heading", { name: "Task unavailable" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to board" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
  it("keeps a failed title edit and allows a retry", async () => {
    const patch = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    show({ onPatch: patch });
    const title = screen.getByRole("textbox", { name: "Task title" });
    fireEvent.change(title, { target: { value: "Refine concepts" } });
    fireEvent.blur(title);
    await screen.findByText(/Changes could not be saved/);
    expect(title).toHaveValue("Refine concepts");
    fireEvent.keyDown(title, { key: "Enter" });
    await screen.findByText("Saved");
    expect(patch).toHaveBeenCalledTimes(2);
  });
  it("does not close while saving a description, then permits closing after success", async () => {
    let finish!: () => void;
    const patch = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const { onOpenChange } = show({ onPatch: patch });
    fireEvent.change(screen.getByRole("textbox", { name: "Description" }), { target: { value: "Refined brief" } });
    fireEvent.click(screen.getByRole("button", { name: "Save description" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByText(/Please wait for your changes/)).toBeInTheDocument();
    await act(async () => { finish(); });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
  it("retains comment drafts across tabs and reports a send failure", async () => {
    mocks.add.mockRejectedValueOnce(new Error("offline"));
    show();
    tab("Comments");
    fireEvent.change(screen.getByRole("textbox", { name: "Comment" }), { target: { value: "Please review version two." } });
    tab("Overview");
    tab("Comments");
    expect(screen.getByRole("textbox", { name: "Comment" })).toHaveValue("Please review version two.");
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));
    await screen.findByText(/Your comment could not be sent/);
    expect(screen.getByRole("textbox", { name: "Comment" })).toHaveValue("Please review version two.");
    await waitFor(() => expect(screen.getByRole("button", { name: "Comment" })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(window.confirm).toHaveBeenCalled();
  });
  it("shows a comments failure with a retry instead of the empty state", () => {
    mocks.commentsError = true;
    show(); tab("Comments");
    expect(screen.getByRole("heading", { name: "Couldn’t load comments" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mocks.refetchComments).toHaveBeenCalled();
  });
  it("routes status changes through ordered movement and hides editing for read-only access", async () => {
    const move = vi.fn().mockResolvedValue(undefined);
    const { props, rerender, onPatch } = show({ onMoveStatus: move });
    fireEvent.change(screen.getByRole("combobox", { name: "Task status" }), { target: { value: "done" } });
    await waitFor(() => expect(move).toHaveBeenCalledWith(task, "done"));
    expect(onPatch).not.toHaveBeenCalled();
    rerender(<TaskDetailDrawer {...props} canEdit={false} />);
    expect(screen.queryByRole("textbox", { name: "Task title" })).not.toBeInTheDocument();
    tab("Comments");
    expect(screen.queryByRole("textbox", { name: "Comment" })).not.toBeInTheDocument();
  });
});
