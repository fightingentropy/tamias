import type { CloudflareAsyncServiceBinding } from "@tamias/job-client";

declare global {
  interface CloudflareEnv {
    ASYNC_WORKER?: CloudflareAsyncServiceBinding;
  }
}

export {};
