import { InvitationInbox } from "@/components/auth/InvitationInbox";
import { WorkspaceRecovery } from "@/components/states/WorkspaceRecovery";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrdoSidebar } from "@/components/OrdoSidebar";
import { OrdoTopBar } from "@/components/OrdoTopBar";
import { MobileNav } from "@/components/MobileNav";
import { JerinCreateFlow } from "@/components/jenri/JerinCreateFlow";
import { SidebarCollapseProvider, useSidebarCollapse } from "@/components/sidebar-collapse";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";

function AppShell() {
  const { collapsed } = useSidebarCollapse();
  const { pathname } = useLocation();
  const projectDetailPage = /^\/projects\/[^/]+\/?$/.test(pathname);
  const jerinMobilePage = pathname === "/projects" || pathname === "/";
  return (
    <div className="client-os min-h-screen bg-background">
      {/* Fixed structural sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden transition-[width] duration-300 ease-in-out lg:block",
          collapsed ? "w-[76px]" : "w-[268px]",
        )}
      >
        <OrdoSidebar collapsed={collapsed} />
      </aside>

      <div className={cn("flex min-h-screen flex-col transition-[margin] duration-300 ease-in-out", collapsed ? "lg:ml-[76px]" : "lg:ml-[268px]")}>
        <div className={cn("flex min-w-0 flex-1 flex-col gap-6 p-4 sm:gap-8 sm:p-8", jerinMobilePage && "max-lg:gap-0 max-lg:p-0", projectDetailPage && "max-md:gap-0 max-md:p-0")}>
          <div className={cn(jerinMobilePage && "max-lg:hidden", projectDetailPage && "max-md:hidden")}><OrdoTopBar /></div>
          <main className={cn("flex min-w-0 flex-1 flex-col gap-6 sm:gap-8", jerinMobilePage && "max-lg:gap-0")}>
            <Outlet />
          </main>
          <div
            aria-hidden="true"
            className={cn("jerin-mobile-nav-clearance shrink-0 lg:hidden", jerinMobilePage && "max-lg:hidden")}
          />
        </div>
        <MobileNav audience="studio" />
        <JerinCreateFlow />
      </div>
    </div>
  );
}

function FullScreenLoader() {
  return (
    <div className="client-os flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function AppLayout() {
  const { user, loading: authLoading } = useAuth();
  const { workspaces, loading: wsLoading, resolved, error, role } = useWorkspace();
  const location = useLocation();
  if (authLoading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/auth" replace state={{ from: location }} />;
  if (wsLoading) return <FullScreenLoader />;
  if (error || !resolved) return <WorkspaceRecovery />;
  if (workspaces.length === 0) return <InvitationInbox />;
  if (role === "client") return <Navigate to={location.pathname.startsWith("/projects/") ? `/client${location.pathname}${location.search}` : "/client"} replace />;
  return <SidebarCollapseProvider><AppShell /></SidebarCollapseProvider>;
}
