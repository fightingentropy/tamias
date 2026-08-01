/**
 * ESM-safe `process` shim for the client bundle.
 * The `process` npm package's `browser.js` uses `module.exports`, which throws
 * "module is not defined" in the browser when pulled in as ESM.
 */
// Vite's `define` replaces this expression at build time. The Cloudflare Vite
// plugin can expose `import.meta.env.MODE` as development during production
// builds, so NODE_ENV must come from the explicit build define instead.
const definedNodeEnv = process.env.NODE_ENV;

const env: Record<string, string | undefined> = {
  NODE_ENV: definedNodeEnv === "production" || import.meta.env.PROD ? "production" : "development",
};

for (const key of Object.keys(import.meta.env)) {
  env[key] = import.meta.env[key as keyof ImportMetaEnv] as string | undefined;
}

const processShim = {
  env,
  browser: true,
  version: "",
  nextTick: (fn: () => void) => {
    queueMicrotask(fn);
  },
};

export default processShim;
