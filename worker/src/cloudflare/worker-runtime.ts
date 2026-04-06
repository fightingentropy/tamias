import {
  configureCloudflareQueueRuntime,
  configureCloudflareScheduleRuntime,
} from "@tamias/job-client/cloudflare-runtime";
import { createCloudflareScheduleRuntime } from "./schedule-runtime";
import type { CloudflareAsyncEnv } from "./shared";

export function configureWorkerRuntime(env: CloudflareAsyncEnv) {
  configureCloudflareQueueRuntime({
    captureQueue: env.CAPTURE_QUEUE,
    ledgerQueue: env.LEDGER_QUEUE,
  });
  configureCloudflareScheduleRuntime(createCloudflareScheduleRuntime(env));
}
