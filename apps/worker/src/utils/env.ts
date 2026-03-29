/**
 * Environment utility functions
 * Centralized logic for checking environment variables
 */

function getWorkerEnvironment() {
  return (
    process.env.WORKER_ENV ||
    process.env.TAMIAS_ENVIRONMENT ||
    process.env.CLOUDFLARE_ENV ||
    (process.env.NODE_ENV === "production" ? "production" : "development")
  );
}

/**
 * Check if the worker is running in production environment
 * Checks the normalized worker environment across local and Cloudflare
 */
export function isProduction(): boolean {
  return getWorkerEnvironment() === "production";
}

/**
 * Check if the worker is running in staging environment
 * Checks the normalized worker environment across local and Cloudflare
 */
export function isStaging(): boolean {
  return getWorkerEnvironment() === "staging";
}

/**
 * Check if the worker is running in a non-production environment
 * Useful for skipping scheduled tasks or enabling debug features
 */
export function isDevelopment(): boolean {
  return !isProduction();
}
