/**
 * Standalone API Worker entry point.
 *
 * Owns: tRPC, REST API, health, OpenAPI/Scalar, queue consumers, cron
 * triggers, Durable Objects, and Workflows. The dashboard Worker talks
 * to this via a Cloudflare Service Binding.
 */

// ── Durable Object & Workflow class exports (required by wrangler) ─────
export { RateLimitCoordinator } from "./rate-limit/coordinator";
export { AsyncWorkflow, RunCoordinator } from "@tamias/worker/cloudflare/durable-classes";

import type { CloudflareAsyncMessage } from "@tamias/worker/cloudflare";

export default {
  async fetch(request: Request, env: Record<string, unknown>, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Internal async worker routes (/internal/enqueue, /internal/workflows/*, etc.)
    if (url.pathname.startsWith("/internal/")) {
      const { handleAsyncWorkerHttp } = await import("@tamias/worker/cloudflare");
      const response = await handleAsyncWorkerHttp(request, env as never);
      if (response) return response;
    }

    // All other requests go through the API entry (tRPC, REST, health, etc.)
    const { apiEntryFetch } = await import("./index");
    return apiEntryFetch(request, env as never, ctx);
  },

  async scheduled(controller: ScheduledController, env: Record<string, unknown>) {
    const { handleAsyncWorkerScheduled } = await import(
      "@tamias/worker/cloudflare/scheduled-cron"
    );
    await handleAsyncWorkerScheduled(controller, env as never);
  },

  async queue(
    batch: MessageBatch<CloudflareAsyncMessage>,
    env: Record<string, unknown>,
    _ctx: ExecutionContext,
  ) {
    const { runUnifiedQueueConsumer } = await import("@tamias/worker/cloudflare/queue-route");
    await runUnifiedQueueConsumer(batch, env as never);
  },
};
