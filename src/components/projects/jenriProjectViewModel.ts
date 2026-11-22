import type { ProjectWithMembers } from "@/hooks/useProjects";

export type JenriProjectFilter = "ongoing" | "on_hold" | "completed" | "archived";

export function filterMatches(project: ProjectWithMembers, filter: JenriProjectFilter): boolean {
  if (filter === "archived") return !!project.archived_at;
  if (project.archived_at) return false;
  if (filter === "completed") return project.status === "completed";
  if (filter === "on_hold") return project.status === "on_hold";
  return project.status === "active" || project.status === "draft";
}

export function projectState(project: ProjectWithMembers): { label: string; tone: "success" | "warning" | "danger" | "neutral" } {
  if (project.archived_at || project.status === "archived") return { label: "Archived", tone: "neutral" };
  if (project.status === "completed") return { label: "Completed", tone: "success" };
  if (project.status === "on_hold") return { label: "On Hold", tone: "warning" };
  if (project.status === "draft") return { label: "Planning", tone: "neutral" };
  if (project.health === "blocked") return { label: "Blocked", tone: "danger" };
  if (project.health === "at_risk") return { label: "At risk", tone: "warning" };
  return { label: "On track", tone: "success" };
}
