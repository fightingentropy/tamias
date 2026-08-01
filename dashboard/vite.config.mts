import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import babel from "@rolldown/plugin-babel";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { loadRuntimeEnvironment } from "../scripts/lib/runtime-env";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..");

function resolveDashboardPath(...segments: string[]) {
  return path.resolve(__dirname, ...segments);
}

const PATCHED_ADD_DOM_EVENT = `function addDomEvent(target, eventName, handler, options = { passive: true }) {
    const merged =
        eventName === "resize" &&
        options &&
        typeof options === "object" &&
        options.passive === true
            ? { ...options, passive: false }
            : options;
    target.addEventListener(eventName, handler, merged);
    return () => target.removeEventListener(eventName, handler);
}

export { addDomEvent };
`;

const PATCHED_ADD_DOM_EVENT_FUNCTION = PATCHED_ADD_DOM_EVENT.replace(
  "\n\nexport { addDomEvent };\n",
  "",
);

const ADD_DOM_EVENT_FUNCTION_RE =
  /function addDomEvent\(target, eventName, handler, options = \{ passive: true \}\) \{\n\s*target\.addEventListener\(eventName, handler, options\);\n\s*return \(\) => target\.removeEventListener\(eventName, handler\);\n\}/;

/**
 * SSR DOM implementations (e.g. happy-dom) and workerd reject `{ passive: true }` on `window.resize`;
 * motion-dom defaults passive true for addDomEvent (used by framer-motion layout projection).
 *
 * Match by module id and source shape: Vite SSR can serve either the original motion-dom module
 * or an optimized `deps_ssr/framer-motion.js` bundle, so patch both shapes.
 */
function motionDomWorkerdResizePassivePlugin(): Plugin {
  return {
    name: "motion-dom-workerd-resize-passive",
    enforce: "pre",
    transform(code, id) {
      const cleanId = id.split("?")[0] ?? id;
      const isAddDomEventModule =
        cleanId.includes("motion-dom") && cleanId.endsWith("add-dom-event.mjs");
      const isOptimizedMotionBundle =
        cleanId.includes(`${path.sep}.vite${path.sep}deps_ssr${path.sep}`) &&
        cleanId.endsWith("framer-motion.js");
      const hasAddDomEvent = ADD_DOM_EVENT_FUNCTION_RE.test(code);

      if (!hasAddDomEvent || (!isAddDomEventModule && !isOptimizedMotionBundle)) {
        return null;
      }

      if (isAddDomEventModule) {
        return { code: PATCHED_ADD_DOM_EVENT, map: null };
      }

      return {
        code: code.replace(ADD_DOM_EVENT_FUNCTION_RE, PATCHED_ADD_DOM_EVENT_FUNCTION),
        map: null,
      };
    },
  };
}

function isLocalUrl(value: string | undefined) {
  return Boolean(value && /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(value));
}

function getBuildEnvValue(mode: string, explicitValue: string | undefined, fallbackValue: string) {
  if (mode === "production" && isLocalUrl(explicitValue)) {
    return fallbackValue;
  }

  return explicitValue ?? fallbackValue;
}

