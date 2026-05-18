import type { CloudflareAsyncMessage, CloudflareQueueGroup } from "./async-helpers";

export type CloudflareQueueBindingsEnv = {
  CAPTURE_QUEUE?: Queue<CloudflareAsyncMessage>;
  DOCUMENTS_QUEUE?: Queue<CloudflareAsyncMessage>;
  LEDGER_QUEUE?: Queue<CloudflareAsyncMessage>;
};

export function getQueueBinding(env: CloudflareQueueBindingsEnv, queue: CloudflareQueueGroup) {
  switch (queue) {
    case "capture":
      return env.CAPTURE_QUEUE;
    case "documents":
      return env.DOCUMENTS_QUEUE;
    case "ledger":
      return env.LEDGER_QUEUE;
  }
}
