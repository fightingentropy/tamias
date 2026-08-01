import type { CloudflareAsyncMessage } from "./async-helpers";
import type { CloudflareAsyncEnv } from "./shared";

export type { CloudflareAsyncMessage } from "./async-helpers";

export function isCaptureConsumerQueue(queueName: string) {
  return queueName.includes("tamias-capture") && !queueName.includes("-dlq");
}

export function isLedgerConsumerQueue(queueName: string) {
  return queueName.includes("tamias-ledger") && !queueName.includes("-dlq");
}

export function isDeadLetterQueue(queueName: string) {
  return queueName.includes("tamias-") && queueName.includes("-dlq");
}

export function isOutboxConsumerQueue(queueName: string) {
  return queueName.includes("tamias-outbox") && !queueName.includes("-dlq");
}

export async function runUnifiedQueueConsumer(
  batch: MessageBatch<CloudflareAsyncMessage>,
  env: CloudflareAsyncEnv,
) {
  if (isDeadLetterQueue(batch.queue)) {
    const { handleDeadLetterQueueBatch } = await import("./dead-letter");
    await handleDeadLetterQueueBatch(batch, env);
    return;
  }

  if (isOutboxConsumerQueue(batch.queue)) {
    const { handleOutboxQueueBatch } = await import("./outbox");
    await handleOutboxQueueBatch(batch);
    return;
  }

  if (isCaptureConsumerQueue(batch.queue)) {
    const { handleCaptureQueueBatch } = await import("./capture");
    await handleCaptureQueueBatch(batch, env);
    return;
  }
  if (isLedgerConsumerQueue(batch.queue)) {
    const { handleLedgerQueueBatch } = await import("./ledger");
    await handleLedgerQueueBatch(batch, env);
    return;
  }

  throw new Error(`Unhandled queue consumer: ${batch.queue}`);
}
