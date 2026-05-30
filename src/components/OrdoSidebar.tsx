import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { navForRole, type NavItem } from "@/components/navigation";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { useWorkspace } from "@/hooks/useWorkspace";

interface OrdoSidebarProps {
  onNavigate?: () => void;
}

export function OrdoSidebar({ onNavigate }: OrdoSidebarProps) {
  const { pathname } = useLocation();
  const { role } = useWorkspace();
  const items = navForRole(role);

  const settingsItem = items.find((i) => i.url === "/settings");
  const mainItems = items.filter((i) => i.url !== "/settings");

  const isActive = (url: string, end?: boolean) =>
    end ? pathname === url : pathname === url || pathname.startsWith(url + "/");

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center rounded-small px-3 py-2.5 text-sm font-medium transition-colors",
      "text-white/65 hover:bg-white/[0.08] hover:text-white/90",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
      active && "bg-white/[0.12] text-white hover:text-white",
    );

  const renderItem = (item: NavItem) => {
    const active = isActive(item.url, item.end);
    return (
      <li key={item.title}>
        <NavLink to={item.url} end={item.end} onClick={onNavigate} className={linkClass(active)}>
          <item.icon className="mr-3 h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{item.title}</span>
        </NavLink>
      </li>
    );
  };

  return (
    <nav
      aria-label="Workspace navigation"
      className="flex h-full flex-col bg-[hsl(var(--sidebar-brand))] px-4 py-6"
    >
      {/* Header / logo */}
      <div className="flex items-center gap-3 px-2 pb-4">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F56]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#27C93F]" />
        </div>
        <div className="ml-1 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
          <span className="h-4 w-4 rounded-full border-[3px] border-white" />
        </div>
        <span className="text-base font-semibold tracking-tight text-white">Ordo</span>
      </div>

      {/* Workspace switcher */}
      <div className="mb-2 rounded-small bg-white/[0.06] p-1">
        <WorkspaceSwitcher />
      </div>

      {/* Nav items */}
      <ul className="flex flex-1 flex-col gap-1">{mainItems.map(renderItem)}</ul>

      {/* Settings */}
      {settingsItem && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <NavLink
            to={settingsItem.url}
            onClick={onNavigate}
            className={linkClass(isActive(settingsItem.url, settingsItem.end))}
          >
            <settingsItem.icon className="mr-3 h-5 w-5 shrink-0" aria-hidden="true" />
            <span>{settingsItem.title}</span>
          </NavLink>
        </div>
      )}
    </nav>
  );
}

