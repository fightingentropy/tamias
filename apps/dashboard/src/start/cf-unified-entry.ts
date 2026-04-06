import "@/start/html-element-shim";
import { apiEntryFetch, RateLimitCoordinator } from "@tamias/api";
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

const dashboardWorker = createServerEntry(
  { fetch: startHandler },
  {
    internalApiEntry: (request, env, executionCtx) =>
      apiEntryFetch(request, env as never, executionCtx),
  },
);

export default {
  fetch(
    request: Request,
    env: DashboardCloudflareEnv,
    executionCtx: ExecutionContext,
  ) {
    if (shouldServeApi(request, env)) {
      return apiEntryFetch(request, env as never, executionCtx);
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
