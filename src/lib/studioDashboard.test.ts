import { describe, expect, it } from "vitest";
import { buildStudioOverview } from "./studioDashboard";
import type { StudioDashboardData, StudioProject } from "./studioDashboard";

const now = new Date(2026, 10, 14, 12);

const baseProject: StudioProject = {
  id: "p1",
  name: "Website redesign",
  status: "active",
  health: "on_track",
  due_date: "2026-11-21",
  updated_at: "2026-11-14T12:00:00Z",
  archived_at: null,
};

function sample(): StudioDashboardData {
  return {
    projects: [baseProject],
    tasks: [],
    milestones: [],
    deliverables: [],
    activity: [],
  };
}

describe("studio dashboard aggregation", () => {
  it("uses explicit completion rather than task position or status for progress and overdue work", () => {
    const data = sample();
    data.tasks = [
      {
        id: "t1", project_id: "p1", title: "Wireframes",
        completed_at: null, due_date: "2026-11-12", archived_at: null,
      },
      {
        id: "t2", project_id: "p1", title: "Prototype",
        completed_at: "2026-11-14T11:00:00Z", due_date: "2026-11-10", archived_at: null,
      },
      {
        id: "t3", project_id: "p1", title: "Old draft",
        completed_at: null, due_date: "2026-11-10", archived_at: "2026-11-14T09:00:00Z",
      },
    ];
    const overview = buildStudioOverview(data, now);
    expect(overview.openTasks.map((task) => task.id)).toEqual(["t1"]);
    expect(overview.overdueTasks.map((task) => task.id)).toEqual(["t1"]);
    expect(overview.projectProgress("p1")).toEqual({ total: 2, completed: 1, percent: 50 });
  });

  it("keeps unapproved draft work out of pending approvals and completed milestones out of deadlines", () => {
    const data = sample();
    data.deliverables = [
      { id: "d1", project_id: "p1", title: "Homepage", status: "submitted", requires_approval: true, created_at: "2026-11-13" },
      { id: "d2", project_id: "p1", title: "Logo", status: "draft", requires_approval: true, created_at: "2026-11-13" },
      { id: "d3", project_id: "p1", title: "Notes", status: "submitted", requires_approval: false, created_at: "2026-11-13" },
      { id: "d4", project_id: "p1", title: "Approved", status: "approved", requires_approval: true, created_at: "2026-11-13" },
    ];
    data.milestones = [
      { id: "m1", project_id: "p1", title: "Research", due_date: "2026-11-16", completed: false },
      { id: "m2", project_id: "p1", title: "Discovery", due_date: "2026-11-15", completed: true },
      { id: "m3", project_id: "p1", title: "Future", due_date: "2027-01-10", completed: false },
    ];
    const overview = buildStudioOverview(data, now);
    expect(overview.pendingApprovals.map((item) => item.id)).toEqual(["d1"]);
    expect(overview.upcoming.map((item) => item.id)).toEqual(["m1", "p1"]);
    expect(overview.projectProgress("p1").percent).toBe(0);
  });

  it("does not include archived or inaccessible projects in counts, approvals, or activity", () => {
    const data = sample();
    data.projects.push({
      ...baseProject, id: "archived", name: "Old work",
      archived_at: "2026-11-12T10:00:00Z", status: "archived",
    });
    data.tasks = [
      { id: "hidden", project_id: "archived", title: "Hidden", due_date: "2026-11-01", completed_at: null, archived_at: null },
      { id: "invisible", project_id: "unauthorized", title: "Invisible", due_date: "2026-11-01", completed_at: null, archived_at: null },
    ];
    data.deliverables = [
      { id: "d-hidden", project_id: "archived", title: "Hidden", status: "submitted", requires_approval: true, created_at: "2026-11-14" },
    ];
    data.activity = [
      { id: "a-hidden", project_id: "archived", action: "task_created", metadata: {}, created_at: "2026-11-14" },
      { id: "a-visible", project_id: "p1", action: "task_created", metadata: { title: "New task" }, created_at: "2026-11-13" },
    ];
    const overview = buildStudioOverview(data, now);
    expect(overview.activeProjects.map((project) => project.id)).toEqual(["p1"]);
    expect(overview.openTasks).toHaveLength(0);
    expect(overview.overdueTasks).toHaveLength(0);
    expect(overview.pendingApprovals).toHaveLength(0);
    expect(overview.recentActivity.map((event) => event.id)).toEqual(["a-visible"]);
  });
});
