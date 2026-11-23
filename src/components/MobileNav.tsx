import type { CSSProperties } from "react";
import { matchPath, NavLink, useLocation } from "react-router-dom";
import { CheckCheck, FolderKanban, House } from "lucide-react";
import { useActionItems } from "@/hooks/useClientDashboard";
import { cn } from "@/lib/utils";
import "@/styles/jerin-mobile-nav.css";

const studioItems = [
  { title: "Home", url: "/", icon: "home", end: true },
  { title: "Projects", url: "/projects", icon: "projects", end: false },
  { title: "Tasks", url: "/tasks", icon: "tasks", end: false },
  { title: "Inbox", url: "/inbox", icon: "inbox", end: false },
] as const;

const clientItems = [
  { title: "Home", url: "/client", icon: House, end: true },
  { title: "Projects", url: "/client/projects", icon: FolderKanban, end: false },
  { title: "Approvals", url: "/client/approvals", icon: CheckCheck, end: false },
] as const;

function StudioMobileNav() {
  const { pathname } = useLocation();
  const activeIndex = studioItems.findIndex(({ url, end }) => matchPath({ path: url, end }, pathname));

  return (
    <nav aria-label="Studio mobile navigation" className="mobile-bottom-nav jerin-mobile-nav lg:hidden">
      <ul className="jerin-mobile-nav-track" data-selected={activeIndex >= 0}>
        <li
          aria-hidden="true"
          className="jerin-mobile-nav-indicator"
          data-visible={activeIndex >= 0}
          style={{ "--nav-index": Math.max(activeIndex, 0) } as CSSProperties}
        />
        {studioItems.map(({ title, url, icon, end }) => (
          <li key={url} className="jerin-mobile-nav-item">
            <NavLink to={url} end={end} aria-label={title} className="jerin-mobile-nav-link">
              <span
                aria-hidden="true"
                className="jerin-mobile-nav-icon"
                style={{ maskImage: `url("/jenri/navigation/${icon}.svg")` }}
              />
              <span className="jerin-mobile-nav-label">{title}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function ClientApprovalCount() {
  const { data } = useActionItems();
  const count = data?.length ?? 0;
  if (!count) return null;

  return (
    <span
      className="absolute -right-3 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
      aria-label={`${count} pending approvals`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

function ClientMobileNav() {

  return (
    <nav
      aria-label="Client mobile navigation"
      className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/95 shadow-[0_-8px_20px_-20px_rgba(0,0,0,0.14)] backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="mx-auto flex h-[66px] w-full max-w-[560px] items-stretch px-3">
        {clientItems.map((item) => (
          <li key={item.url} className="min-w-0 flex-1">
            <NavLink
              to={item.url}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "group relative mx-auto flex h-full max-w-40 flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary motion-reduce:transition-none",
                  isActive && "font-semibold text-primary",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "relative flex h-7 w-11 items-center justify-center rounded-full transition-colors duration-150 motion-reduce:transition-none",
                      isActive && "bg-primary/10",
                    )}
                  >
                    <item.icon
                      className="h-[19px] w-[19px]"
                      strokeWidth={isActive ? 2.25 : 1.8}
                      aria-hidden="true"
                    />
                    {item.title === "Approvals" && <ClientApprovalCount />}
                  </span>
                  <span className={cn("truncate text-[11px] leading-4", isActive ? "font-semibold" : "font-medium")}>
                    {item.title}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute bottom-0 left-1/2 h-[2px] w-5 -translate-x-1/2 rounded-t-full bg-primary transition-opacity",
                      isActive ? "opacity-100" : "opacity-0",
                    )}
                  />
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function MobileNav({ audience }: { audience: "studio" | "client" }) {
  return audience === "studio" ? <StudioMobileNav /> : <ClientMobileNav />;
}
