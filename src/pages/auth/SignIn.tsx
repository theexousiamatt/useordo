import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  AuthLayout,
  OrdoInput,
  OrdoPasswordInput,
  OrdoCheckbox,
  OrdoButton,
  OrdoAlert,
  OrdoSocialButton,
  friendlyAuthError,
  useSocialAuth,
} from "@/components/auth";

export default function SignIn() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { signIn: socialSignIn, pending: socialPending } = useSocialAuth();

  const inviteWorkspace = params.get("workspace");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError(friendlyAuthError(error));
      return;
    }
    navigate("/");
  };

  return (
    <AuthLayout
      panelTitle={inviteWorkspace ? `Join ${inviteWorkspace}` : "Welcome back"}
      panelSubtitle="Log in to access your workspace, manage projects, and collaborate with your team."
    >
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-7">
          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-muted-foreground">Please enter your details to continue.</p>
        </div>

        {inviteWorkspace && (
          <OrdoAlert variant="info" className="mb-5" title="You've been invited">
            Sign in to join the <strong>{inviteWorkspace}</strong> workspace.
          </OrdoAlert>
        )}

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
          <OrdoPasswordInput
            label="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          <div className="flex items-center justify-between">
            <OrdoCheckbox checked={remember} onChange={setRemember} label="Remember me" />
            <Link to="/auth/forgot-password" className="text-sm font-medium text-accent hover:underline">
              Forgot password?
            </Link>
          </div>

          <OrdoButton type="submit" loading={busy}>
            Sign in
          </OrdoButton>
        </form>

        <div className="my-7 flex items-center gap-3 text-[13px] uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
          <span className="h-px flex-1 bg-border" />
          Or continue with
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="flex gap-3">
          <OrdoSocialButton
            provider="google"
            loading={socialPending === "google"}
            onClick={() => socialSignIn("google")}
          />
          <OrdoSocialButton
            provider="github"
            loading={socialPending === "github"}
            onClick={() => socialSignIn("github")}
          />
        </div>

        <p className="mt-7 text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link to="/auth/sign-up" className="font-semibold text-foreground hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
