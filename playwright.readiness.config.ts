import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/readiness",
  testMatch: "*.spec.ts",
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:4180", screenshot: "only-on-failure" },
  webServer: {
    command: "bun --no-env-file run --cwd dashboard vite --config vite.readiness.config.mts",
    url: "http://127.0.0.1:4180",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
