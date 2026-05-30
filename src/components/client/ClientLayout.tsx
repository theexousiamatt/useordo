import { Outlet, Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { ClientSidebar } from "./ClientSidebar";
import { SidebarCollapseProvider, useSidebarCollapse } from "@/components/sidebar-collapse";

function ClientShell() {
  const { collapsed } = useSidebarCollapse();
  return (
    <div className="client-os min-h-screen bg-background">
      {/* Fixed structural sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden transition-[width] duration-300 ease-in-out lg:block",
          collapsed ? "w-[76px]" : "w-[268px]",
        )}
      >
        <ClientSidebar collapsed={collapsed} />
      </aside>

      <div className={cn("flex min-h-screen flex-col transition-[margin] duration-300 ease-in-out", collapsed ? "lg:ml-[76px]" : "lg:ml-[268px]")}>
        <main className="flex min-w-0 flex-1 flex-col gap-6 p-4 sm:gap-8 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function ClientLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="client-os flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace state={{ from: location }} />;

  return (
    <SidebarCollapseProvider>
      <ClientShell />
    </SidebarCollapseProvider>
  );
}
