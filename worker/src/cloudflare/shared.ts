import type { CloudflareD1DatabaseBinding } from "@tamias/app-data/client";
import { updateAsyncRun } from "@tamias/app-data/queries";
import type { CloudflareEmailBinding } from "@tamias/email/send";
import { createLoggerWithContext } from "@tamias/logger";
import type { CloudflareR2BucketBinding } from "@tamias/storage";
import type { WorkerJob, WorkerJobProgress } from "../types/job";
import type { CloudflareAsyncMessage, CloudflareWorkflowPayload } from "./async-helpers";

export type { CloudflareQueueGroup } from "./async-helpers";
export { getQueueBinding } from "./queue-bindings";

export type CloudflareAsyncEnv = {
  TAMIAS_ENVIRONMENT?: string;
  EMAIL?: CloudflareEmailBinding;
  IMAGES?: ImagesBinding;
  CAPTURE_QUEUE?: Queue<CloudflareAsyncMessage>;
  LEDGER_QUEUE?: Queue<CloudflareAsyncMessage>;
  RUN_COORDINATOR?: DurableObjectNamespace;
  ASYNC_WORKFLOW?: Workflow<CloudflareWorkflowPayload>;
  APP_DB?: CloudflareD1DatabaseBinding;
  VAULT_BUCKET?: CloudflareR2BucketBinding;
  TAMIAS_R2_PUBLIC_URL?: string;
  API_URL?: string;
};

export const logger = createLoggerWithContext("worker:cloudflare");

export async function updateRunStatus(
  runId: string | undefined,
  input: {
    status?: "waiting" | "active" | "completed" | "failed";
    progress?: number;
    progressStep?: string;
    result?: unknown;
    error?: string;
    startedAt?: string;
    completedAt?: string;
  },
) {
  if (!runId) {
    return;
  }

  await updateAsyncRun({
    runId,
    ...input,
  }).catch((error) => {
    logger.warn("Failed to update async run from Cloudflare worker", {
      runId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

function parseProgress(progress: WorkerJobProgress): {
  progress?: number;
  progressStep?: string;
} {
  if (typeof progress === "number") {
    return { progress };
  }

  return {
    progress: typeof progress?.progress === "number" ? progress.progress : undefined,
    progressStep: typeof progress?.step === "string" ? progress.step : undefined,
  };
}

export function createCloudflareJob(message: Message<CloudflareAsyncMessage>): WorkerJob {
  const job: WorkerJob = {
    id: message.id,
    runId: message.body.runId,
    name: message.body.jobName,
    data: message.body.payload,
    attemptsMade: Math.max(0, message.attempts - 1),
    opts: {
      attempts: message.body.maxAttempts ?? 4,
      removeOnComplete: true,
    },
    updateProgress: async (progress: WorkerJobProgress) => {
      const parsed = parseProgress(progress);
      await updateRunStatus(message.body.runId, parsed);
    },
  };

  return job;
}

type CloudflareWorkerProcessor = {
  handle(job: WorkerJob): Promise<unknown> | unknown;
};

export async function handleProcessorMessage(
  message: Message<CloudflareAsyncMessage>,
  loadProcessor: () => Promise<CloudflareWorkerProcessor>,
) {
  const job = createCloudflareJob(message);
  const processor = await loadProcessor();
  return processor.handle(job as never);
}
