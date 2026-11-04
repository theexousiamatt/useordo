import { describe, expect, it } from "vitest";
import { moveBoardTask, moveBoardTasksToStatus, restoreBoardMove, boardReadingOrder } from "./boardOrder";
import { EMPTY_BOARD_FILTERS, filterBoardTasks, hasBoardFilters, type BoardFilters } from "./boardFilters";
import type { TaskRow } from "@/hooks/useProjectData";

const task = (id: string, status: TaskRow["status"], position: number, extra: Partial<TaskRow> = {}): TaskRow => ({
  id, status, position, title: id, description: null, due_date: null, assignee_id: null,
  project_id: "project", workspace_id: "agency", created_by: null, archived_at: null,
  created_at: "2026-10-01T00:00:00Z", updated_at: `2026-10-01T00:00:0${position}Z`, ...extra,
});

describe("project board ordering", () => {
  it("inserts between tasks without replacing the order of another column", () => {
    const rows = [task("a", "todo", 0), task("b", "todo", 1), task("c", "todo", 2), task("d", "done", 0)];
    const result = moveBoardTask(rows, "c", "a", true)!;
    expect(result.tasks.filter((row) => row.status === "todo").sort((a, b) => a.position - b.position).map((row) => row.id)).toEqual(["a", "c", "b"]);
    expect(result.updates).toHaveLength(3);
    expect(result.tasks.find((row) => row.id === "d")?.position).toBe(0);
    expect(result.updates[0].expected_updated_at).toBe(rows.find((row) => row.id === result.updates[0].id)?.updated_at);
  });

  it("moves into an empty column and closes the source gap", () => {
    const result = moveBoardTask([task("a", "todo", 0), task("b", "todo", 1)], "a", "review")!;
    expect(result.tasks.find((row) => row.id === "a")).toMatchObject({ status: "review", position: 0 });
    expect(result.tasks.find((row) => row.id === "b")).toMatchObject({ status: "todo", position: 0 });
  });

  it("ignores invalid targets and a self drop", () => {
    expect(moveBoardTask([task("a", "todo", 0)], "a", "missing")).toBeNull();
    expect(moveBoardTask([task("a", "todo", 0)], "a", "a")).toBeNull();
  });
});

describe("board filters", () => {
  const rows = [
    task("a", "todo", 0, { title: "Prepare the launch", assignee_id: "alex", due_date: "2026-10-20" }),
    task("b", "done", 0, { title: "Review launch", due_date: "2026-10-18" }),
    task("c", "todo", 1, { title: "Client handoff" }),
  ];
  it("combines text, assignment, status and label filters", () => {
    const filters = { ...EMPTY_BOARD_FILTERS, query: "launch", assignee: "alex", status: "todo" as const, label: "urgent" };
    expect(filterBoardTasks(rows, filters, new Map([["a", ["alex"]]]), new Map([["a", ["urgent"]]]))).toEqual([rows[0]]);
  });
  it("keeps completed tasks out of overdue work and distinguishes no date", () => {
    expect(filterBoardTasks(rows, { ...EMPTY_BOARD_FILTERS, due: "overdue" }, undefined, undefined, "2026-10-25").map((row) => row.id)).toEqual(["a"]);
    expect(filterBoardTasks(rows, { ...EMPTY_BOARD_FILTERS, due: "none" }, undefined, undefined, "2026-10-25").map((row) => row.id)).toEqual(["c"]);
  });
});


