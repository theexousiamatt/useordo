import { afterEach, describe, expect, it, vi } from "vitest";
import { matchesTaskDueDate, taskWeekRange, type TaskDueFilter } from "./taskDueDates";

const task = (due_date: string | null, status = "todo") => ({ due_date, status });
const today = "2026-11-03";

afterEach(() => vi.useRealTimers());

describe("task calendar weeks", () => {
  it.each([
    ["2026-11-02", "2026-11-02", "2026-11-08"], // Monday
    ["2026-11-08", "2026-11-02", "2026-11-08"], // Sunday
    ["2026-11-01", "2026-10-26", "2026-11-01"], // Month boundary
    ["2027-01-01", "2026-12-28", "2027-01-03"], // Year boundary
    ["2028-02-29", "2028-02-28", "2028-03-05"], // Leap day
  ])("uses the Monday–Sunday week containing %s", (date, from, to) => {
    expect(taskWeekRange(date)).toEqual({ from, to });
  });

  it("uses the local calendar near midnight for the default date", () => {
    // A local constructor deliberately avoids interpreting a date-only value as UTC.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 1, 23, 30));
    expect(taskWeekRange()).toEqual({ from: "2026-10-26", to: "2026-11-01" });
    expect(matchesTaskDueDate(task("2026-11-01"), "today")).toBe(true);
    expect(matchesTaskDueDate(task("2026-11-02"), "today")).toBe(false);
  });
});

describe("task due-date presets", () => {
  it("preserves all tasks and includes completed undated tasks under no date", () => {
    for (const row of [task(null), task(null, "done"), task("2026-11-03", "done")]) {
      expect(matchesTaskDueDate(row, "all", {}, today)).toBe(true);
    }
    expect(matchesTaskDueDate(task(null), "none", {}, today)).toBe(true);
    expect(matchesTaskDueDate(task(null, "done"), "none", {}, today)).toBe(true);
    expect(matchesTaskDueDate(task(today), "none", {}, today)).toBe(false);
  });

  it.each<TaskDueFilter>(["overdue", "today", "this-week", "upcoming", "custom"])(
    "excludes completed tasks from %s",
    (filter) => {
      expect(matchesTaskDueDate(task("2026-11-02", "done"), filter, {}, today)).toBe(false);
      expect(matchesTaskDueDate(task(today, "done"), filter, {}, today)).toBe(false);
      expect(matchesTaskDueDate(task(null, "done"), filter, {}, today)).toBe(false);
    },
  );

  it("counts only dates before today as overdue", () => {
    expect(matchesTaskDueDate(task("2026-11-02"), "overdue", {}, today)).toBe(true);
    expect(matchesTaskDueDate(task(today), "overdue", {}, today)).toBe(false);
    expect(matchesTaskDueDate(task("2026-11-04"), "overdue", {}, today)).toBe(false);
    expect(matchesTaskDueDate(task(null), "overdue", {}, today)).toBe(false);
  });

  it("matches today's date without treating an undated task as due", () => {
    expect(matchesTaskDueDate(task(today), "today", {}, today)).toBe(true);
    expect(matchesTaskDueDate(task("2026-11-02"), "today", {}, today)).toBe(false);
    expect(matchesTaskDueDate(task("2026-11-04"), "today", {}, today)).toBe(false);
    expect(matchesTaskDueDate(task(null), "today", {}, today)).toBe(false);
  });

  it("includes both week boundaries and earlier open work in the current week", () => {
    for (const date of ["2026-11-02", today, "2026-11-08"]) {
      expect(matchesTaskDueDate(task(date), "this-week", {}, today)).toBe(true);
    }
    for (const date of ["2026-11-01", "2026-11-09", null]) {
      expect(matchesTaskDueDate(task(date), "this-week", {}, today)).toBe(false);
    }
  });

  it("keeps upcoming inclusive of today", () => {
    expect(matchesTaskDueDate(task(today), "upcoming", {}, today)).toBe(true);
    expect(matchesTaskDueDate(task("2027-01-01"), "upcoming", {}, today)).toBe(true);
    expect(matchesTaskDueDate(task("2026-11-02"), "upcoming", {}, today)).toBe(false);
    expect(matchesTaskDueDate(task(null), "upcoming", {}, today)).toBe(false);
  });
});

describe("custom task due-date ranges", () => {
  it("includes both endpoints and excludes dates outside them", () => {
    const range = { from: "2026-11-03", to: "2026-11-05" };
    for (const date of [range.from, "2026-11-04", range.to]) {
      expect(matchesTaskDueDate(task(date), "custom", range, today)).toBe(true);
    }
    for (const date of ["2026-11-02", "2026-11-06", null]) {
      expect(matchesTaskDueDate(task(date), "custom", range, today)).toBe(false);
    }
    expect(matchesTaskDueDate(task(today), "custom", { from: today, to: today }, today)).toBe(true);
  });

  it("supports either open endpoint without including undated tasks", () => {
    expect(matchesTaskDueDate(task(today), "custom", { from: today }, today)).toBe(true);
    expect(matchesTaskDueDate(task("2027-01-01"), "custom", { from: today }, today)).toBe(true);
    expect(matchesTaskDueDate(task("2026-11-02"), "custom", { from: today }, today)).toBe(false);
    expect(matchesTaskDueDate(task(today), "custom", { to: today }, today)).toBe(true);
    expect(matchesTaskDueDate(task("2026-01-01"), "custom", { to: today }, today)).toBe(true);
    expect(matchesTaskDueDate(task("2026-11-04"), "custom", { to: today }, today)).toBe(false);
    expect(matchesTaskDueDate(task(null), "custom", { from: today }, today)).toBe(false);
    expect(matchesTaskDueDate(task(null), "custom", { to: today }, today)).toBe(false);
  });

  it("matches every open task when both endpoints are empty", () => {
    for (const range of [{}, { from: "", to: "" }]) {
      expect(matchesTaskDueDate(task(null), "custom", range, today)).toBe(true);
      expect(matchesTaskDueDate(task("2020-01-01"), "custom", range, today)).toBe(true);
      expect(matchesTaskDueDate(task("2030-01-01"), "custom", range, today)).toBe(true);
    }
  });

  it("matches nothing for an inverted range", () => {
    const range = { from: "2026-11-05", to: "2026-11-03" };
    for (const date of [range.from, "2026-11-04", range.to, null]) {
      expect(matchesTaskDueDate(task(date), "custom", range, today)).toBe(false);
    }
  });
});
