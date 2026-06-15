import { NavLink, useLocation } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { navForRole, type NavItem } from "@/components/navigation";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useSidebarCollapse } from "@/components/sidebar-collapse";
import { SidebarTooltip } from "@/components/SidebarTooltip";
import { OrdoLogo, OrdoIcon } from "@/components/brand";

interface OrdoSidebarProps {
  onNavigate?: () => void;
  /** Render the compact icon-only rail. Mobile drawer always passes false. */
  collapsed?: boolean;
}

export function OrdoSidebar({ onNavigate, collapsed = false }: OrdoSidebarProps) {
  const { pathname } = useLocation();
  const { role } = useWorkspace();
  const { toggle } = useSidebarCollapse();
  const items = navForRole(role);

  const settingsItem = items.find((i) => i.url === "/settings");
  const mainItems = items.filter((i) => i.url !== "/settings");

  const isActive = (url: string, end?: boolean) =>
    end ? pathname === url : pathname === url || pathname.startsWith(url + "/");

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center rounded-small py-2.5 text-sm font-medium transition-colors",
      collapsed ? "justify-center px-2.5" : "px-3",
      "text-white/65 hover:bg-white/[0.08] hover:text-white/90",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
      active && "bg-white/[0.12] text-white hover:text-white",
    );

  const renderItem = (item: NavItem) => {
    const active = isActive(item.url, item.end);
    return (
      <li key={item.title}>
        <SidebarTooltip label={item.title} enabled={collapsed}>
          <NavLink
            to={item.url}
            end={item.end}
            onClick={onNavigate}
            aria-label={collapsed ? item.title : undefined}
            className={linkClass(active)}
          >
            <item.icon className={cn("h-5 w-5 shrink-0", !collapsed && "mr-3")} aria-hidden="true" />
            {!collapsed && <span className="animate-fade-in whitespace-nowrap">{item.title}</span>}
          </NavLink>
        </SidebarTooltip>
      </li>
    );
  };

  return (
    <nav
      aria-label="Workspace navigation"
      className={cn("flex h-full flex-col bg-[hsl(var(--sidebar-brand))] py-6", collapsed ? "px-2" : "px-4")}
    >
      {/* Header / logo */}
      <div className={cn("flex items-center pb-4", collapsed ? "justify-center px-2" : "gap-3 px-2")}>
        {collapsed ? (
          <OrdoIcon tone="dark" className="h-7 w-7" title="Ordo" />
        ) : (
          <OrdoLogo tone="dark" className="h-7 animate-fade-in" />
        )}
      </div>

      {/* Workspace switcher */}
      <div className={cn("mb-2 rounded-small bg-white/[0.06]", collapsed ? "p-0.5" : "p-1")}>
        <WorkspaceSwitcher collapsed={collapsed} />
      </div>

      {/* Nav items */}
      <ul className="flex flex-1 flex-col gap-1">{mainItems.map(renderItem)}</ul>

      {/* Settings */}
      {settingsItem && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <SidebarTooltip label={settingsItem.title} enabled={collapsed}>
            <NavLink
              to={settingsItem.url}
              onClick={onNavigate}
              aria-label={collapsed ? settingsItem.title : undefined}
              className={linkClass(isActive(settingsItem.url, settingsItem.end))}
            >
              <settingsItem.icon className={cn("h-5 w-5 shrink-0", !collapsed && "mr-3")} aria-hidden="true" />
              {!collapsed && <span className="animate-fade-in whitespace-nowrap">{settingsItem.title}</span>}
            </NavLink>
          </SidebarTooltip>
        </div>
      )}

      {/* Collapse / expand control (desktop only) */}
      <button
        type="button"
        onClick={toggle}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn(
          "mt-3 hidden items-center rounded-small py-2.5 text-sm font-medium text-white/65 transition-colors hover:bg-white/[0.08] hover:text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 lg:flex",
          collapsed ? "justify-center px-2.5" : "px-3",
        )}
      >
        {collapsed ? (
          <PanelLeftOpen className="h-5 w-5 shrink-0" aria-hidden="true" />
        ) : (
          <>
            <PanelLeftClose className="mr-3 h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="animate-fade-in whitespace-nowrap">Collapse</span>
          </>
        )}
      </button>
    </nav>
  );
}
