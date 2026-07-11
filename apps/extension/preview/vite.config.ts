import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Vite config for the popup preview only (NOT the extension build — that is
 * Plasmo's job). Serves apps/extension/preview as a standalone page so the
 * popup UI is reviewable by URL, including from the Docker preview service.
 */
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5174,
  },
  preview: {
    host: "0.0.0.0",
    port: 5174,
  },
  build: {
    outDir: "../build/preview",
    emptyOutDir: true,
  },
});
