import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/self-assessment",
  testMatch: "*.spec.ts",
  timeout: 30_000,
  fullyParallel: true,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:4178",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "bun --no-env-file run --cwd dashboard vite --config vite.self-assessment.config.mts",
    url: "http://127.0.0.1:4178",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
