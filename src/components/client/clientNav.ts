import {
  LayoutDashboard,
  FolderKanban,
  Package,
  CheckCircle2,
  Activity,
  Inbox,
  MessageSquare,
  Settings,
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
  { title: "Inbox", url: "/client/inbox", icon: Inbox },
  { title: "Activity", url: "/client/activity", icon: Activity },
  { title: "Messages", url: "/client/messages", icon: MessageSquare },
];

export const clientSettingsItem: ClientNavItem = {
  title: "Settings",
  url: "/client/settings",
  icon: Settings,
};
