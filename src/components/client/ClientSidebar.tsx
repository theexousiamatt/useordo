import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { clientNavItems, clientSettingsItem } from "./clientNav";
import { useActionItems } from "@/hooks/useClientDashboard";

interface ClientSidebarProps {
  onNavigate?: () => void;
}

export function ClientSidebar({ onNavigate }: ClientSidebarProps) {
  const { pathname } = useLocation();
  const { data: actions } = useActionItems();
  const approvalsCount = actions?.length ?? 0;

  const isActive = (url: string, end?: boolean) =>
    end ? pathname === url : pathname === url || pathname.startsWith(url + "/");

  return (
    <nav
      aria-label="Client navigation"
      className="flex h-full flex-col rounded-panel bg-card px-4 py-6 shadow-panel"
    >
      {/* Header / logo */}
      <div className="flex items-center gap-3 px-2 pb-6">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F56]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#27C93F]" />
        </div>
        <div className="ml-1 flex h-10 w-10 items-center justify-center rounded-xl bg-foreground">
          <span className="h-4 w-4 rounded-full border-[3px] border-card" />
        </div>
        <span className="text-base font-semibold tracking-tight">Ordo</span>
      </div>

      {/* Nav items */}
      <ul className="flex flex-1 flex-col gap-1">
        {clientNavItems.map((item) => {
          const active = isActive(item.url, item.end);
          const badge = item.badgeKey === "approvals" && approvalsCount > 0 ? approvalsCount : null;
          return (
            <li key={item.title}>
              <NavLink
                to={item.url}
                end={item.end}
                onClick={onNavigate}
                className={cn(
                  "flex items-center rounded-small px-3 py-2.5 text-sm font-medium transition-colors",
                  "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active && "bg-secondary text-foreground",
                )}
              >
                <item.icon className="mr-3 h-5 w-5 shrink-0" aria-hidden="true" />
                <span>{item.title}</span>
                {badge !== null && (
                  <span className="ml-auto rounded-pill bg-[hsl(var(--badge-orange-bg))] px-2 py-0.5 text-xs font-semibold text-[hsl(var(--badge-orange-text))]">
                    {badge}
                  </span>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>

      {/* Settings */}
      <div className="mt-4 border-t border-border pt-4">
        <NavLink
          to={clientSettingsItem.url}
          onClick={onNavigate}
          className={cn(
            "flex items-center rounded-small px-3 py-2.5 text-sm font-medium transition-colors",
            "text-muted-foreground hover:bg-secondary hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isActive(clientSettingsItem.url) && "bg-secondary text-foreground",
          )}
        >
          <clientSettingsItem.icon className="mr-3 h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{clientSettingsItem.title}</span>
        </NavLink>
      </div>
    </nav>
  );
}
