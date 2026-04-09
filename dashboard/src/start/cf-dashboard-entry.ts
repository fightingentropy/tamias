/**
 * Standalone Dashboard Worker entry point (production).
 *
 * Serves only the TanStack Start SSR dashboard. All API calls go through
 * the API_SERVICE binding (Cloudflare Service Binding to tamias-api).
 *
 * Unlike cf-unified-entry.ts (used for local dev), this entry does NOT
 * import @tamias/api or @tamias/worker — keeping the bundle small.
 */
import "@/start/html-element-shim";
import type { DashboardCloudflareEnv } from "@/start/server/cloudflare-context";

async function createDashboardWorker() {
  const { createServerEntry, startHandler } = await import("@/start/server");
  // No internalApiEntry — SSR tRPC calls go through the API_SERVICE
  // binding which getApiServiceBinding() in cloudflare-context.ts picks
  // up automatically from env.API_SERVICE.
  return createServerEntry({ fetch: startHandler });
}

let dashboardWorkerPromise: Promise<Awaited<ReturnType<typeof createDashboardWorker>>> | null =
  null;

function getDashboardWorker() {
  dashboardWorkerPromise ??= createDashboardWorker();
  return dashboardWorkerPromise;
}

export default {
  async fetch(request: Request, env: DashboardCloudflareEnv, executionCtx: ExecutionContext) {
    const dashboardWorker = await getDashboardWorker();
    return dashboardWorker.fetch(request, env, executionCtx);
  },
};
