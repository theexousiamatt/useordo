import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { MailCheck, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  AuthLayout,
  OrdoButton,
  OrdoAlert,
  friendlyAuthError,
} from "@/components/auth";

export default function VerifyEmail() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const email = params.get("email") || user?.email || "your email";

  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // If the user lands here already verified/signed in, send them onward.
  const verified = !!user?.email_confirmed_at;

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const resend = async () => {
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email,
      options: { emailRedirectTo: `${window.location.origin}/auth/verify-email` },
    });
    setBusy(false);
    if (error) {
      setError(friendlyAuthError(error));
      return;
    }
    setResent(true);
    setCooldown(45);
  };

  return (
    <AuthLayout
      showPreview={false}
      panelTitle={verified ? "You're all set" : "Verify your email"}
      panelSubtitle="Confirming your email keeps your workspace secure and unlocks the full Ordo experience."
    >
      <div className="mx-auto w-full max-w-sm">
        {verified ? (
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
            <OrdoButton onClick={() => navigate("/onboarding")}>Continue to onboarding</OrdoButton>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-card bg-accent/10">
              <MailCheck className="h-7 w-7 text-accent" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Check your inbox</h2>
              <p className="mt-2 text-muted-foreground">
                We sent a verification link to{" "}
                <strong className="text-foreground">{email}</strong>. Click it to activate your account.
              </p>
            </div>

            {resent && (
              <OrdoAlert variant="success">A new verification email is on its way.</OrdoAlert>
            )}
            {error && <OrdoAlert variant="error">{error}</OrdoAlert>}

            <div className="space-y-3">
              <OrdoButton
                variant="outline"
                loading={busy}
                disabled={cooldown > 0}
                onClick={resend}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend verification email"}
              </OrdoButton>
              <p className="text-center text-sm text-muted-foreground">
                Wrong email?{" "}
                <Link to="/auth/sign-up" className="font-semibold text-foreground hover:underline">
                  Start over
                </Link>
              </p>
            </div>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
