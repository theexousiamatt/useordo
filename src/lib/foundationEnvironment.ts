const PROTECTED_HOST = "ilvqopsvyacegotplstw.supabase.co";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const HOSTED_MODES = { "foundation-staging": "staging", "foundation-production": "production" } as const;

export interface FoundationEnvironment {
  MODE?: string;
  VITE_ORDO_ARCHITECTURE?: string;
  VITE_ORDO_ENVIRONMENT?: string;
  VITE_ORDO_TARGET_REF?: string;
  VITE_SUPABASE_PROJECT_ID?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_APP_URL?: string;
}

export function isFoundationEnvironment(environment: FoundationEnvironment) {
  return environment.VITE_ORDO_ARCHITECTURE === "foundation";
}

/** Fail closed before creating the client. No business data is queried until the server marker matches. */
export function assertFoundationEnvironment(environment: FoundationEnvironment, pageHostname?: string) {
  if (!isFoundationEnvironment(environment)) return;
  const mode = environment.MODE;
  const expectedEnvironment = mode === "foundation" ? "development" : HOSTED_MODES[mode as keyof typeof HOSTED_MODES];
  if (!expectedEnvironment || environment.VITE_ORDO_ENVIRONMENT !== expectedEnvironment) {
    throw new Error("Ordo foundation requires an explicit matching build mode and environment.");
  }
  let api: URL;
  let app: URL;
  try {
    api = new URL(environment.VITE_SUPABASE_URL ?? "");
    app = new URL(environment.VITE_APP_URL ?? "");
  } catch {
    throw new Error("Configure the explicit foundation API and application origins.");
  }
  if (!environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
    || /^(?:sb_secret_|eyJ)/.test(environment.VITE_SUPABASE_PUBLISHABLE_KEY)) {
    throw new Error("A publishable, non-privileged foundation key is required.");
  }
  if (mode === "foundation") {
    if (api.hostname === PROTECTED_HOST || !LOOPBACK_HOSTS.has(api.hostname)
      || api.protocol !== "http:" || api.port !== "54321" || api.pathname !== "/"
      || api.username || api.password || api.search || api.hash) {
      throw new Error("Foundation development accepts only the dedicated local API at port 54321.");
    }
    if (!LOOPBACK_HOSTS.has(app.hostname) || app.protocol !== "http:" || app.username || app.password
      || app.pathname !== "/" || app.search || app.hash) {
      throw new Error("Foundation development redirects require a local application origin.");
    }
    if (pageHostname && !LOOPBACK_HOSTS.has(pageHostname)) {
      throw new Error("A development build cannot run on a hosted origin.");
    }
    return;
  }
  const ref = environment.VITE_ORDO_TARGET_REF;
  if (!ref || !/^[a-z]{20}$/.test(ref) || ref === "ilvqopsvyacegotplstw"
    || environment.VITE_SUPABASE_PROJECT_ID !== ref) {
    throw new Error("A separate verified hosted foundation project must be pinned by reference.");
  }
  if (api.origin !== `https://${ref}.supabase.co` || api.pathname !== "/" || api.search
    || api.hash || api.username || api.password) {
    throw new Error("The hosted foundation API does not match the pinned project.");
  }
  if (app.protocol !== "https:" || app.username || app.password || app.pathname !== "/"
    || app.search || app.hash || app.port) {
    throw new Error("Hosted foundation redirects require one clean HTTPS origin.");
  }
  if (expectedEnvironment === "production" && app.hostname !== "ordo.inspirarestudio.com") {
    throw new Error("The production application origin is not authorized.");
  }
  if (expectedEnvironment === "staging" && app.hostname === "ordo.inspirarestudio.com") {
    throw new Error("A staging build cannot target the production application origin.");
  }
  if (pageHostname && pageHostname !== app.hostname) {
    throw new Error("The hosted foundation build is running on an unexpected origin.");
  }
}
