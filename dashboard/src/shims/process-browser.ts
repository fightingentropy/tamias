/**
 * ESM-safe `process` shim for the client bundle.
 * The `process` npm package's `browser.js` uses `module.exports`, which throws
 * "module is not defined" in the browser when pulled in as ESM.
 */
const env: Record<string, string | undefined> = {
  NODE_ENV: import.meta.env.MODE,
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
