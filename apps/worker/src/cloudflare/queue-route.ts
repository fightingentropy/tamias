import type { CloudflareAsyncMessage } from "./bridge-helpers";
import type { CloudflareAsyncEnv } from "./shared";

export type { CloudflareAsyncMessage } from "./bridge-helpers";

export function isCaptureConsumerQueue(queueName: string) {
  return queueName.includes("tamias-capture") && !queueName.includes("-dlq");
}

export function isLedgerConsumerQueue(queueName: string) {
  return queueName.includes("tamias-ledger") && !queueName.includes("-dlq");
}

export async function runUnifiedQueueConsumer(
  batch: MessageBatch<CloudflareAsyncMessage>,
  env: CloudflareAsyncEnv,
) {
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
