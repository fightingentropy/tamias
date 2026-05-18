import { configureEmailRuntime } from "@tamias/email/send";
import { configureDatabaseRuntime, type CloudflareD1DatabaseBinding } from "@tamias/app-data/client";
import {
  configureCloudflareQueueRuntime,
  configureCloudflareScheduleRuntime,
} from "@tamias/job-client/cloudflare-runtime";
import {
  configureStorageRuntime,
  type CloudflareR2BucketBinding,
} from "@tamias/storage";
import { configureDocumentsWorkerBinding } from "./documents-client";
import { createCloudflareScheduleRuntime } from "./schedule-runtime";
import type { CloudflareAsyncEnv } from "./shared";

type CloudflareDataRuntimeEnv = CloudflareAsyncEnv & {
  APP_DB?: CloudflareD1DatabaseBinding;
  VAULT_BUCKET?: CloudflareR2BucketBinding;
  TAMIAS_R2_PUBLIC_URL?: string;
  API_URL?: string;
};

export function configureWorkerRuntime(env: CloudflareAsyncEnv) {
  const dataEnv = env as CloudflareDataRuntimeEnv;

  configureCloudflareQueueRuntime({
    captureQueue: env.CAPTURE_QUEUE,
    documentsQueue: dataEnv.DOCUMENTS_QUEUE,
    ledgerQueue: env.LEDGER_QUEUE,
  });
  configureCloudflareScheduleRuntime(createCloudflareScheduleRuntime(env));
  configureDocumentsWorkerBinding(dataEnv.DOCUMENTS_WORKER);
  configureEmailRuntime(env.EMAIL);
  configureDatabaseRuntime({
    cloudflare: {
      d1: dataEnv.APP_DB,
    },
  });
  configureStorageRuntime({
    d1: dataEnv.APP_DB,
    r2Bucket: dataEnv.VAULT_BUCKET,
    apiUrl: dataEnv.API_URL,
    publicUrlBase: dataEnv.TAMIAS_R2_PUBLIC_URL,
  });
}
