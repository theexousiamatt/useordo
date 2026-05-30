import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  AuthLayout,
  OrdoInput,
  OrdoButton,
  OrdoAlert,
  friendlyAuthError,
} from "@/components/auth";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      setError(friendlyAuthError(error));
      return;
    }
    setSent(true);
  };

  return (
    <AuthLayout
      panelTitle="Reset your password"
      panelSubtitle="We'll email you a secure link to set a new password and get you back into your workspace."
    >
      <div className="mx-auto w-full max-w-sm">
        <Link
          to="/auth"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>

        {sent ? (
          <div className="space-y-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-card bg-success/10">
              <MailCheck className="h-7 w-7 text-success" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Check your inbox</h2>
              <p className="mt-2 text-muted-foreground">
                We sent a reset link to <strong className="text-foreground">{email}</strong>. The link
                expires in 60 minutes.
              </p>
            </div>
            <OrdoButton variant="outline" onClick={() => setSent(false)}>
              Use a different email
            </OrdoButton>
          </div>
        ) : (
          <>
            <div className="mb-7">
              <h2 className="text-2xl font-semibold tracking-tight">Forgot password</h2>
              <p className="mt-1 text-muted-foreground">
                Enter your email and we'll send you a reset link.
              </p>
            </div>

            {error && (
              <OrdoAlert variant="error" className="mb-5">
                {error}
              </OrdoAlert>
            )}

            <form onSubmit={onSubmit} className="space-y-5">
              <OrdoInput
                label="Email address"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
              />
              <OrdoButton type="submit" loading={busy}>
                Send reset link
              </OrdoButton>
            </form>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
