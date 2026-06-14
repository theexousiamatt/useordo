import type { WorkspaceRole } from "@/hooks/useWorkspace";

/**
 * Ordo OS — canonical workspace role + permission model.
 *
 * Permissions are derived from a user's role *within the active workspace*.
 * A user may hold different roles across different workspaces, so always read
 * the role from `useWorkspace().role` rather than a global "user type".
 */

export type AssignableRole = Exclude<WorkspaceRole, "owner">;

export interface RoleMeta {
  value: WorkspaceRole;
  label: string;
  description: string;
  /** Tailwind classes for the role pill. */
  badge: string;
  /** Order for sorting in the directory. */
  weight: number;
}

export const ROLE_META: Record<WorkspaceRole, RoleMeta> = {
  owner: {
    value: "owner",
    label: "Owner",
    description: "Full access — billing, settings, delete & transfer ownership.",
    badge: "bg-[hsl(178,100%,8%)] text-white",
    weight: 0,
  },
  manager: {
    value: "manager",
    label: "Manager",
    description: "Manage projects, tasks & members. Cannot delete workspace.",
    badge: "bg-[hsl(178,40%,90%)] text-[hsl(178,100%,12%)]",
    weight: 1,
  },
  member: {
    value: "member",
    label: "Member",
    description: "Access assigned projects, create and update tasks.",
    badge: "bg-secondary text-foreground",
    weight: 2,
  },
  client: {
    value: "client",
    label: "Client",
    description: "View shared projects, deliverables & submit approvals.",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    weight: 3,
  },
};

/** Roles that can be assigned via the invite flow (never "owner"). */
export const ASSIGNABLE_ROLES: RoleMeta[] = [
  ROLE_META.manager,
  ROLE_META.member,
  ROLE_META.client,
];

export interface Permissions {
  manageBilling: boolean;
  manageWorkspaceSettings: boolean;
  deleteWorkspace: boolean;
  transferOwnership: boolean;
  manageProjects: boolean;
  manageTasks: boolean;
  inviteMembers: boolean;
  manageMembers: boolean;
  assignRoles: boolean;
  viewInternal: boolean;
}

const NONE: Permissions = {
  manageBilling: false,
  manageWorkspaceSettings: false,
  deleteWorkspace: false,
  transferOwnership: false,
  manageProjects: false,
  manageTasks: false,
  inviteMembers: false,
  manageMembers: false,
  assignRoles: false,
  viewInternal: false,
};

export const PERMISSIONS: Record<WorkspaceRole, Permissions> = {
  owner: {
    manageBilling: true,
    manageWorkspaceSettings: true,
    deleteWorkspace: true,
    transferOwnership: true,
    manageProjects: true,
    manageTasks: true,
    inviteMembers: true,
    manageMembers: true,
    assignRoles: true,
    viewInternal: true,
  },
  manager: {
    ...NONE,
    manageProjects: true,
    manageTasks: true,
    inviteMembers: true,
    manageMembers: true,
    assignRoles: true,
    viewInternal: true,
  },
  member: {
    ...NONE,
    manageTasks: true,
    viewInternal: true,
  },
  client: { ...NONE },
};

export function permissionsFor(role: WorkspaceRole | null): Permissions {
  return role ? PERMISSIONS[role] : NONE;
}

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "—";
  return ROLE_META[role as WorkspaceRole]?.label ?? role;
}

export function roleBadge(role: string | null | undefined): string {
  return ROLE_META[role as WorkspaceRole]?.badge ?? "bg-secondary text-foreground";
}