describe("board recovery", () => {
  it("undoes a move from legacy positions with gaps without erasing metadata edits", () => {
    const before = [task("a", "todo", 4), task("b", "todo", 7), task("c", "done", 3)];
    const moved = moveBoardTask(before, "a", "done")!;
    const current = moved.tasks.map(row => ({ ...row, updated_at: "2026-10-25T01:00:00Z", title: row.id === "b" ? "Updated title" : row.title }));
    const restored = restoreBoardMove(before, current, moved)!;
    expect(restored.tasks.find(row => row.id === "a")).toMatchObject({ status: "todo", position: 0 });
    expect(restored.tasks.find(row => row.id === "b")).toMatchObject({ title: "Updated title", position: 1 });
    expect(restored.updates.every(row => row.expected_updated_at === "2026-10-25T01:00:00Z")).toBe(true);
  });
  it("refuses undo when another card enters an affected column", () => {
    const before = [task("a", "todo", 0), task("b", "done", 0)];
    const moved = moveBoardTask(before, "a", "done")!;
    expect(restoreBoardMove(before, [...moved.tasks, task("c", "todo", 0)], moved)).toBeNull();
  });
  it("bulk status moves append in reading order and preserve other tasks' relative order", () => {
    const before = [task("a", "todo", 0), task("b", "todo", 1), task("c", "review", 0), task("d", "done", 0)];
    const moved = moveBoardTasksToStatus(before, ["c", "a"], "done")!;
    expect(boardReadingOrder(moved.tasks).map(row => row.id)).toEqual(["b", "d", "a", "c"]);
    expect(moved.updates.filter(row => row.status === "done").map(row => row.position)).toEqual([0, 1, 2]);
  });
  it("orders filtered selection by visible columns", () => {
    const before = [task("done", "done", 0), task("hidden", "todo", 0), task("backlog", "backlog", 2)];
    expect(boardReadingOrder(before.filter(row => row.id !== "hidden")).map(row => row.id)).toEqual(["backlog", "done"]);
  });
});

describe("board due filters", () => {
  const rows = [
    task("monday", "review", 0, { title: "Launch copy", due_date: "2026-11-02", assignee_id: "alex" }),
    task("today", "review", 1, { title: "Launch design", due_date: "2026-11-03", assignee_id: "sam" }),
    task("sunday", "review", 2, { title: "Launch handoff", due_date: "2026-11-08", assignee_id: "alex" }),
    task("next-week", "review", 3, { title: "Launch campaign", due_date: "2026-11-09", assignee_id: "alex" }),
    task("other-person", "review", 4, { title: "Launch assets", due_date: "2026-11-03", assignee_id: "sam" }),
    task("other-label", "review", 5, { title: "Launch QA", due_date: "2026-11-03", assignee_id: "alex" }),
    task("other-status", "todo", 0, { title: "Launch brief", due_date: "2026-11-03", assignee_id: "alex" }),
    task("no-date", "review", 6, { title: "Launch follow-up", assignee_id: "alex" }),
  ];
  const assignees = new Map([["today", ["sam", "alex"]]]);
  const labels = new Map(rows.filter((row) => row.id !== "other-label").map((row) => [row.id, ["urgent"]]));
  const combined: BoardFilters = { ...EMPTY_BOARD_FILTERS, query: "launch", assignee: "alex", status: "review", label: "urgent" };
  const matchingIds = (filters: BoardFilters) => filterBoardTasks(rows, filters, assignees, labels, "2026-11-03").map((row) => row.id);

  it("combines due today with multi-assignment, search, status and labels", () => {
    expect(matchingIds({ ...combined, due: "today" })).toEqual(["today"]);
  });

  it("keeps the calendar week's Monday and Sunday while preserving the other filters", () => {
    expect(matchingIds({ ...combined, due: "this-week" })).toEqual(["monday", "today", "sunday"]);
  });

  it("passes both inclusive custom boundaries through the board filter", () => {
    expect(matchingIds({ ...combined, due: "custom", dueFrom: "2026-11-03", dueTo: "2026-11-08" })).toEqual(["today", "sunday"]);
    expect(matchingIds({ ...combined, due: "custom", dueFrom: "2026-11-08", dueTo: "2026-11-03" })).toEqual([]);
  });

  it("supports an open-ended range and ignores saved dates after clearing the due filter", () => {
    expect(matchingIds({ ...combined, due: "custom", dueFrom: "2026-11-08" })).toEqual(["sunday", "next-week"]);
    const inactiveRange = { ...EMPTY_BOARD_FILTERS, dueFrom: "2026-11-08", dueTo: "2026-11-09" };
    expect(filterBoardTasks(rows, inactiveRange, assignees, labels, "2026-11-03")).toEqual(rows);
    expect(hasBoardFilters(inactiveRange)).toBe(false);
    expect(hasBoardFilters({ ...EMPTY_BOARD_FILTERS, due: "today" })).toBe(true);
    expect(hasBoardFilters({ ...EMPTY_BOARD_FILTERS, due: "this-week" })).toBe(true);
    expect(hasBoardFilters({ ...EMPTY_BOARD_FILTERS, due: "custom" })).toBe(true);
    expect(hasBoardFilters(EMPTY_BOARD_FILTERS)).toBe(false);
  });
});
