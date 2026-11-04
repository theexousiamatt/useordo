const PROTECTED_HOST = "ilvqopsvyacegotplstw.supabase.co";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export interface FoundationEnvironment {
  MODE?: string;
  VITE_ORDO_ARCHITECTURE?: string;
  VITE_ORDO_ENVIRONMENT?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_APP_URL?: string;
}

export function isFoundationEnvironment(environment: FoundationEnvironment) {
  return environment.VITE_ORDO_ARCHITECTURE === "foundation";
}

/** Fail closed before a foundation client can initialize against another target. */
export function assertFoundationEnvironment(environment: FoundationEnvironment, pageHostname?: string) {
  if (!isFoundationEnvironment(environment)) return;
  if (environment.MODE !== "foundation" || environment.VITE_ORDO_ENVIRONMENT !== "development") {
    throw new Error("The Ordo foundation requires the explicit foundation development mode.");
  }
  let api: URL;
  let app: URL;
  try {
    api = new URL(environment.VITE_SUPABASE_URL ?? "");
    app = new URL(environment.VITE_APP_URL ?? "");
  } catch {
    throw new Error("Configure the isolated foundation API and application origins before starting.");
  }
  if (api.hostname === PROTECTED_HOST || !LOOPBACK_HOSTS.has(api.hostname)
      || api.protocol !== "http:" || api.port !== "54321" || api.pathname !== "/"
      || api.username || api.password || api.search || api.hash) {
    throw new Error("Foundation mode accepts only the dedicated local Supabase API at port 54321.");
  }
  if (!LOOPBACK_HOSTS.has(app.hostname) || app.protocol !== "http:" || app.username || app.password
      || app.pathname !== "/" || app.search || app.hash) {
    throw new Error("Foundation authentication redirects must use an explicit local application origin.");
  }
  if (pageHostname && !LOOPBACK_HOSTS.has(pageHostname)) {
    throw new Error("The foundation development build cannot run on a hosted production origin.");
  }
  if (!environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()) {
    throw new Error("The local foundation publishable key is missing.");
  }
}

