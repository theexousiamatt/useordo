import { NavLink } from "react-router-dom";
import { navForRole } from "@/components/navigation";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const { role } = useWorkspace();
  // Limit to 5 primary items for the bottom bar
  const items = navForRole(role).slice(0, 5);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur md:hidden"
    >
      <ul className="flex items-stretch justify-around">
        {items.map((item) => (
          <li key={item.title} className="flex-1">
            <NavLink
              to={item.url}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              <item.icon className="h-5 w-5" aria-hidden="true" />
              <span className="truncate">{item.title}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
