import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "../..");

function resolveDashboardPath(...segments: string[]) {
  return path.resolve(__dirname, ...segments);
}

function isLocalUrl(value: string | undefined) {
  return Boolean(
    value &&
      /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(value),
  );
}

function getBuildEnvValue(
  mode: string,
  explicitValue: string | undefined,
  fallbackValue: string,
) {
  if (mode === "production" && isLocalUrl(explicitValue)) {
    return fallbackValue;
  }

  return explicitValue ?? fallbackValue;
}

function getPublicEnv(mode: string) {
  const env = loadEnv(mode, __dirname, "");

  const dashboardUrl = getBuildEnvValue(
    mode,
    env.DASHBOARD_URL ?? env.TAMIAS_DASHBOARD_URL,
    mode === "production" ? "https://app.tamias.xyz" : "http://localhost:3001",
  );
  const apiUrl = getBuildEnvValue(
    mode,
    env.API_URL ?? env.TAMIAS_API_URL,
    mode === "production" ? "https://api.tamias.xyz" : "http://localhost:3003",
  );
  const websiteUrl = getBuildEnvValue(
    mode,
    env.WEBSITE_URL ?? env.TAMIAS_WEBSITE_URL,
    mode === "production" ? "https://tamias.xyz" : "http://localhost:3000",
  );
  const convexUrl = getBuildEnvValue(
    mode,
    env.CONVEX_URL ?? env.TAMIAS_CONVEX_URL,
    mode === "production"
      ? "https://fleet-chameleon-251.eu-west-1.convex.cloud"
      : "",
  );
  const convexSiteUrl = getBuildEnvValue(
    mode,
    env.CONVEX_SITE_URL ?? env.TAMIAS_CONVEX_SITE_URL,
    mode === "production"
      ? "https://fleet-chameleon-251.eu-west-1.convex.site"
      : "",
  );
  const stripePublishableKey = env.STRIPE_PUBLISHABLE_KEY ?? "";
  const tellerApplicationId = env.TELLER_APPLICATION_ID ?? "";
  const tellerEnvironment = env.TELLER_ENVIRONMENT ?? "";
  const plaidEnvironment = env.PLAID_ENVIRONMENT ?? "";
  const googleApiKey = env.GOOGLE_API_KEY ?? "";
  const whatsappNumber = env.WHATSAPP_NUMBER ?? "";
  const openPanelClientId = env.OPENPANEL_CLIENT_ID ?? "";
  const logsnagProject = env.LOGSNAG_PROJECT ?? "";
  const logsnagDisabled = env.LOGSNAG_DISABLED ?? "";

  return {
    NODE_ENV: mode === "production" ? "production" : "development",
    DASHBOARD_URL: dashboardUrl,
    API_URL: apiUrl,
    WEBSITE_URL: websiteUrl,
    CONVEX_URL: convexUrl,
    CONVEX_SITE_URL: convexSiteUrl,
    STRIPE_PUBLISHABLE_KEY: stripePublishableKey,
    TELLER_APPLICATION_ID: tellerApplicationId,
    TELLER_ENVIRONMENT: tellerEnvironment,
    PLAID_ENVIRONMENT: plaidEnvironment,
    GOOGLE_API_KEY: googleApiKey,
    WHATSAPP_NUMBER: whatsappNumber,
    OPENPANEL_CLIENT_ID: openPanelClientId,
    LOGSNAG_PROJECT: logsnagProject,
    LOGSNAG_DISABLED: logsnagDisabled,
  };
}

export default defineConfig(({ mode, command }) => {
  const publicEnv = getPublicEnv(mode);
  const defineEntries = Object.fromEntries(
    Object.entries(publicEnv).map(([key, value]) => [
      `process.env.${key}`,
      JSON.stringify(value),
    ]),
  );
  const workerVars = {
    TAMIAS_ENVIRONMENT:
      process.env.TAMIAS_ENVIRONMENT ??
      (mode === "production" ? "production" : "development"),
    API_URL: publicEnv.API_URL,
    DASHBOARD_URL: publicEnv.DASHBOARD_URL,
    WEBSITE_URL: publicEnv.WEBSITE_URL,
    CONVEX_URL: publicEnv.CONVEX_URL,
    CONVEX_SITE_URL: publicEnv.CONVEX_SITE_URL,
    STRIPE_PUBLISHABLE_KEY: publicEnv.STRIPE_PUBLISHABLE_KEY,
    TELLER_APPLICATION_ID: publicEnv.TELLER_APPLICATION_ID,
    TELLER_ENVIRONMENT: publicEnv.TELLER_ENVIRONMENT,
    PLAID_ENVIRONMENT: publicEnv.PLAID_ENVIRONMENT,
    GOOGLE_API_KEY: publicEnv.GOOGLE_API_KEY,
    WHATSAPP_NUMBER: publicEnv.WHATSAPP_NUMBER,
    OPENPANEL_CLIENT_ID: publicEnv.OPENPANEL_CLIENT_ID,
    LOGSNAG_PROJECT: publicEnv.LOGSNAG_PROJECT,
    LOGSNAG_DISABLED: publicEnv.LOGSNAG_DISABLED,
  };

  return {
    plugins: [
      cloudflare({
        configPath: "./wrangler.start.jsonc",
        config:
          command === "serve"
            ? {
                main: "./src/start/server.ts",
                vars: workerVars,
              }
            : {
                main: "./src/start/server.ts",
              },
        viteEnvironment: { name: "ssr" },
      }),
      ...tanstackStart({
        router: {
          entry: "./start/router.tsx",
          routesDirectory: "./start/routes",
          generatedRouteTree: "./start/routeTree.gen.ts",
        },
        start: {
          entry: "./start/start.ts",
        },
        server: {
          entry: "./start/server.ts",
        },
      }),
      react(),
    ],
    resolve: {
      alias: [
        {
          find: "@",
          replacement: resolveDashboardPath("./src"),
        },
        {
          find: "@convex",
          replacement: resolveDashboardPath("./convex"),
        },
        {
          find: "@app-data",
          replacement: resolveDashboardPath("../../packages/app-data/src"),
        },
        {
          find: "@convex-dev/auth/react",
          replacement: resolveDashboardPath("./src/framework/convex-auth-client.tsx"),
        },
        {
          find: "nuqs/adapters/tanstack-router",
          replacement: resolveDashboardPath("./src/framework/nuqs/tanstack-router.tsx"),
        },
        {
          find: "nuqs/server",
          replacement: resolveDashboardPath("./src/framework/nuqs/server.ts"),
        },
        {
          find: "nuqs",
          replacement: resolveDashboardPath("./src/framework/nuqs/index.tsx"),
        },
        {
          find: /^process\/?$/,
          replacement: resolveDashboardPath("../../node_modules/process/browser.js"),
        },
      ],
      dedupe: ["react", "react-dom"],
    },
    define: defineEntries,
    envDir: __dirname,
    server: {
      host: "0.0.0.0",
      port: 3001,
      fs: {
        allow: [workspaceRoot],
      },
      allowedHosts: [
        "localhost",
        "127.0.0.1",
        "tamias.test",
        ".tamias.test",
      ],
    },
    preview: {
      host: "0.0.0.0",
      port: 3001,
    },
    build: {
      sourcemap: true,
    },
    ssr: {
      noExternal: [
        /^@tanstack\/react-start(?:\/.*)?$/,
        /^@tanstack\/start-storage-context(?:\/.*)?$/,
      ],
    },
    css: {
      postcss: resolveDashboardPath("./postcss.config.cjs"),
    },
  };
});
