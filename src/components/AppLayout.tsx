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
  const { workspaces, loading: wsLoading } = useWorkspace();
  const location = useLocation();

  if (authLoading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/auth" replace state={{ from: location }} />;
  if (wsLoading) return <FullScreenLoader />;
  if (workspaces.length === 0) return <Navigate to="/onboarding" replace />;

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
