import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { assertFoundationEnvironment, type FoundationEnvironment } from "./src/lib/foundationEnvironment";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const environment: FoundationEnvironment = { ...loadEnv(mode, process.cwd(), ""), MODE: mode };
  if (["foundation", "foundation-staging", "foundation-preview", "foundation-production"].includes(mode) && environment.VITE_ORDO_ARCHITECTURE !== "foundation") {
    throw new Error("Configure the explicit foundation environment for the selected build mode.");
  }
  assertFoundationEnvironment(environment);
  return {
  server: {
    host: mode === "foundation" ? "127.0.0.1" : "::",
    port: mode === "foundation" ? 5182 : 8080,
    strictPort: mode === "foundation",
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), tailwindcss()],
  build: mode.startsWith("foundation") ? { outDir: mode === "foundation" ? "dist-foundation" : "dist-foundation-hosted" } : undefined,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  };
});
