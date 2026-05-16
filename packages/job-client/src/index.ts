import { createLoggerWithContext } from "@tamias/logger";
import {
  createRunRecord,
  extractPublicTeamId,
  getAsyncRunByProviderRunId,
  getAsyncRun,
  getErrorMessage,
  mapCloudflareWorkflowStatus,
  normalizeStoredRun,
  updateAsyncRun,
} from "./async-runs";
import {
  cancelCloudflareScheduleViaTransport,
  cancelCloudflareWorkflowViaTransport,
  enqueueViaCloudflareTransport,
  getCloudflareWorkflowStatusViaTransport,
  startCloudflareWorkflowViaTransport,
  upsertCloudflareRecurringScheduleViaTransport,
} from "./cloudflare-transport";
import {
  buildCloudflareRecurringScheduleId,
  buildCloudflareRecurringScheduleMessage,
  configureCloudflareAsyncServiceRuntime,
  configureCloudflareQueueRuntime,
  configureCloudflareScheduleRuntime,
  isSupportedCloudflareRecurringScheduleTask,
  requireCloudflareQueueTransport,
  type CloudflareAsyncServiceBinding,
} from "./cloudflare-runtime";
import type { AsyncRunResponse, RunStatusResponse } from "./types";

export {
  configureCloudflareAsyncServiceRuntime,
  configureCloudflareQueueRuntime,
  configureCloudflareScheduleRuntime,
};

export type { CloudflareAsyncServiceBinding };

export const logger = createLoggerWithContext("job-client");

export interface JobOptions {
  delay?: number;
  jobId?: string;
}

export interface EnqueueOptions extends JobOptions {
  publicTeamId?: string;
  appUserId?: string;
  metadata?: Record<string, unknown>;
}

export interface ScheduleRecurringOptions {
  publicTeamId?: string;
  appUserId?: string;
  timezone?: string;
  externalId?: string;
  deduplicationKey: string;
  metadata?: Record<string, unknown>;
}

export interface StartCloudflareWorkflowOptions {
  publicTeamId?: string;
  appUserId?: string;
  instanceId: string;
  metadata?: Record<string, unknown>;
}

export async function enqueue(
  jobName: string,
  payload: unknown,
  queueName: string,
  options?: EnqueueOptions,
): Promise<AsyncRunResponse> {
  const metadata = options?.jobId
    ? {
        ...(options.metadata ?? {}),
        requestedJobId: options.jobId,
      }
    : options?.metadata;
  const queueGroup = requireCloudflareQueueTransport(queueName, jobName);
  const asyncRun = await createRunRecord({
    publicTeamId: extractPublicTeamId(payload, options?.publicTeamId),
    appUserId: options?.appUserId,
    provider: "cloudflare-queue",
    kind: "job",
    status: options?.delay ? "delayed" : "waiting",
    providerQueueName: queueName,
    providerJobName: jobName,
    metadata,
  });

  try {
    await enqueueViaCloudflareTransport({
      queue: queueGroup,
      queueName,
      runId: asyncRun.id,
      jobName,
      payload,
      delayMs: options?.delay,
      maxAttempts: 4,
    });

    await updateAsyncRun({
      runId: asyncRun.id,
      providerQueueName: queueName,
      providerJobName: jobName,
      status: options?.delay ? "delayed" : "waiting",
      metadata,
    });

    return { runId: asyncRun.id };
  } catch (error) {
    await updateAsyncRun({
      runId: asyncRun.id,
      status: "failed",
      error: getErrorMessage(error),
    }).catch(() => undefined);
    throw error;
  }
}

export async function startCloudflareWorkflow(
  workflowName: string,
  payload: unknown,
  options: StartCloudflareWorkflowOptions,
): Promise<AsyncRunResponse> {
  const existingRun = await getAsyncRunByProviderRunId(
    "cloudflare-workflow",
    options.instanceId,
  ).catch(() => null);

  if (existingRun) {
    return { runId: existingRun.id };
  }

  const asyncRun = await createRunRecord({
    publicTeamId: extractPublicTeamId(payload, options.publicTeamId),
    appUserId: options.appUserId,
    provider: "cloudflare-workflow",
    kind: "workflow",
    status: "waiting",
    providerRunId: options.instanceId,
    providerJobName: workflowName,
    metadata: options.metadata,
  });

  try {
    await startCloudflareWorkflowViaTransport({
      workflow: workflowName,
      instanceId: options.instanceId,
      runId: asyncRun.id,
      payload,
    });

    await updateAsyncRun({
      runId: asyncRun.id,
      providerRunId: options.instanceId,
      providerJobName: workflowName,
      status: "waiting",
    });

    return { runId: asyncRun.id };
  } catch (error) {
    await updateAsyncRun({
      runId: asyncRun.id,
      status: "failed",
      error: getErrorMessage(error),
    }).catch(() => undefined);
    throw error;
  }
}

