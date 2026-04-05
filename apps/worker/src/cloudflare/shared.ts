import { updateAsyncRunInConvex } from "@tamias/app-data/convex";
import { createLoggerWithContext } from "@tamias/logger";
import type { TellerMtlsFetcher } from "@tamias/banking";
import type { WorkerJob, WorkerJobProgress } from "../types/job";
import type {
  CloudflareAsyncMessage,
  CloudflareQueueGroup,
  CloudflareWorkflowPayload,
} from "./bridge-helpers";

export type CloudflareAsyncEnv = {
  TAMIAS_ENVIRONMENT?: string;
  CLOUDFLARE_ASYNC_BRIDGE_TOKEN?: string;
  RESEND_API_KEY?: string;
  RESEND_AUDIENCE_ID?: string;
  TELLER_MTLS_CERTIFICATE?: TellerMtlsFetcher;
  IMAGES?: ImagesBinding;
  CAPTURE_QUEUE?: Queue<CloudflareAsyncMessage>;
  LEDGER_QUEUE?: Queue<CloudflareAsyncMessage>;
  RUN_COORDINATOR?: DurableObjectNamespace;
  ASYNC_WORKFLOW?: Workflow<CloudflareWorkflowPayload>;
};

export const logger = createLoggerWithContext("worker:cloudflare");

export function getQueueBinding(
  env: CloudflareAsyncEnv,
  queue: CloudflareQueueGroup,
) {
  return queue === "capture" ? env.CAPTURE_QUEUE : env.LEDGER_QUEUE;
}

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

  await updateAsyncRunInConvex({
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
    progress:
      typeof progress?.progress === "number" ? progress.progress : undefined,
    progressStep:
      typeof progress?.step === "string" ? progress.step : undefined,
  };
}

export function createCloudflareJob(
  message: Message<CloudflareAsyncMessage>,
): WorkerJob {
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
