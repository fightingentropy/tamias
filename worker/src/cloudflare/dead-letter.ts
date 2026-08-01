import { createDatabase } from "@tamias/app-data/client";
import { recordDeadLetterMessage } from "@tamias/app-data/queries";
import type { CloudflareAsyncMessage } from "./async-helpers";
import type { CloudflareAsyncEnv } from "./shared";
import { logger } from "./shared";

function readTeamId(body: CloudflareAsyncMessage) {
  const payload = body.payload;
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const value = (payload as Record<string, unknown>).teamId;
  return typeof value === "string" ? value : null;
}

export async function handleDeadLetterQueueBatch(
  batch: MessageBatch<CloudflareAsyncMessage>,
  env: CloudflareAsyncEnv,
) {
  if (!env.APP_DB) {
    throw new Error("APP_DB is required to persist dead-letter messages");
  }
  const db = createDatabase({ cloudflare: { d1: env.APP_DB } });

  for (const message of batch.messages) {
    try {
      await recordDeadLetterMessage(db, {
        queueName: batch.queue,
        messageId: message.id,
        teamId: readTeamId(message.body),
        body: message.body,
        failureReason: "Cloudflare Queue delivery retries exhausted",
        deliveryAttempts: message.attempts,
      });
      logger.error("Persisted poison message from dead-letter queue", {
        queueName: batch.queue,
        messageId: message.id,
        attempts: message.attempts,
        runId: message.body.runId,
      });
      message.ack();
    } catch (error) {
      logger.error("Failed to persist dead-letter queue message", {
        queueName: batch.queue,
        messageId: message.id,
        error: error instanceof Error ? error.message : String(error),
      });
      message.retry({ delaySeconds: 300 });
    }
  }
}
