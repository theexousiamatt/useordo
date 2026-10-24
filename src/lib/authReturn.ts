/** Keep invitation context through password, OAuth, verification and recovery. */
const KEY = "ordo:invitation-return";
export function safeReturnPath(value: string | null | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return fallback;
  return value;
}
export function rememberInvitation(path: string) {
  try { sessionStorage.setItem(KEY, safeReturnPath(path)); } catch { /* Query redirects still work. */ }
}
export function forgetInvitation() { try { sessionStorage.removeItem(KEY); } catch { /* optional storage */ } }
export function authReturnPath(params: URLSearchParams) {
  const explicit = params.get("redirect");
  if (explicit) return safeReturnPath(explicit);
  try { return safeReturnPath(sessionStorage.getItem(KEY)); } catch { return "/"; }
}
export function authPath(path: string, returnTo: string, email?: string) {
  const query = new URLSearchParams();
  if (email) query.set("email", email);
  if (returnTo !== "/") query.set("redirect", safeReturnPath(returnTo));
  return path + (query.toString() ? `?${query}` : "");
}
