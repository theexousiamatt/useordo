/**
 * Canonical application URL for Edge Functions / server-side email rendering.
 *
 * Single source of truth for deep links generated on the server. Configure with
 * the `APP_URL` secret (e.g. https://app.useordo.app). Never emit Lovable
 * preview, staging, or localhost URLs in production emails.
 */

const PRODUCTION_APP_URL = "https://app.useordo.app";

export const APP_URL: string = (() => {
  try {
    // deno-lint-ignore no-explicit-any
    const env = (globalThis as any).Deno?.env?.get?.("APP_URL") as string | undefined;
    if (env && env.trim()) return env.trim().replace(/\/+$/, "");
  } catch {
    /* ignore */
  }
  return PRODUCTION_APP_URL;
})();

/** Build an absolute application URL from a path and optional query params. */
export function buildAppUrl(
  path: string,
  params?: Record<string, string | number | undefined | null>,
): string {
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

/** Deep link to the workspace invitation acceptance flow. */
export function inviteUrl(token: string): string {
  return buildAppUrl("/auth/invite", { token });
}
