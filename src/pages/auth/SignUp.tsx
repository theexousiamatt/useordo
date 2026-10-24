import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { buildAppUrl } from "@/lib/appUrl";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  AuthLayout,
  OrdoInput,
  OrdoPasswordInput,
  OrdoButton,
  OrdoAlert,
  OrdoSocialButton,
  friendlyAuthErrorDetailed,
  evaluatePassword,
  useSocialAuth,
  logAuthError,
} from "@/components/auth";
import type { AuthErrorField } from "@/components/auth";

export default function SignUp() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { signIn: socialSignIn, pending: socialPending } = useSocialAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingAccount, setExistingAccount] = useState(false);
  const [fieldError, setFieldError] = useState<AuthErrorField>(null);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setExistingAccount(false);
    setFieldError(null);
    if (password.length < 8 || evaluatePassword(password).score < 2) {
      setError("Please choose a stronger password (at least 8 characters).");
      setFieldError("password");
      logAuthError("signup_weak_password", { code: "weak_password" }, "password");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match. Please re-enter them.");
      setFieldError("password");
      logAuthError("signup_password_mismatch", { code: "password_mismatch" }, "password");
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const normalizedEmail = email.trim();
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: buildAppUrl("/auth/verify-email"),
          data: { full_name: fullName.trim() },
        },
      });
      if (error) {
        if (error.code === "user_already_exists" || /already (?:been )?registered/i.test(error.message)) {
          setExistingAccount(true);
          return;
        }
        const detailed = friendlyAuthErrorDetailed(error);
        setError(detailed.message);
        setFieldError(detailed.field);
        logAuthError("signup_failed", error, detailed.field);
        return;
      }
      if (data.session) {
        navigate("/", { replace: true });
        return;
      }
      // Supabase can return an obfuscated user for repeat signup instead of an error.
      if (Array.isArray(data.user?.identities) && data.user.identities.length === 0) {
        setExistingAccount(true);
        return;
      }
      navigate(`/auth/verify-email?email=${encodeURIComponent(normalizedEmail)}`);
    } catch (err) {
      setError(friendlyAuthErrorDetailed(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      panelTitle="Create your workspace"
      panelSubtitle="Set up Ordo in minutes and start running projects, deliverables and client collaboration in one place."
    >
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-7">
          <h2 className="text-2xl font-semibold tracking-tight">Create account</h2>
          <p className="mt-1 text-muted-foreground">Start your free Ordo workspace.</p>
        </div>

        {existingAccount && (
          <OrdoAlert variant="info" className="mb-5" title="You already have an account">
            <span>This email is already registered. Sign in to continue. No new confirmation email was sent.</span>
            <span className="mt-3 flex flex-wrap gap-x-5 gap-y-2 font-semibold">
              <Link className="underline underline-offset-4" to={`/auth?email=${encodeURIComponent(email.trim())}`}>Sign in</Link>
              <Link className="underline underline-offset-4" to={`/auth/forgot-password?email=${encodeURIComponent(email.trim())}`}>Reset password</Link>
            </span>
          </OrdoAlert>
        )}
        {error && !fieldError && (
          <OrdoAlert variant="error" className="mb-5">
            {error}
          </OrdoAlert>
        )}

        <form onSubmit={onSubmit} className="space-y-5">
          <OrdoInput
            label="Full name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Doe"
            autoComplete="name"
          />
          <OrdoInput
            label="Email address"
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldError === "email") setFieldError(null);
            }}
            placeholder="you@company.com"
            autoComplete="email"
            error={fieldError === "email" ? error ?? undefined : undefined}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <OrdoPasswordInput
              label="Password"
              required
              showStrength
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldError === "password") setFieldError(null);
              }}
              autoComplete="new-password"
              error={fieldError === "password" ? error ?? undefined : undefined}
            />
            <OrdoPasswordInput
              label="Confirm password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              error={
                confirm && confirm !== password
                  ? "Passwords don't match"
                  : fieldError === "password"
                    ? " "
                    : undefined
              }
            />
          </div>


          <OrdoButton type="submit" loading={busy}>
            Create account
          </OrdoButton>
        </form>

        <div className="my-7 flex items-center gap-3 text-[13px] uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
          <span className="h-px flex-1 bg-border" />
          Or sign up with
          <span className="h-px flex-1 bg-border" />
        </div>

        <OrdoSocialButton
          provider="google"
          className="w-full"
          loading={socialPending === "google"}
          onClick={() => socialSignIn("google")}
        />

        <p className="mt-7 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/auth" className="font-semibold text-foreground hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
