import { createDatabase } from "@tamias/app-data/client";
import {
  listPendingOutboxEvents,
  markOutboxEventFailed,
  markOutboxEventPublished,
} from "@tamias/app-data/queries";
import type { CloudflareAsyncMessage } from "./async-helpers";
import type { CloudflareAsyncEnv } from "./shared";
import { logger } from "./shared";

export async function relayTransactionalOutbox(env: CloudflareAsyncEnv) {
  if (!env.APP_DB || !env.OUTBOX_QUEUE) {
    throw new Error("APP_DB and OUTBOX_QUEUE are required for the outbox relay");
  }
  const db = createDatabase({ cloudflare: { d1: env.APP_DB } });
  const events = await listPendingOutboxEvents(db);

  for (const event of events) {
    try {
      await env.OUTBOX_QUEUE.send(
        {
          queue: "ledger",
          queueName: "outbox",
          jobName: "publish",
          maxAttempts: 4,
          payload: event,
        },
        { contentType: "json" },
      );
      await markOutboxEventPublished(db, event.id);
    } catch (error) {
      await markOutboxEventFailed(db, event.id, error);
      logger.error("Transactional outbox relay failed", {
        outboxId: event.id,
        topic: event.topic,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return events.length;
}

export async function handleOutboxQueueBatch(batch: MessageBatch<CloudflareAsyncMessage>) {
  for (const message of batch.messages) {
    const payload = message.body.payload as { id?: unknown; topic?: unknown } | null;
    if (!payload || typeof payload.id !== "string" || typeof payload.topic !== "string") {
      message.retry();
      continue;
    }
    logger.info("Transactional outbox event delivered", {
      outboxId: payload.id,
      topic: payload.topic,
      attempts: message.attempts,
    });
    message.ack();
  }
}
