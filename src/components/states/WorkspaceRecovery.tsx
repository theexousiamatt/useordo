import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { ErrorState } from "./ErrorState";

/** Shared recovery for owner, client and onboarding workspace fetch failures. */
export function WorkspaceRecovery() {
  const { refresh, error } = useWorkspace();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const resetSession = async () => {
    setSigningOut(true); setSignOutError(false);
    try { await signOut(); navigate("/auth", { replace: true }); }
    catch { setSignOutError(true); }
    finally { setSigningOut(false); }
  };
  return <WorkspaceRecoveryView error={error} onRetry={() => void refresh()} signingOut={signingOut} onSignOut={() => void resetSession()} signOutError={signOutError} />;
}

export function WorkspaceRecoveryView({ error, onRetry, signingOut, onSignOut, signOutError }: {
  error: string | null; onRetry: () => void; signingOut: boolean; onSignOut: () => void; signOutError: boolean;
}) {
  return <div className="client-os flex min-h-screen items-center justify-center bg-background p-4">
    <div className="w-full max-w-lg space-y-4">
      <ErrorState title="We couldn't open your workspace" description={error ?? "Please try loading your workspaces again."} onRetry={onRetry} />
      <Button variant="ghost" className="w-full" disabled={signingOut} onClick={onSignOut}>{signingOut ? "Signing out…" : "Sign out and try another account"}</Button>
      {signOutError && <p role="alert" className="text-center text-sm text-destructive">We couldn't sign you out. Please check your connection and try again.</p>}
    </div>
  </div>;
}
