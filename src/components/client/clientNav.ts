import {
  LayoutDashboard,
  FolderKanban,
  Package,
  CheckCircle2,
  Activity,
  LucideIcon,
} from "lucide-react";

export interface ClientNavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  end?: boolean;
  badgeKey?: "approvals";
}

export const clientNavItems: ClientNavItem[] = [
  { title: "Dashboard", url: "/client", icon: LayoutDashboard, end: true },
  { title: "Projects", url: "/client/projects", icon: FolderKanban },
  { title: "Deliverables", url: "/client/deliverables", icon: Package },
  { title: "Approvals", url: "/client/approvals", icon: CheckCircle2, badgeKey: "approvals" },
  { title: "Activity", url: "/client/activity", icon: Activity },
];
