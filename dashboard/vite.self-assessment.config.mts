import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import baseConfig from "@tamias/ui/tailwind.config";

// Isolated browser checks: no authentication setup or connection to the live API.
export default defineConfig({
  root: path.resolve(import.meta.dirname, "../e2e/self-assessment/app"),
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  css: {
    postcss: {
      plugins: [
        tailwindcss({
          ...baseConfig,
          content: [
            path.resolve(import.meta.dirname, "src/components/compliance/**/*.{ts,tsx}"),
            path.resolve(import.meta.dirname, "src/components/metrics/**/*.{ts,tsx}"),
            path.resolve(import.meta.dirname, "src/components/charts/**/*.{ts,tsx}"),
            path.resolve(import.meta.dirname, "../packages/ui/src/**/*.{ts,tsx}"),
            path.resolve(import.meta.dirname, "../e2e/self-assessment/app/**/*.tsx"),
          ],
        }),
        autoprefixer(),
      ],
    },
  },
  server: { host: "127.0.0.1", port: 4178, strictPort: true },
});
