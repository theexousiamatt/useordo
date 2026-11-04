import { describe, expect, it } from "vitest";
import { assertFoundationEnvironment, type FoundationEnvironment } from "./foundationEnvironment";

const valid: FoundationEnvironment = {
  MODE: "foundation", VITE_ORDO_ARCHITECTURE: "foundation", VITE_ORDO_ENVIRONMENT: "development",
  VITE_SUPABASE_URL: "http://127.0.0.1:54321", VITE_APP_URL: "http://127.0.0.1:5182",
  VITE_SUPABASE_PUBLISHABLE_KEY: "local-test-publishable-key",
};

describe("foundation client isolation", () => {
  it("accepts the dedicated local foundation and leaves the existing mode independent", () => {
    expect(() => assertFoundationEnvironment(valid, "127.0.0.1")).not.toThrow();
    expect(() => assertFoundationEnvironment({ MODE: "production" })).not.toThrow();
  });
  it.each([
    { MODE: "production" },
    { VITE_ORDO_ENVIRONMENT: "production" },
    { VITE_SUPABASE_URL: "https://ilvqopsvyacegotplstw.supabase.co" },
    { VITE_SUPABASE_URL: "https://unregistered.supabase.co" },
    { VITE_SUPABASE_URL: "http://127.0.0.1:54320" },
    { VITE_SUPABASE_URL: "http://name:password@127.0.0.1:54321" },
    { VITE_SUPABASE_URL: "http://127.0.0.1:54321/rest/v1" },
    { VITE_APP_URL: "https://ordo.inspirarestudio.com" },
    { VITE_SUPABASE_PUBLISHABLE_KEY: "" },
  ])("rejects unsafe or incomplete configuration %j", (patch) => {
    expect(() => assertFoundationEnvironment({ ...valid, ...patch })).toThrow();
  });
  it("rejects a local foundation bundle running on a hosted page", () => {
    expect(() => assertFoundationEnvironment(valid, "ordo.inspirarestudio.com")).toThrow();
  });
});
