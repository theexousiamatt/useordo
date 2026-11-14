import { describe, expect, it } from "vitest";
import { filterWorkTasks, workViewFor, type WorkTask } from "./myTasks";

const today = new Date(2026, 10, 14, 13);
const task = (id: string, due_date: string | null, completed_at: string | null = null): WorkTask => ({
  id, title: id, project_id: "p", due_date, completed_at, archived_at: null, assignee_id: null, position: 0,
});

describe("personal task view rules", () => {
  it("includes overdue work in Today without incorrectly marking tasks complete", () => {
    const list = [task("late", "2026-11-11"), task("today", "2026-11-14"), task("later", "2026-11-15")];
    expect(list.map((item) => workViewFor(item, today))).toEqual(["overdue", "today", "upcoming"]);
    expect(filterWorkTasks(list, new Map(), null, "today", false, today).map((item) => item.id))
      .toEqual(["late", "today"]);
  });
  it("includes team members assigned through the multi-assignee join table", () => {
    const list = [task("t1", "2026-11-14"), task("t2", "2026-11-14"), task("t3", "2026-11-14")];
    list[1].assignee_id = "mine";
    const assignees = new Map([["t1", ["other", "mine"]], ["t3", ["other"]]]);
    expect(filterWorkTasks(list, assignees, "mine", "today", true, today).map((item) => item.id))
      .toEqual(["t1", "t2"]);
  });
  it("excludes archived tasks and lists completed tasks independently of due date", () => {
    const done = task("done", "2026-11-13", "2026-11-14T08:00:00Z");
    const archived = task("archived", "2026-11-14");
    archived.archived_at = "2026-11-14T10:00:00Z";
    expect(filterWorkTasks([done, archived], new Map(), null, "today", false, today)).toEqual([]);
    expect(filterWorkTasks([done, archived], new Map(), null, "completed", false, today)).toEqual([done]);
  });
});
