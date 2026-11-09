import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import tailwind from "@tailwindcss/vite";
export default defineConfig({
  envDir: "./.no-env",
  envPrefix: "ORDO_PROOF_",
  plugins: [react(), tailwind()],
  css: { postcss: { plugins: [] } },
  server: { host: "127.0.0.1", port: 5190, strictPort: true },
  resolve: { dedupe: ["react", "react-dom"] },
  test: { environment: "jsdom", setupFiles: ["./src/test-setup.ts"], include: ["src/**/*.test.tsx"], environmentOptions: { jsdom: { pretendToBeVisual: true } } },
});
