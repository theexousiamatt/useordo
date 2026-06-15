import { NavLink, useLocation } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { clientNavItems, clientSettingsItem } from "./clientNav";
import { useActionItems } from "@/hooks/useClientDashboard";
import { useSidebarCollapse } from "@/components/sidebar-collapse";
import { SidebarTooltip } from "@/components/SidebarTooltip";

interface ClientSidebarProps {
  onNavigate?: () => void;
  /** Render the compact icon-only rail. Mobile drawer always passes false. */
  collapsed?: boolean;
}

export function ClientSidebar({ onNavigate, collapsed = false }: ClientSidebarProps) {
  const { pathname } = useLocation();
  const { data: actions } = useActionItems();
  const { toggle } = useSidebarCollapse();
  const approvalsCount = actions?.length ?? 0;

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

  return (
    <nav
      aria-label="Client navigation"
      className={cn("flex h-full flex-col bg-[hsl(var(--sidebar-brand))] py-6", collapsed ? "px-2" : "px-4")}
    >
      {/* Header / logo */}
      <div className={cn("flex items-center pb-6", collapsed ? "justify-center px-2" : "gap-3 px-2")}>
        {collapsed ? (
          <OrdoIcon tone="dark" className="h-7 w-7" title="Ordo" />
        ) : (
          <OrdoLogo tone="dark" className="h-7 animate-fade-in" />
        )}
      </div>

      {/* Nav items */}
      <ul className="flex flex-1 flex-col gap-1">
        {clientNavItems.map((item) => {
          const active = isActive(item.url, item.end);
          const badge = item.badgeKey === "approvals" && approvalsCount > 0 ? approvalsCount : null;
          return (
            <li key={item.title}>
              <SidebarTooltip label={item.title} enabled={collapsed}>
                <NavLink
                  to={item.url}
                  end={item.end}
                  onClick={onNavigate}
                  aria-label={collapsed ? item.title : undefined}
                  className={cn(linkClass(active), "relative")}
                >
                  <item.icon className={cn("h-5 w-5 shrink-0", !collapsed && "mr-3")} aria-hidden="true" />
                  {!collapsed && <span className="animate-fade-in whitespace-nowrap">{item.title}</span>}
                  {badge !== null &&
                    (collapsed ? (
                      <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-white" aria-hidden="true" />
                    ) : (
                      <span className="ml-auto rounded-pill bg-white/15 px-2 py-0.5 text-xs font-semibold text-white">
                        {badge}
                      </span>
                    ))}
                </NavLink>
              </SidebarTooltip>
            </li>
          );
        })}
      </ul>

      {/* Settings */}
      <div className="mt-4 border-t border-white/10 pt-4">
        <SidebarTooltip label={clientSettingsItem.title} enabled={collapsed}>
          <NavLink
            to={clientSettingsItem.url}
            onClick={onNavigate}
            aria-label={collapsed ? clientSettingsItem.title : undefined}
            className={linkClass(isActive(clientSettingsItem.url))}
          >
            <clientSettingsItem.icon className={cn("h-5 w-5 shrink-0", !collapsed && "mr-3")} aria-hidden="true" />
            {!collapsed && <span className="animate-fade-in whitespace-nowrap">{clientSettingsItem.title}</span>}
          </NavLink>
        </SidebarTooltip>
      </div>


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
