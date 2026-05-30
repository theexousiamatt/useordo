import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  AuthLayout,
  OrdoPasswordInput,
  OrdoButton,
  OrdoAlert,
  friendlyAuthError,
  evaluatePassword,
} from "@/components/auth";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match. Please re-enter them.");
      return;
    }
    if (evaluatePassword(password).score < 2) {
      setError("Please choose a stronger password (at least 8 characters).");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(friendlyAuthError(error));
      return;
    }
    navigate("/");
  };

  return (
    <AuthLayout
      panelTitle="Set a new password"
      panelSubtitle="Choose a strong password to secure your Ordo account. You'll be signed in right after."
    >
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-card bg-secondary">
            <ShieldCheck className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">New password</h2>
          </div>
        </div>

        {!ready ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Verifying your reset link…
          </div>
        ) : (
          <>
            {error && (
              <OrdoAlert variant="error" className="mb-5">
                {error}
              </OrdoAlert>
            )}
            <form onSubmit={onSubmit} className="space-y-5">
              <OrdoPasswordInput
                label="New password"
                required
                showStrength
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <OrdoPasswordInput
                label="Confirm password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                error={confirm && confirm !== password ? "Passwords don't match" : undefined}
              />
              <OrdoButton type="submit" loading={busy}>
                Update password
              </OrdoButton>
            </form>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
