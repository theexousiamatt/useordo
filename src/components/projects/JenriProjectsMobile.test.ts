import { describe, expect, it } from "vitest";
import { filterMatches, projectState } from "./JenriProjectsMobile";
import type { ProjectWithMembers } from "@/hooks/useProjects";
import type { ProjectStatus, ProjectHealth } from "@/lib/projectConstants";

const project = (
  status: ProjectStatus,
  health: ProjectHealth = "on_track",
  archivedAt: string | null = null,
): ProjectWithMembers => ({
  id: "project-id",
  workspace_id: "workspace-id",
  name: "Real project",
  description: null,
  client_id: null,
  status,
  health,
  progress: 0,
  start_date: null,
  due_date: null,
  owner_id: null,
  created_by: null,
  archived_at: archivedAt,
  visibility: "workspace",
  created_at: "2026-11-22T00:00:00Z",
  updated_at: "2026-11-22T00:00:00Z",
  members: [],
});

describe("Jerin Projects mobile filters", () => {
  it("shows active and planning projects under Ongoing without losing risky active projects", () => {
    expect(filterMatches(project("active"), "ongoing")).toBe(true);
    expect(filterMatches(project("draft"), "ongoing")).toBe(true);
    expect(filterMatches(project("active", "at_risk"), "ongoing")).toBe(true);
    expect(filterMatches(project("on_hold"), "ongoing")).toBe(false);
    expect(filterMatches(project("completed"), "ongoing")).toBe(false);
  });

  it("filters On Hold and Completed by the real persisted project status", () => {
    expect(filterMatches(project("on_hold"), "on_hold")).toBe(true);
    expect(filterMatches(project("active"), "on_hold")).toBe(false);
    expect(filterMatches(project("completed"), "completed")).toBe(true);
    expect(filterMatches(project("draft"), "completed")).toBe(false);
  });

  it("keeps archived projects out of active tabs and accessible via Archived", () => {
    const archived = project("archived", "on_track", "2026-11-22T00:00:00Z");
    expect(filterMatches(archived, "archived")).toBe(true);
    expect(filterMatches(archived, "ongoing")).toBe(false);
    expect(filterMatches(archived, "on_hold")).toBe(false);
    expect(filterMatches(archived, "completed")).toBe(false);
  });
});

describe("Jerin Projects badges", () => {
  it("uses backend health/status rather than invented Figma sample statuses", () => {
    expect(projectState(project("active"))).toEqual({ label: "On track", tone: "success" });
    expect(projectState(project("active", "at_risk"))).toEqual({ label: "At risk", tone: "warning" });
    expect(projectState(project("active", "blocked"))).toEqual({ label: "Blocked", tone: "danger" });
    expect(projectState(project("on_hold"))).toEqual({ label: "On Hold", tone: "warning" });
    expect(projectState(project("completed"))).toEqual({ label: "Completed", tone: "success" });
    expect(projectState(project("draft"))).toEqual({ label: "Planning", tone: "neutral" });
  });
});
