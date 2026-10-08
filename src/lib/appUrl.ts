/** Canonical origin for links shared outside the app. Set VITE_APP_URL per environment. */

const PRODUCTION_APP_URL = "https://ordo.inspirarestudio.com";

function resolveBaseUrl(): string {
  const configured = (import.meta.env.VITE_APP_URL as string | undefined)?.trim();
  return (configured || PRODUCTION_APP_URL).replace(/\/+$/, "");
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
