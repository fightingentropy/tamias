import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import baseConfig from "@tamias/ui/tailwind.config";

// Synthetic UI only. Never loads the app's saved sessions or production API.
export default defineConfig({
  root: path.resolve(import.meta.dirname, "../e2e/readiness/app"),
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  css: {
    postcss: {
      plugins: [
        tailwindcss({
          ...baseConfig,
          content: [
            path.resolve(import.meta.dirname, "src/components/public/**/*.{ts,tsx}"),
            path.resolve(import.meta.dirname, "../packages/ui/src/**/*.{ts,tsx}"),
            path.resolve(import.meta.dirname, "../e2e/readiness/app/**/*.tsx"),
          ],
        }),
        autoprefixer(),
      ],
    },
  },
  server: { host: "127.0.0.1", port: 4180, strictPort: true },
});