export async function scheduleRecurring(
  taskId: string,
  cron: string,
  options: ScheduleRecurringOptions,
): Promise<AsyncRunResponse> {
  if (!isSupportedCloudflareRecurringScheduleTask(taskId)) {
    throw new Error(`Unsupported recurring schedule task: ${taskId}`);
  }

  const scheduleId = buildCloudflareRecurringScheduleId(
    taskId,
    options.externalId,
    options.deduplicationKey,
  );
  const message = buildCloudflareRecurringScheduleMessage(taskId, options.externalId);

  if (!message) {
    throw new Error(`Cloudflare recurring schedule requires externalId for ${taskId}`);
  }

  const metadata = {
    ...(options.metadata ?? {}),
    cron,
    timezone: options.timezone ?? "UTC",
    externalId: options.externalId,
    deduplicationKey: options.deduplicationKey,
  };
  const existingRun = await getAsyncRunByProviderRunId("cloudflare-schedule", scheduleId).catch(
    () => null,
  );
  const asyncRun =
    existingRun ??
    (await createRunRecord({
      publicTeamId: options.publicTeamId,
      appUserId: options.appUserId,
      provider: "cloudflare-schedule",
      kind: "schedule",
      status: "active",
      providerRunId: scheduleId,
      providerJobName: taskId,
      metadata,
    }));

  try {
    await upsertCloudflareRecurringScheduleViaTransport({
      scheduleId,
      taskId,
      cron,
      timezone: options.timezone ?? "UTC",
      externalId: options.externalId,
      deduplicationKey: options.deduplicationKey,
      message,
    });

    await updateAsyncRun({
      runId: asyncRun.id,
      providerRunId: scheduleId,
      providerJobName: taskId,
      status: "active",
      metadata,
    });

    return { runId: asyncRun.id };
  } catch (error) {
    await updateAsyncRun({
      runId: asyncRun.id,
      status: "failed",
      error: getErrorMessage(error),
    }).catch(() => undefined);
    throw error;
  }
}

export async function cancelSchedule(scheduleIdOrRunId: string) {
  return cancelRun(scheduleIdOrRunId).catch(() => false);
}

export async function cancelRun(runId: string): Promise<boolean> {
  const asyncRun = await getAsyncRun(runId);

  if (!asyncRun) {
    return false;
  }

  if (asyncRun.provider === "cloudflare-schedule" && asyncRun.providerRunId) {
    const canceled = await cancelCloudflareScheduleViaTransport(asyncRun.providerRunId);

    if (!canceled) {
      return false;
    }

    await updateAsyncRun({
      runId,
      status: "canceled",
      canceledAt: new Date().toISOString(),
    });
    return true;
  }

  if (asyncRun.provider === "cloudflare-workflow" && asyncRun.providerRunId) {
    const canceled = await cancelCloudflareWorkflowViaTransport({
      instanceId: asyncRun.providerRunId,
    });

    if (!canceled) {
      return false;
    }

    await updateAsyncRun({
      runId,
      status: "canceled",
      canceledAt: new Date().toISOString(),
    });
    return true;
  }

  return false;
}

export async function getRunStatus(
  runId: string,
  options?: {
    teamId?: string;
  },
): Promise<RunStatusResponse> {
  const asyncRun = await getAsyncRun(runId);

  if (!asyncRun) {
    return {
      status: "unknown",
    };
  }

  if (options?.teamId && asyncRun.teamId && asyncRun.teamId !== options.teamId) {
    logger.warn("Unauthorized run access attempt", {
      runId,
      requestingTeamId: options.teamId,
      runTeamId: asyncRun.teamId,
    });
    throw new Error("Run not found or access denied");
  }

  if (asyncRun.provider === "cloudflare-workflow" && asyncRun.providerRunId) {
    try {
      const workflow = await getCloudflareWorkflowStatusViaTransport(asyncRun.providerRunId);
      const status = mapCloudflareWorkflowStatus(workflow.workflowStatus);
      const error =
        typeof workflow.error?.message === "string" ? workflow.error.message : undefined;
      const response = {
        status,
        result: workflow.output,
        error,
      } satisfies RunStatusResponse;

      await updateAsyncRun({
        runId,
        status,
        result: workflow.output,
        error,
        completedAt:
          status === "completed" || status === "failed" ? new Date().toISOString() : undefined,
        canceledAt: status === "canceled" ? new Date().toISOString() : undefined,
      }).catch(() => undefined);

      return response;
    } catch (error) {
      logger.warn("Failed to refresh Cloudflare workflow status", {
        runId,
        providerRunId: asyncRun.providerRunId,
        error: getErrorMessage(error),
      });
      return normalizeStoredRun(asyncRun);
    }
  }

  return normalizeStoredRun(asyncRun);
}
