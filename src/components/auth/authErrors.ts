/**
 * Convert raw Supabase / network errors into premium, user-friendly copy.
 * Never surface raw backend strings in the auth UI.
 */
export function friendlyAuthError(error: unknown): string {
  const raw =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : "";

  const msg = raw.toLowerCase();
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";

  if (code === "over_email_send_rate_limit")
    return "Please wait at least a minute before requesting another email. Use the newest link in your inbox.";
  if (code === "email_address_not_authorized" || msg.includes("error sending") || msg.includes("smtp"))
    return "We couldn't send the email. Please try again later or contact support if it continues.";
  if (code === "otp_expired")
    return "This link is invalid, expired, or already used. Please request a new one.";

  if (!raw) return "Something went wrong. Please try again.";

  if (msg.includes("invalid login") || msg.includes("invalid credentials"))
    return "The email or password you entered is incorrect.";
  if (msg.includes("email not confirmed") || msg.includes("not confirmed"))
    return "Please verify your email before signing in. Check your inbox for the link.";
  if (msg.includes("user already registered") || msg.includes("already been registered"))
    return "An account with this email already exists. Try signing in instead.";
  if (msg.includes("password should be") || msg.includes("at least 6"))
    return "Your password must be at least 6 characters long.";
  if (msg.includes("rate limit") || msg.includes("too many") || msg.includes("429"))
    return "Too many attempts. Please wait a moment and try again.";
  if (msg.includes("locked"))
    return "This account is temporarily locked. Please try again later.";
  if (msg.includes("expired"))
    return "This link has expired. Please request a new one.";
  if (msg.includes("invalid refresh token") || msg.includes("session"))
    return "Your session has expired. Please sign in again.";
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch"))
    return "Network problem. Check your connection and try again.";
  if (msg.includes("unsupported provider") || msg.includes("provider is not enabled"))
    return "This sign-in method isn't available yet.";
  if (msg.includes("redirect"))
    return "Sign-in couldn't complete. Please try again.";

  return "Something went wrong. Please try again.";
}

export type AuthErrorField = "email" | "password" | "fullName" | null;

export interface DetailedAuthError {
  message: string;
  field: AuthErrorField;
}

/**
 * Map a raw Supabase / network error to friendly copy plus the input field
 * (if any) that the message relates to, so the UI can highlight it.
 */
export function friendlyAuthErrorDetailed(error: unknown): DetailedAuthError {
  const raw =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : "";

  const msg = raw.toLowerCase();
  const message = friendlyAuthError(error);

  let field: AuthErrorField = null;
  if (
    msg.includes("already registered") ||
    msg.includes("already been registered") ||
    msg.includes("invalid email") ||
    msg.includes("email address is invalid") ||
    msg.includes("unable to validate email") ||
    msg.includes("email not confirmed") ||
    msg.includes("not confirmed")
  ) {
    field = "email";
  } else if (
    msg.includes("password should be") ||
    msg.includes("at least 6") ||
    msg.includes("password is too weak") ||
    msg.includes("weak password") ||
    msg.includes("pwned") ||
    msg.includes("leaked")
  ) {
    field = "password";
  }

  return { message, field };
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  checks: { label: string; met: boolean }[];
}

export function evaluatePassword(password: string): PasswordStrength {
  const checks = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "An uppercase letter", met: /[A-Z]/.test(password) },
    { label: "A number", met: /[0-9]/.test(password) },
    { label: "A symbol", met: /[^A-Za-z0-9]/.test(password) },
  ];
  const met = checks.filter((c) => c.met).length;
  const score = (password.length === 0 ? 0 : met) as PasswordStrength["score"];
  const labels = ["Too weak", "Weak", "Fair", "Good", "Strong"];
  return { score, label: labels[score], checks };
}
