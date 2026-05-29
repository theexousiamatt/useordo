import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  UserCog,
  Activity,
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
  { title: "Dashboard", url: "/", icon: LayoutDashboard, end: true, roles: ["owner", "member", "client"] },
  { title: "Projects", url: "/projects", icon: FolderKanban, roles: ["owner", "member", "client"] },
  { title: "Tasks", url: "/tasks", icon: CheckSquare, roles: ["owner", "member"] },
  { title: "Clients", url: "/clients", icon: Users, roles: ["owner", "member"] },
  { title: "Team", url: "/team", icon: UserCog, roles: ["owner", "member"] },
  { title: "Activity", url: "/activity", icon: Activity, roles: ["owner", "member", "client"] },
  { title: "Settings", url: "/settings", icon: Settings, roles: ["owner"] },
];

export function navForRole(role: WorkspaceRole | null): NavItem[] {
  if (!role) return navItems.filter((i) => i.roles.includes("client"));
  return navItems.filter((i) => i.roles.includes(role));
}
