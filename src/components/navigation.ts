import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  UserCog,
  Activity,
  Inbox,
  Settings,
  LucideIcon,
} from "lucide-react";
import type { WorkspaceRole } from "@/hooks/useWorkspace";

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  end?: boolean;
  roles: WorkspaceRole[];
}

export const navItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, end: true, roles: ["owner", "manager", "member", "client"] },
  { title: "Projects", url: "/projects", icon: FolderKanban, roles: ["owner", "manager", "member", "client"] },
  { title: "Tasks", url: "/tasks", icon: CheckSquare, roles: ["owner", "manager", "member"] },
  { title: "Clients", url: "/clients", icon: Users, roles: ["owner", "manager"] },
  { title: "Team", url: "/team", icon: UserCog, roles: ["owner", "manager"] },
  { title: "Inbox", url: "/inbox", icon: Inbox, roles: ["owner", "manager", "member"] },
  { title: "Activity", url: "/activity", icon: Activity, roles: ["owner", "manager", "member", "client"] },
  { title: "Settings", url: "/settings", icon: Settings, roles: ["owner"] },
];

export function navForRole(role: WorkspaceRole | null): NavItem[] {
  if (!role) return navItems.filter((i) => i.roles.includes("client"));
  return navItems.filter((i) => i.roles.includes(role));
}
