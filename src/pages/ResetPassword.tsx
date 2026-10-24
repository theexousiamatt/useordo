import { authReturnPath, authPath } from "@/lib/authReturn";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
  const [params] = useSearchParams();
  const returnTo = authReturnPath(params);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(Boolean(session));
        setChecking(false);
      }
      if (event === "SIGNED_OUT") setReady(false);
    });
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!active) return;
      setReady(Boolean(session));
      if (error) setError(friendlyAuthError(error));
    }).catch((err) => {
      if (active) setError(friendlyAuthError(err));
    }).finally(() => {
      if (active) setChecking(false);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match. Please re-enter them.");
      return;
    }
    if (password.length < 8 || evaluatePassword(password).score < 2) {
      setError("Please choose a stronger password (at least 8 characters).");
      return;
    }
    if (busy || !ready) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(friendlyAuthError(error));
        return;
      }
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
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

        {checking ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Verifying your reset link…
          </div>
        ) : !ready ? (
          <div className="space-y-5">
            <OrdoAlert variant="error">{error || "This reset link is invalid, expired, or has already been used. Request a new link to continue."}</OrdoAlert>
            <Link to={authPath("/auth/forgot-password", returnTo)} className="block font-semibold text-accent hover:underline">Request a new reset link</Link>
            <Link to={authPath("/auth", returnTo)} className="block text-sm hover:underline">Back to sign in</Link>
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
