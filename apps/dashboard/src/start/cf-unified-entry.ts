import "@/start/html-element-shim";
import { RateLimitCoordinator } from "@tamias/api/rate-limit-coordinator";
import {
  AsyncWorkflow,
  type CloudflareAsyncMessage,
  handleAsyncWorkerScheduled,
  handleCaptureQueueBatch,
  handleLedgerQueueBatch,
  isCaptureConsumerQueue,
  isLedgerConsumerQueue,
  RunCoordinator,
} from "@tamias/worker/cloudflare";
import { shouldServeApi } from "@/start/cf-unified-routing";
import { createServerEntry, startHandler } from "@/start/server";
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

const dashboardWorker = createServerEntry(
  { fetch: startHandler },
  {
    internalApiEntry: (request, env, executionCtx) =>
      callApiEntryFetch(request, env, executionCtx),
  },
);

export default {
  fetch(
    request: Request,
    env: DashboardCloudflareEnv,
    executionCtx: ExecutionContext,
  ) {
    if (shouldServeApi(request, env)) {
      return callApiEntryFetch(request, env, executionCtx);
    }

    return dashboardWorker.fetch(request, env, executionCtx);
  },

  scheduled: handleAsyncWorkerScheduled,

  async queue(
    batch: MessageBatch<CloudflareAsyncMessage>,
    env: DashboardCloudflareEnv,
    _executionCtx: ExecutionContext,
  ) {
    if (isCaptureConsumerQueue(batch.queue)) {
      await handleCaptureQueueBatch(batch, env as never);
      return;
    }
    if (isLedgerConsumerQueue(batch.queue)) {
      await handleLedgerQueueBatch(batch, env as never);
      return;
    }

    throw new Error(`Unhandled queue consumer: ${batch.queue}`);
  },
};
