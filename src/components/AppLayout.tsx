import { Outlet, Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { MobileNav } from "@/components/MobileNav";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
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

  // Still loading, or the last fetch failed/has not resolved cleanly:
  // never make a routing decision (especially onboarding) on an unresolved state.
  if (wsLoading || (!resolved && error)) {
    console.info("[AppLayout] workspace state unresolved, holding", {
      userId: user.id,
      wsLoading,
      resolved,
      error,
    });
    return <FullScreenLoader />;
  }

  const decision =
    workspaces.length === 0
      ? "onboarding"
      : role === "client"
        ? "client"
        : "dashboard";

  console.info("[AppLayout] routing decision", {
    userId: user.id,
    role,
    workspaceCount: workspaces.length,
    decision,
  });

  if (decision === "onboarding") return <Navigate to="/onboarding" replace />;
  if (decision === "client") return <Navigate to="/client" replace />;


  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          <main className="flex-1 overflow-auto px-4 py-6 pb-24 sm:px-6 md:pb-6">
            <div className="mx-auto w-full max-w-6xl">
              <Outlet />
            </div>
          </main>
        </div>
        <MobileNav />
      </div>
    </SidebarProvider>
  );
}
