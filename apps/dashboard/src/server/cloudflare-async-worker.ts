import {
  configureCloudflareAsyncServiceRuntime,
} from "@tamias/job-client";

export async function configureDashboardAsyncWorkerRuntime() {
  try {
    // @ts-expect-error Cloudflare injects this module in the Worker runtime.
    const { env } = await import(/* @vite-ignore */ "cloudflare:workers");
    const asyncWorker = env.ASYNC_WORKER;

    configureCloudflareAsyncServiceRuntime(
      asyncWorker ? { asyncWorker } : null,
    );
  } catch {
    configureCloudflareAsyncServiceRuntime(null);
  }
}
