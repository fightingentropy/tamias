import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));

const appBaseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://app.tamias.test:3001";
const localBaseURL = process.env.PLAYWRIGHT_LOCAL_BASE_URL ?? "http://127.0.0.1:3001";
const webServerURL =
  process.env.PLAYWRIGHT_WEB_SERVER_URL ?? new URL("/login", localBaseURL).toString();
const authStatePath = path.join(repoRoot, "e2e", ".auth", "user.json");
const sharedApiUrl = "https://api.tamias.xyz";
const webServerCommand = `DASHBOARD_URL=${appBaseURL} API_URL=${sharedApiUrl} bun run --cwd dashboard build:start && DASHBOARD_URL=${appBaseURL} API_URL=${sharedApiUrl} bun run --cwd dashboard preview:start`;
const hostResolverRules = "MAP tamias.test 127.0.0.1, MAP *.tamias.test 127.0.0.1";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: localBaseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: { cookies: [], origins: [] },
        launchOptions: {
          args: [`--host-resolver-rules=${hostResolverRules}`],
        },
      },
    },
    {
      name: "chromium-start",
      dependencies: ["setup"],
      testMatch: /.*\.smoke\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: authStatePath,
        launchOptions: {
          args: [`--host-resolver-rules=${hostResolverRules}`],
        },
      },
    },
  ],
  webServer: {
    command: webServerCommand,
    cwd: repoRoot,
    url: webServerURL,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