function getPublicEnv(mode: string) {
  const env = loadRuntimeEnvironment(workspaceRoot, ["dashboard"], {
    includeLocalOverrides: mode !== "production",
  });

  const dashboardUrl = getBuildEnvValue(
    mode,
    env.DASHBOARD_URL,
    mode === "production" ? "https://app.tamias.xyz" : "http://localhost:3001",
  );
  const apiUrl = getBuildEnvValue(mode, env.API_URL, "https://api.tamias.xyz");
  const stripePublishableKey = env.STRIPE_PUBLISHABLE_KEY ?? "";
  const googleApiKey = env.GOOGLE_API_KEY ?? "";
  const whatsappNumber = env.WHATSAPP_NUMBER ?? "";
  const openPanelClientId = env.OPENPANEL_CLIENT_ID ?? "";
  const logsnagProject = env.LOGSNAG_PROJECT ?? "";
  const logsnagDisabled = env.LOGSNAG_DISABLED ?? "";

  return {
    NODE_ENV: mode === "production" ? "production" : "development",
    DASHBOARD_URL: dashboardUrl,
    API_URL: apiUrl,
    STRIPE_PUBLISHABLE_KEY: stripePublishableKey,
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
    Object.entries(publicEnv).map(([key, value]) => [`process.env.${key}`, JSON.stringify(value)]),
  );
  const workerVars = {
    TAMIAS_ENVIRONMENT: mode === "production" ? "production" : "development",
    API_URL: publicEnv.API_URL,
    DASHBOARD_URL: publicEnv.DASHBOARD_URL,
    STRIPE_PUBLISHABLE_KEY: publicEnv.STRIPE_PUBLISHABLE_KEY,
    GOOGLE_API_KEY: publicEnv.GOOGLE_API_KEY,
    WHATSAPP_NUMBER: publicEnv.WHATSAPP_NUMBER,
    OPENPANEL_CLIENT_ID: publicEnv.OPENPANEL_CLIENT_ID,
    LOGSNAG_PROJECT: publicEnv.LOGSNAG_PROJECT,
    LOGSNAG_DISABLED: publicEnv.LOGSNAG_DISABLED,
  };

  return {
    plugins: [
      motionDomWorkerdResizePassivePlugin(),
      cloudflare({
        configPath: path.join(workspaceRoot, "wrangler.jsonc"),
        config: {
          main: "./dashboard/src/start/cf-unified-entry.ts",
          ...(command === "serve" ? { vars: workerVars } : {}),
        },
        viteEnvironment: { name: "ssr" },
      }),
      ...tanstackStart({
        router: {
          entry: "./start/router.tsx",
          routesDirectory: "./start/routes",
          generatedRouteTree: "./start/routeTree.gen.ts",
          quoteStyle: "double",
          semicolons: true,
        },
        start: {
          entry: "./start/start.ts",
        },
        server: {
          entry: "./start/server.ts",
        },
      }),
      react(),
      babel({
        presets: [reactCompilerPreset({ target: "19" })],
      }),
    ],
    resolve: {
      alias: [
        {
          find: /^(?:.*\/)?motion-dom\/dist\/es\/events\/add-dom-event\.mjs$/,
          replacement: resolveDashboardPath("./src/shims/motion-dom-add-dom-event.ts"),
        },
        {
          find: "@",
          replacement: resolveDashboardPath("./src"),
        },
        {
          find: "@app-data",
          replacement: resolveDashboardPath("../packages/app-data/src"),
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
          replacement: resolveDashboardPath("./src/shims/process-browser.ts"),
        },
      ],
      dedupe: ["react", "react-dom"],
    },
    define: defineEntries,
    // Environment files are loaded through the dashboard allowlist above. Keeping Vite's
    // automatic dotenv loader disabled prevents a root .env from exposing API/filing secrets.
    envDir: path.join(workspaceRoot, "config", "no-automatic-env"),
    server: {
      host: "0.0.0.0",
      port: 3001,
      strictPort: true,
      fs: {
        allow: [workspaceRoot],
      },
      allowedHosts: ["localhost", "127.0.0.1", "tamias.test", ".tamias.test"],
    },
    preview: {
      host: "0.0.0.0",
      port: 3001,
      strictPort: true,
    },
    build: {
      // Smaller prod assets = faster download/parse; keep maps in dev only.
      // Do not use manualChunks to split react/react-dom: it duplicates React in SSR and
      // breaks hooks (Invalid hook call / useState on null) during dev and prerender.
      sourcemap: mode !== "production",
      cssMinify: mode === "production",
      target: "es2022",
      reportCompressedSize: false,
      // Exclude heavy static assets from the SSR server bundle — they're served via
      // the ASSETS binding (client dist) and only need URL references server-side.
      assetsInlineLimit: 0,
    },
    optimizeDeps: {
      exclude: ["pino-pretty"],
    },
    ssr: {
      noExternal: [
        // Bundle API + worker inline for local unified wrangler dev.
        ...(command === "serve" ? [/^@tamias\/api(?:\/.*)?$/, /^@tamias\/worker(?:\/.*)?$/] : []),
        /^@tanstack\/react-start(?:\/.*)?$/,
        /^@tanstack\/start-storage-context(?:\/.*)?$/,
        // Rebundle from source so `resolve.alias` can replace motion-dom's addDomEvent
        // (workerd SSR requires passive: false for resize listeners).
        "framer-motion",
        "motion-dom",
      ],
    },
    css: {
      postcss: resolveDashboardPath("./postcss.config.cjs"),
    },
  };
});
