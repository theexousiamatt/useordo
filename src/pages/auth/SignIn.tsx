import { authReturnPath, authPath, safeReturnPath } from "@/lib/authReturn";
import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { friendlyAuthError, useSocialAuth } from "@/components/auth";
import { JenriAuthLayout, JenriAuthIntro, JenriPasswordField, JenriSocialButton } from "@/components/jenri/JenriAuth";
import { Loader2 } from "lucide-react";

export default function SignIn() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const [params] = useSearchParams();
  const returnPath = authReturnPath(params);

  const inviteWorkspace = params.get("workspace");
  const [email, setEmail] = useState(params.get("email") || "");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Where to return after a successful login. Priority:
  // 1. The protected route the user was bounced from (state.from), so email
  //    deep links like /projects/:id?task=:id survive the auth round-trip.
  // 2. A `redirect` query param (absolute-path only, to avoid open redirects).
  // 3. Home.
  const fromState = (routerLocation.state as { from?: { pathname?: string; search?: string } } | null)?.from;
  const redirectParam = params.get("redirect");
  const returnTo =
    (fromState?.pathname ? `${fromState.pathname}${fromState.search ?? ""}` : null) ??
    safeReturnPath(redirectParam, returnPath);
  const { signIn: socialSignIn, pending: socialPending } = useSocialAuth(returnTo);
  const [appleBusy, setAppleBusy] = useState(false);
  const signInWithApple = async () => {
    setAppleBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: { redirectTo: new URL(safeReturnPath(returnTo), window.location.origin).toString() },
      });
      if (error) toast.error(friendlyAuthError(error));
    } catch (err) { toast.error(friendlyAuthError(err)); }
    finally { setAppleBusy(false); }
  };

  if (loading) return null;
  if (user) return <Navigate to={returnTo} replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (busy) return;
    setNeedsVerification(false);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setError(friendlyAuthError(error));
        setNeedsVerification(error.code === "email_not_confirmed" || /not confirmed/i.test(error.message));
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
    <JenriAuthLayout page="sign-in">
      <JenriAuthIntro
        title="Welcome back"
        subtitle={returnTo.startsWith("/auth/invite?") ? "Sign in to open your invitation." : "Pick up where you left off."}
        accountSwitch={<>New to Jenri?{" "}
          <Link to={authPath("/auth/sign-up", returnTo, email.trim())}>Create an account</Link>
        </>}
      />
      {inviteWorkspace && <p className="jenri-auth-error jenri-auth-invite" role="status">
        You've been invited to join <strong>{inviteWorkspace}</strong>.
      </p>}
      <section className="jenri-social-section" aria-label="Other ways to sign in">
        <div className="jenri-social-actions">
          <JenriSocialButton provider="google" busy={socialPending === "google"}
            disabled={busy || appleBusy} onClick={() => void socialSignIn("google")} />
          <JenriSocialButton provider="apple" busy={appleBusy}
            disabled={busy || !!socialPending} onClick={() => void signInWithApple()} />
        </div>
      </section>
      <p className="jenri-social-label jenri-auth-separator">Or</p>
      {error && <p className="jenri-auth-error" role="alert">{error}</p>}
      {needsVerification && <Link className="jenri-utility-link" style={{display:"block", margin:"12px 0"}}
        to={authPath("/auth/verify-email", returnTo, email.trim())}>Request a new verification email</Link>}
      <form onSubmit={onSubmit} className="jenri-auth-form" style={{marginTop:error?16:0}}>
        <input className="jenri-field" type="email" aria-label="Email address" placeholder="Email"
          autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
        <JenriPasswordField label="Password" required autoComplete="current-password"
          value={password} onChange={e => setPassword(e.target.value)} />
        <div className="jenri-forgot">
          <Link className="jenri-utility-link" to={authPath("/auth/forgot-password", returnTo, email.trim())}>Forgot password?</Link>
        </div>
        <button type="submit" className="jenri-primary-button" disabled={busy || !!socialPending || appleBusy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Sign in
        </button>
      </form>
    </JenriAuthLayout>
  );
}
