/// <reference types="vitest/config" />
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Two documents, not a router (ADR-0006): the Landing Page at `/`, the app at `/app`.
  // `mpa` removes the SPA fallback, so an unmatched path 404s instead of being
  // rewritten to the Landing Page — which is what Cloudflare does in production.
  appType: "mpa",
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        landing: resolve(import.meta.dirname, "index.html"),
        app: resolve(import.meta.dirname, "app/index.html"),
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
