import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  configureCloudflareAsyncServiceRuntime,
} from "@tamias/job-client";

export function configureDashboardAsyncWorkerRuntime() {
  try {
    const { env } = getCloudflareContext();
    const asyncWorker = env.ASYNC_WORKER;

    configureCloudflareAsyncServiceRuntime(
      asyncWorker ? { asyncWorker } : null,
    );
  } catch {
    configureCloudflareAsyncServiceRuntime(null);
  }
}
