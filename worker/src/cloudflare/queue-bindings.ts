import type { CloudflareAsyncMessage, CloudflareQueueGroup } from "./async-helpers";

export type CloudflareQueueBindingsEnv = {
  CAPTURE_QUEUE?: Queue<CloudflareAsyncMessage>;
  LEDGER_QUEUE?: Queue<CloudflareAsyncMessage>;
};

export function getQueueBinding(env: CloudflareQueueBindingsEnv, queue: CloudflareQueueGroup) {
  return queue === "capture" ? env.CAPTURE_QUEUE : env.LEDGER_QUEUE;
}
