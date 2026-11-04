export type FoundationRole = "owner" | "admin" | "manager" | "member" | "client";
export type ProjectOwnership = "client" | "internal";
export type ProjectLifecycle = "fixed_scope" | "recurring" | "continuous" | "operational";
export type DisciplineKey = "branding" | "web" | "software" | "content" | "growth" | "operations";

export interface StudioOrganization {
  id: string;
  name: string;
  slug: string;
  role: FoundationRole;
  capabilities?: string[];
}

export interface ProjectParent {
  id: string;
  organization_id: string;
  name: string;
}

export interface FoundationProject {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  ownership: ProjectOwnership;
  lifecycle: ProjectLifecycle;
  client_organization_id: string | null;
  internal_initiative_id: string | null;
  engagement_id: string | null;
  owner_id: string | null;
  due_date: string | null;
  created_at: string;
  disciplines: DisciplineKey[];
}

export interface CreateFoundationProject {
  organizationId: string;
  name: string;
  ownership: ProjectOwnership;
  disciplineKeys: DisciplineKey[];
  lifecycle: ProjectLifecycle;
  clientOrganizationId: string | null;
  internalInitiativeId: string | null;
  description: string | null;
  dueDate: string | null;
}

export const DISCIPLINES: { key: DisciplineKey; label: string }[] = [
  { key: "branding", label: "Branding" },
  { key: "web", label: "Web" },
  { key: "software", label: "Software" },
  { key: "content", label: "Content" },
  { key: "growth", label: "Growth" },
  { key: "operations", label: "Operations" },
];

export const LIFECYCLES: { key: ProjectLifecycle; label: string; description: string }[] = [
  { key: "fixed_scope", label: "Fixed scope", description: "A defined outcome and finish." },
  { key: "recurring", label: "Recurring", description: "Work delivered in repeating cycles." },
  { key: "continuous", label: "Continuous", description: "An evolving product or long-term effort." },
  { key: "operational", label: "Operational", description: "Ongoing studio operations." },
];

export function canCreateProjects(role: FoundationRole, capabilities?: string[]) {
  return capabilities ? capabilities.includes("projects.create") : role === "owner" || role === "admin" || role === "manager";
}

export function canManageStudio(role: FoundationRole, capabilities?: string[]) {
  return capabilities ? capabilities.includes("organization.manage") : role === "owner" || role === "admin";
}
