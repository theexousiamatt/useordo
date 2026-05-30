import { Outlet, Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { OrdoSidebar } from "@/components/OrdoSidebar";
import { OrdoTopBar } from "@/components/OrdoTopBar";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";

function FullScreenLoader() {
  return (
    <div className="client-os flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function AppLayout() {
  const { user, session, loading: authLoading } = useAuth();
  const { workspaces, loading: wsLoading, resolved, error, role, debug } = useWorkspace();
  const location = useLocation();

  const debugSnapshot = {
    authUserId: user?.id ?? null,
    sessionExists: Boolean(session),
    accessTokenExists: Boolean(session?.access_token),
    listWorkspacesResponse: debug.lastResponse,
    parsedWorkspaceCount: debug.parsedWorkspaceCount,
    useWorkspace: {
      loading: wsLoading,
      resolved,
      error,
      workspacesLength: workspaces.length,
    },
  };

  if (authLoading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/auth" replace state={{ from: location }} />;

  // Still loading, or the last fetch failed/has not resolved cleanly:
  // never make a routing decision (especially onboarding) on an unresolved state.
  if (wsLoading || (!resolved && error)) {
    console.info("[AppLayout] workspace state unresolved, holding", {
      ...debugSnapshot,
      wsLoading,
      resolved,
      error,
    });
    return <FullScreenLoader />;
  }

  const shouldOnboard = workspaces.length === 0;
  const onboardingCondition = `workspaces.length === 0 -> ${workspaces.length} === 0 (${shouldOnboard})`;
  const decision =
    shouldOnboard
      ? "onboarding"
      : role === "client"
        ? "client"
        : "dashboard";

  console.info("[AppLayout] routing decision", {
    ...debugSnapshot,
    role,
    workspaceCount: workspaces.length,
    decision,
    onboardingCondition,
  });

  if (decision === "onboarding") return <Navigate to="/onboarding" replace />;
  if (decision === "client") return <Navigate to="/client" replace />;


  return (
    <div className="client-os min-h-screen bg-background">
      {/* Fixed structural sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[268px] lg:block">
        <OrdoSidebar />
      </aside>

      <div className="flex min-h-screen flex-col lg:ml-[268px]">
        <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 sm:gap-8 sm:p-8">
          <OrdoTopBar />
          <main className="flex min-w-0 flex-1 flex-col gap-6 sm:gap-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
