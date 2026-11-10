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

const production = {
  MODE: "foundation-production", VITE_ORDO_ARCHITECTURE: "foundation",
  VITE_ORDO_ENVIRONMENT: "production", VITE_ORDO_TARGET_REF: "abcdefghijklmnopqrst",
  VITE_SUPABASE_PROJECT_ID: "abcdefghijklmnopqrst",
  VITE_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  VITE_APP_URL: "https://ordo.inspirarestudio.com",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
} satisfies FoundationEnvironment;

describe("hosted canonical foundation isolation", () => {
  it("accepts a precisely pinned production host and reference", () => {
    expect(() => assertFoundationEnvironment(production, "ordo.inspirarestudio.com")).not.toThrow();
  });
  it("accepts isolated staging on its own explicitly configured hostname", () => {
    const staging = { ...production, MODE: "foundation-staging",
      VITE_ORDO_ENVIRONMENT: "staging", VITE_APP_URL: "https://staging-ordo.example.com" };
    expect(() => assertFoundationEnvironment(staging, "staging-ordo.example.com")).not.toThrow();
  });
  it.each([
    { MODE: "production" },
    { VITE_ORDO_ENVIRONMENT: "staging" },
    { VITE_ORDO_TARGET_REF: "ilvqopsvyacegotplstw", VITE_SUPABASE_PROJECT_ID: "ilvqopsvyacegotplstw", VITE_SUPABASE_URL: "https://ilvqopsvyacegotplstw.supabase.co" },
    { VITE_ORDO_TARGET_REF: "cjyhayrxadyadaqdrlot" },
    { VITE_SUPABASE_PROJECT_ID: "cjyhayrxadyadaqdrlot" },
    { VITE_SUPABASE_URL: "https://cjyhayrxadyadaqdrlot.supabase.co" },
    { VITE_SUPABASE_URL: "http://abcdefghijklmnopqrst.supabase.co" },
    { VITE_APP_URL: "https://evil.example.com" },
    { VITE_APP_URL: "https://ordo.inspirarestudio.com/other" },
    { VITE_APP_URL: "http://ordo.inspirarestudio.com" },
    { VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_example" },
    { VITE_SUPABASE_PUBLISHABLE_KEY: "" },
  ])("rejects a production target mismatch: %j", (patch) => {
    expect(() => assertFoundationEnvironment({ ...production, ...patch }, "ordo.inspirarestudio.com")).toThrow();
  });
  it("rejects production code running on an unintended site", () => {
    expect(() => assertFoundationEnvironment(production, "staging-ordo.example.com")).toThrow();
  });
  it("rejects staging using the production hostname", () => {
    expect(() => assertFoundationEnvironment({ ...production, MODE: "foundation-staging",
      VITE_ORDO_ENVIRONMENT: "staging" }, "ordo.inspirarestudio.com")).toThrow();
  });
});
