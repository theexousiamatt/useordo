import { useNavigate } from "react-router-dom";
import { Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  AuthLayout,
  OrdoButton,
} from "@/components/auth";

/** Friendly session-expired screen shown when a token is no longer valid. */
export default function SessionExpired() {
  const navigate = useNavigate();

  const signInAgain = async () => {
    await supabase.auth.signOut().catch(() => {});
    navigate("/auth");
  };

  return (
    <AuthLayout
      showPreview={false}
      panelTitle="Session expired"
      panelSubtitle="We sign you out automatically after a period of inactivity to keep your workspace secure."
    >
      <div className="mx-auto w-full max-w-sm space-y-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-card bg-secondary">
          <Clock className="h-7 w-7 text-foreground" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">You've been signed out</h2>
          <p className="mt-2 text-muted-foreground">
            Your session has expired. Please sign in again to pick up where you left off — your work is
            safe.
          </p>
        </div>
        <OrdoButton onClick={signInAgain}>Sign in again</OrdoButton>
      </div>
    </AuthLayout>
  );
}
