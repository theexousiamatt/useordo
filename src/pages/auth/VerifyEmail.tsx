import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { MailCheck, CheckCircle2 } from "lucide-react";
import { buildAppUrl } from "@/lib/appUrl";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  AuthLayout,
  OrdoButton,
  OrdoInput,
  OrdoAlert,
  friendlyAuthError,
} from "@/components/auth";

export default function VerifyEmail() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") || user?.email || "");
  const [linkError] = useState(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    return params.has("error") || hash.has("error")
      ? "This verification link is invalid, has expired, or has already been used. Sign in if you already confirmed your email, or request a fresh link below."
      : null;
  });

  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Let the SDK finish restoring the session from the confirmation URL first.
  const verified = !!user?.email_confirmed_at;

  useEffect(() => {
    if (!loading && verified) navigate("/", { replace: true });
  }, [loading, verified, navigate]);

  useEffect(() => {
    if (linkError) window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  }, [linkError]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const resend = async () => {
    if (busy || cooldown > 0 || !email.trim()) return;
    setError(null);
    setResent(false);
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: buildAppUrl("/auth/verify-email") },
      });
      if (error) {
        setError(friendlyAuthError(error));
        return;
      }
      setResent(true);
      setCooldown(60);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      showPreview={false}
      panelTitle={verified ? "You're all set" : "Verify your email"}
      panelSubtitle="Confirming your email keeps your workspace secure and unlocks the full Ordo experience."
    >
      <div className="mx-auto w-full max-w-sm">
        {loading ? (
          <p role="status">Completing email verification…</p>
        ) : verified ? (
          <div className="space-y-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-card bg-success/10">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Email verified</h2>
              <p className="mt-2 text-muted-foreground">
                Your account is confirmed. Let's finish setting up your workspace.
              </p>
            </div>
            <OrdoButton onClick={() => navigate("/")}>Continue to workspace</OrdoButton>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-card bg-accent/10">
              <MailCheck className="h-7 w-7 text-accent" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Check your inbox</h2>
              <p className="mt-2 text-muted-foreground">
                If confirmation is needed, a verification link will be sent to{" "}
                <strong className="text-foreground">{email || "your email address"}</strong>. Check your spam folder and use the newest link. If you already confirmed your email, sign in instead.
              </p>
            </div>

            {linkError && <OrdoAlert variant="error">{linkError}</OrdoAlert>}
            {resent && (
              <OrdoAlert variant="success">If this account needs confirmation, a new email has been requested. Already confirmed? Sign in instead.</OrdoAlert>
            )}
            {error && <OrdoAlert variant="error">{error}</OrdoAlert>}

            <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void resend(); }}>
              <OrdoInput label="Email address" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
              <OrdoButton
                variant="outline"
                loading={busy}
                disabled={cooldown > 0 || !email.trim()}
                type="submit"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend verification email"}
              </OrdoButton>
              <p className="text-center text-sm text-muted-foreground">
                Wrong email?{" "}
                <Link to="/auth/sign-up" className="font-semibold text-foreground hover:underline">
                  Start over
                </Link>
              </p>
              <Link to={`/auth?email=${encodeURIComponent(email.trim())}`} className="block text-center text-sm font-semibold hover:underline">Already verified? Sign in</Link>
            </form>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
