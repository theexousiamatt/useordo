/**
 * Canonical application URL — the single source of truth for every deep link
 * that leaves the app (emails, notifications, and future push / universal links).
 *
 * Links inside emails must ALWAYS point at the production Ordo application,
 * never at a Lovable preview/generated domain (`*.lovableproject.com`,
 * `*.lovable.app`), a staging host, or `localhost`. Because emails are often
 * composed client-side, we cannot trust `window.location.origin` — in preview
 * that resolves to a Lovable domain. Instead we resolve a stable base URL from
 * environment configuration with a production fallback.
 *
 * Configure per environment with the `VITE_APP_URL` build variable, e.g.:
 *   - Development: http://localhost:3000
 *   - Staging:     https://staging.useordo.app
 *   - Production:  https://ordo.inspirarestudio.com
 */

const PRODUCTION_APP_URL = "https://ordo.inspirarestudio.com";

// Hosts we must never emit in shareable/email links.
const NON_CANONICAL_HOST = /(^localhost$|127\.0\.0\.1|lovableproject\.com$|lovable\.app$|lovable\.dev$)/i;

function resolveBaseUrl(): string {
  const configured = (import.meta.env.VITE_APP_URL as string | undefined)?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  // No explicit config: fall back to the current origin only when it is a real
  // (non-Lovable, non-local) host; otherwise use the production URL so email
  // links never leak a preview/dev domain.
  if (typeof window !== "undefined") {
    const { hostname, origin } = window.location;
    if (!NON_CANONICAL_HOST.test(hostname)) return origin.replace(/\/+$/, "");
  }

  return PRODUCTION_APP_URL;
}

/**
 * The canonical application base URL (no trailing slash).
 */
export const APP_URL = resolveBaseUrl();

/**
 * Build an absolute application URL from a path and optional query params.
 * Always rooted at the canonical {@link APP_URL}.
 *
 * @example buildAppUrl("/projects/123", { task: "abc" })
 *   -> "https://ordo.inspirarestudio.com/projects/123?task=abc"
 */
export function buildAppUrl(path: string, params?: Record<string, string | number | undefined | null>): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(normalizedPath, `${APP_URL}/`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

/** Deep link to a project, optionally opening a specific task drawer. */
export function projectUrl(projectId: string, taskId?: string): string {
  return buildAppUrl(`/projects/${projectId}`, taskId ? { task: taskId } : undefined);
}

/** Deep link that opens the workspace invitation acceptance flow. */
export function inviteUrl(token: string): string {
  return buildAppUrl("/auth/invite", { token });
}
