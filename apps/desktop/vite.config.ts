import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, "src/renderer"),
  base: "./",
  build: {
    outDir: path.resolve(__dirname, "dist-electron/renderer"),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@resume-ci/core": path.resolve(__dirname, "../../packages/core/src"),
      "@resume-ci/ui": path.resolve(__dirname, "../../packages/ui/src"),
    },
  },
});
