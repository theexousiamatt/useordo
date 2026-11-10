import { InvitationInbox } from "@/components/auth/InvitationInbox";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";
import { Package, MessageSquare, Settings as SettingsIcon } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
const WorkspaceProvider = lazy(() => import("@/hooks/useWorkspace").then(module => ({default:module.WorkspaceProvider})));
const AppLayout = lazy(() => import("@/components/AppLayout"));
import SignIn from "@/pages/auth/SignIn";
import SignUp from "@/pages/auth/SignUp";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import VerifyEmail from "@/pages/auth/VerifyEmail";
import WorkspaceInvite from "@/pages/auth/WorkspaceInvite";
import AccountLocked from "@/pages/auth/AccountLocked";
import SessionExpired from "@/pages/auth/SessionExpired";
import ResetPassword from "@/pages/ResetPassword";
import Unsubscribe from "@/pages/Unsubscribe";
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Projects = lazy(() => import("@/pages/Projects"));
const ProjectDetail = lazy(() => import("@/pages/ProjectDetail"));
const Tasks = lazy(() => import("@/pages/Tasks"));
const Clients = lazy(() => import("@/pages/Clients"));
const Team = lazy(() => import("@/pages/Team"));
const ActivityPage = lazy(() => import("@/pages/ActivityPage"));
const Settings = lazy(() => import("@/pages/Settings"));
const NotFound = lazy(() => import("@/pages/NotFound"));
import { ClientLayout } from "@/components/client/ClientLayout";
import { FOUNDATION_MODE } from "@/lib/foundationMode";

const FoundationEntry = lazy(() => import("@/features/foundation/FoundationEntry"));

const ClientProjectDetail = lazy(() => import("@/pages/ClientProjectDetail"));
const ClientDashboard = lazy(() => import("@/pages/ClientDashboard"));
const ClientProjects = lazy(() => import("@/pages/ClientProjects"));
const ClientApprovals = lazy(() => import("@/pages/ClientApprovals"));
const ClientActivity = lazy(() => import("@/pages/ClientActivity"));
const ClientComingSoon = lazy(() => import("@/pages/ClientComingSoon"));

const queryClient = new QueryClient();

function ClientFallback() {
  return (
    <div className="client-os flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          {FOUNDATION_MODE ? (
            <Suspense fallback={<ClientFallback />}>
              <FoundationEntry>
                <Routes>
                  <Route path="/auth" element={<SignIn />} />
                  <Route path="/auth/sign-up" element={<SignUp />} />
                  <Route path="/auth/forgot-password" element={<ForgotPassword />} />
                  <Route path="/auth/verify-email" element={<VerifyEmail />} />
                  <Route path="/auth/locked" element={<AccountLocked />} />
                  <Route path="/auth/session-expired" element={<SessionExpired />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="*" element={<FoundationWorkspaceRoute />} />
                </Routes>
              </FoundationEntry>
            </Suspense>
          ) : <Suspense fallback={<ClientFallback />}><WorkspaceProvider>
              <Routes>
                <Route path="/auth" element={<SignIn />} />
                <Route path="/auth/sign-up" element={<SignUp />} />
                <Route path="/auth/forgot-password" element={<ForgotPassword />} />
                <Route path="/auth/verify-email" element={<VerifyEmail />} />
                <Route path="/auth/invitations" element={<InvitationInbox allowSetup={false} />} />
                <Route path="/auth/invite" element={<WorkspaceInvite />} />
                <Route path="/auth/locked" element={<AccountLocked />} />
                <Route path="/auth/session-expired" element={<SessionExpired />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/unsubscribe" element={<Unsubscribe />} />
                <Route path="/onboarding" element={<Onboarding />} />

                {/* Client-facing workspace */}
                <Route path="/client" element={<ClientLayout />}>
                  <Route index element={<ClientDashboard />} />
                  <Route path="projects" element={<ClientProjects />} />
                  <Route path="projects/:id" element={<ClientProjectDetail />} />
                  <Route path="approvals" element={<ClientApprovals />} />
                  <Route path="activity" element={<ClientActivity />} />
                  <Route
                    path="deliverables"
                    element={
                      <ClientComingSoon
                        title="Deliverables"
                        subtitle="Files and assets shared with you."
                        icon={Package}
                        description="Approved files and deliverables from your projects will live here."
                      />
                    }
                  />
                  <Route
                    path="messages"
                    element={
                      <ClientComingSoon
                        title="Messages"
                        subtitle="Talk to your team in one place."
                        icon={MessageSquare}
                        description="Direct conversations with your team are coming soon."
                      />
                    }
                  />
                  <Route
                    path="settings"
                    element={
                      <ClientComingSoon
                        title="Settings"
                        subtitle="Manage your account."
                        icon={SettingsIcon}
                        description="Profile and notification settings are coming soon."
                      />
                    }
                  />
                </Route>

                <Route element={<AppLayout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/projects" element={<Projects />} />
                  <Route path="/projects/:id" element={<ProjectDetail />} />
                  <Route path="/tasks" element={<Tasks />} />
                  <Route path="/clients" element={<Clients />} />
                  <Route path="/team" element={<Team />} />
                  <Route path="/activity" element={<ActivityPage />} />
                  <Route path="/settings" element={<Settings />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
          </WorkspaceProvider></Suspense>}
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

const FoundationWorkspace = lazy(() => import("@/features/foundation").then((module) => ({ default: module.FoundationWorkspace })));
function FoundationWorkspaceRoute() {
  return <FoundationWorkspace />;
}
