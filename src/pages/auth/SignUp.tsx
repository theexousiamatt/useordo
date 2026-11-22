import { authReturnPath, authPath } from "@/lib/authReturn";
import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { buildAppUrl } from "@/lib/appUrl";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { friendlyAuthError, friendlyAuthErrorDetailed, evaluatePassword, useSocialAuth, logAuthError } from "@/components/auth";
import { JenriAuthLayout, JenriAuthIntro, JenriPasswordField, JenriSocialButton } from "@/components/jenri/JenriAuth";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { AuthErrorField } from "@/components/auth";

export default function SignUp() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = authReturnPath(params);
  const invited = returnTo.startsWith("/auth/invite?");
  const { signIn: socialSignIn, pending: socialPending } = useSocialAuth(returnTo);
  const [appleBusy, setAppleBusy] = useState(false);
  const signInWithApple = async () => {
    setAppleBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: { redirectTo: new URL(returnTo, window.location.origin).toString() },
      });
      if (error) toast.error(friendlyAuthError(error));
    } catch (err) { toast.error(friendlyAuthError(err)); }
    finally { setAppleBusy(false); }
  };

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingAccount, setExistingAccount] = useState(false);
  const [fieldError, setFieldError] = useState<AuthErrorField>(null);

  if (loading) return null;
  if (user) return <Navigate to={returnTo} replace />;

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
    if (busy) return;
    setBusy(true);
    try {
      const normalizedEmail = email.trim();
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: buildAppUrl(authPath("/auth/verify-email", returnTo)),
          data: { full_name: `${firstName.trim()} ${lastName.trim()}`.trim() },
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
        navigate(returnTo, { replace: true });
        return;
      }
      // Supabase can return an obfuscated user for repeat signup instead of an error.
      if (Array.isArray(data.user?.identities) && data.user.identities.length === 0) {
        setExistingAccount(true);
        return;
      }
      navigate(authPath("/auth/verify-email", returnTo, normalizedEmail));
    } catch (err) {
      setError(friendlyAuthErrorDetailed(err).message);
    } finally {
      setBusy(false);
    }
  };


  return (
    <JenriAuthLayout page="sign-up">
      <JenriAuthIntro title={invited ? "Join your team." : "Make room for better work."}
        subtitle={invited ? "Create an account to accept your invitation." : "Bring your projects, tasks, and people together in one place."}
        accountSwitch={<>Have an account?{" "}
          <Link to={authPath("/auth", returnTo, email.trim())}>Log in here</Link>
        </>}
      />
      <section className="jenri-social-section" aria-label="Other ways to create an account">
        <div className="jenri-social-actions">
          <JenriSocialButton provider="google" action="Sign up" busy={socialPending === "google"}
            disabled={busy || appleBusy} onClick={() => void socialSignIn("google")} />
          <JenriSocialButton provider="apple" action="Sign up" busy={appleBusy}
            disabled={busy || !!socialPending} onClick={() => void signInWithApple()} />
        </div>
      </section>
      <p className="jenri-social-label jenri-auth-separator">Or</p>
      {existingAccount && <div className="jenri-auth-error" role="status">
        This email is already registered.{" "}
        <Link to={authPath("/auth", returnTo, email.trim())}>Sign in</Link> or{" "}
        <Link to={authPath("/auth/forgot-password", returnTo, email.trim())}>reset password</Link>.
      </div>}
      {error && <div className="jenri-auth-error" role="alert" style={{marginTop:12}}>{error}</div>}
      <form onSubmit={onSubmit} className="jenri-auth-form" style={{marginTop:error || existingAccount?16:0}}>
        <div className="jenri-field-split">
          <input className="jenri-field" aria-label="First name" placeholder="First Name" autoComplete="given-name"
            required value={firstName} onChange={e => setFirstName(e.target.value)} />
          <input className="jenri-field" aria-label="Last name" placeholder="Last Name" autoComplete="family-name"
            required value={lastName} onChange={e => setLastName(e.target.value)} />
        </div>
        <input className="jenri-field" type="email" aria-label="Email address" placeholder="Email" autoComplete="email"
          required value={email} aria-invalid={fieldError === "email"} onChange={e => {
            setEmail(e.target.value);
            if(fieldError === "email") setFieldError(null);
          }} />
        <JenriPasswordField label="Password" required autoComplete="new-password" minLength={8}
          aria-invalid={fieldError === "password"} value={password} onChange={e => {
            setPassword(e.target.value);
            if(fieldError === "password") setFieldError(null);
          }} />
        <button type="submit" className="jenri-primary-button" disabled={busy || !!socialPending || appleBusy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Create account
        </button>
      </form>
    </JenriAuthLayout>
  );
}
