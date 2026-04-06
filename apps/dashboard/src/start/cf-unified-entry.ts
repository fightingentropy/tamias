import "@/start/html-element-shim";
import { RateLimitCoordinator } from "@tamias/api/rate-limit-coordinator";
import { AsyncWorkflow, RunCoordinator } from "@tamias/worker/cloudflare/durable-classes";
import {
  type CloudflareAsyncMessage,
  runUnifiedQueueConsumer,
} from "@tamias/worker/cloudflare/queue-route";
import { handleAsyncWorkerScheduled } from "@tamias/worker/cloudflare/scheduled-cron";
import { shouldServeApi } from "@/start/cf-unified-routing";
import type { DashboardCloudflareEnv } from "@/start/server/cloudflare-context";

export { AsyncWorkflow, RateLimitCoordinator, RunCoordinator };

async function callApiEntryFetch(
  request: Request,
  env: DashboardCloudflareEnv,
  executionCtx: ExecutionContext,
) {
  const { apiEntryFetch } = await import("@tamias/api");
  return apiEntryFetch(request, env as never, executionCtx);
}

async function createDashboardWorker() {
  const { createServerEntry, startHandler } = await import("@/start/server");
  return createServerEntry(
    { fetch: startHandler },
    {
      internalApiEntry: (request, env, executionCtx) =>
        callApiEntryFetch(request, env, executionCtx),
    },
  );
}

let dashboardWorkerPromise: Promise<
  Awaited<ReturnType<typeof createDashboardWorker>>
> | null = null;

function getDashboardWorker() {
  dashboardWorkerPromise ??= createDashboardWorker();
  return dashboardWorkerPromise;
}

export default {
  async fetch(
    request: Request,
    env: DashboardCloudflareEnv,
    executionCtx: ExecutionContext,
  ) {
    if (shouldServeApi(request, env)) {
      return callApiEntryFetch(request, env, executionCtx);
    }

    const dashboardWorker = await getDashboardWorker();
    return dashboardWorker.fetch(request, env, executionCtx);
  },

  scheduled: handleAsyncWorkerScheduled,

  async queue(
    batch: MessageBatch<CloudflareAsyncMessage>,
    env: DashboardCloudflareEnv,
    _executionCtx: ExecutionContext,
  ) {
    await runUnifiedQueueConsumer(batch, env as never);
  },
};
