import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { assertFoundationEnvironment, type FoundationEnvironment } from "./src/lib/foundationEnvironment";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const environment: FoundationEnvironment = { ...loadEnv(mode, process.cwd(), ""), MODE: mode };
  if (mode === "foundation" && environment.VITE_ORDO_ARCHITECTURE !== "foundation") {
    throw new Error("Configure .env.foundation.local before starting the isolated Ordo foundation.");
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
  build: mode === "foundation" ? { outDir: "dist-foundation" } : undefined,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  };
});
