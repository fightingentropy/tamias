import { type CloudflareAsyncServiceBinding } from "@tamias/job-client";
import "./runtime-shims";
import {
  type CloudflareAsyncMessage,
  type CloudflareRecurringScheduleRequest,
  type CloudflareWorkflowInstanceRequest,
  type CloudflareWorkflowStartRequest,
  isAlreadyExistingWorkflowError,
  isSupportedCloudflareMessage,
  toDelaySeconds,
} from "./async-helpers";
import {
  cancelRecurringScheduleInRunCoordinator,
  upsertRecurringScheduleInRunCoordinator,
} from "./schedule-runtime";
import { type CloudflareAsyncEnv, getQueueBinding, logger } from "./shared";

export type { CloudflareAsyncMessage } from "./async-helpers";
export { handleCaptureQueueBatch } from "./capture";
export { handleLedgerQueueBatch } from "./ledger";
export type { CloudflareAsyncEnv } from "./shared";
export { AsyncWorkflow, RunCoordinator } from "./durable-classes";
export { handleAsyncWorkerScheduled } from "./scheduled-cron";
export { isCaptureConsumerQueue, isLedgerConsumerQueue } from "./queue-route";

type CloudflareEnqueueRequest = CloudflareAsyncMessage & {
  delayMs?: number;
};

async function enqueueInAsyncWorker(env: CloudflareAsyncEnv, payload: CloudflareEnqueueRequest) {
  if (!isSupportedCloudflareMessage(payload)) {
    throw new Error(`Unsupported Cloudflare async job ${payload.queueName}:${payload.jobName}`);
  }

  const queueBinding = getQueueBinding(env, payload.queue);
  if (!queueBinding) {
    logger.error("Missing Cloudflare queue binding", {
      queue: payload.queue,
      queueName: payload.queueName,
      jobName: payload.jobName,
    });
    throw new Error("Queue binding not configured");
  }

  await queueBinding.send(
    {
      queue: payload.queue,
      queueName: payload.queueName,
      runId: payload.runId,
      jobName: payload.jobName,
      payload: payload.payload,
      maxAttempts: payload.maxAttempts,
    },
    {
      contentType: "json",
      delaySeconds: toDelaySeconds(payload.delayMs),
    },
  );

  logger.info("Cloudflare async message enqueued", {
    queue: payload.queue,
    queueName: payload.queueName,
    jobName: payload.jobName,
    runId: payload.runId,
    delayMs: payload.delayMs ?? 0,
  });

  return {
    status: "accepted",
    runtime: "cloudflare-worker",
    queue: payload.queue,
    queueName: payload.queueName,
    jobName: payload.jobName,
    runId: payload.runId,
  };
}

async function startWorkflowInAsyncWorker(
  env: CloudflareAsyncEnv,
  payload: CloudflareWorkflowStartRequest,
) {
  if (!env.ASYNC_WORKFLOW) {
    throw new Error("Workflow binding not configured");
  }

  try {
    await env.ASYNC_WORKFLOW.create({
      id: payload.instanceId,
      params:
        payload.workflow === "team-cancellation-email"
          ? {
              workflow: payload.workflow,
              runId: payload.runId,
              teamId: payload.payload.teamId,
              email: payload.payload.email,
              fullName: payload.payload.fullName,
            }
          : payload.workflow === "onboard-team"
            ? {
                workflow: payload.workflow,
                runId: payload.runId,
                email: payload.payload.email,
              }
            : {
                workflow: payload.workflow,
                runId: payload.runId,
                teamId: payload.payload.teamId,
                connectionId: payload.payload.connectionId,
              },
    });
  } catch (error) {
    if (!isAlreadyExistingWorkflowError(error)) {
      throw error;
    }
  }

  return {
    status: "accepted",
    workflow: payload.workflow,
    instanceId: payload.instanceId,
    runId: payload.runId,
  };
}

async function getWorkflowStatusInAsyncWorker(env: CloudflareAsyncEnv, instanceId: string) {
  if (!env.ASYNC_WORKFLOW) {
    throw new Error("Workflow binding not configured");
  }

  const instance = await env.ASYNC_WORKFLOW.get(instanceId);
  const status = await instance.status();

  return {
    instanceId,
    workflowStatus: status.status,
    output: status.output,
    error: status.error,
  };
}

async function cancelWorkflowInAsyncWorker(
  env: CloudflareAsyncEnv,
  payload: CloudflareWorkflowInstanceRequest,
) {
  if (!env.ASYNC_WORKFLOW) {
    throw new Error("Workflow binding not configured");
  }

  const instance = await env.ASYNC_WORKFLOW.get(payload.instanceId);
  const status = await instance.status();

  if (
    status.status === "complete" ||
    status.status === "terminated" ||
    status.status === "errored"
  ) {
    return {
      canceled: status.status === "terminated",
      instanceId: payload.instanceId,
      workflowStatus: status.status,
    };
  }

  await instance.terminate();

  return {
    canceled: true,
    instanceId: payload.instanceId,
    workflowStatus: "terminated",
  };
}

async function upsertRecurringScheduleInAsyncWorker(
  env: CloudflareAsyncEnv,
  payload: CloudflareRecurringScheduleRequest,
) {
  const response = await upsertRecurringScheduleInRunCoordinator(env, payload);

  if (!response.ok) {
    throw new Error("Failed to upsert Cloudflare recurring schedule");
  }

  return response.json();
}

async function cancelRecurringScheduleInAsyncWorker(env: CloudflareAsyncEnv, scheduleId: string) {
  const response = await cancelRecurringScheduleInRunCoordinator(env, scheduleId);

  if (!response.ok) {
    throw new Error("Failed to cancel Cloudflare recurring schedule");
  }

  return (await response.json().catch(() => null)) as {
    canceled?: boolean;
    scheduleId?: string;
  } | null;
}

export function createInProcessAsyncRuntime(
  env: CloudflareAsyncEnv,
): CloudflareAsyncServiceBinding {
  return {
    enqueue: (request) => enqueueInAsyncWorker(env, request as CloudflareEnqueueRequest),
    startWorkflow: (request) =>
      startWorkflowInAsyncWorker(env, request as CloudflareWorkflowStartRequest),
    getWorkflowStatus: (request) => getWorkflowStatusInAsyncWorker(env, request.instanceId),
    cancelWorkflow: (request) => cancelWorkflowInAsyncWorker(env, request),
    upsertRecurringSchedule: (request) => upsertRecurringScheduleInAsyncWorker(env, request),
    cancelRecurringSchedule: async (request) => {
      const result = await cancelRecurringScheduleInAsyncWorker(env, request.scheduleId);
      return result ?? { canceled: false };
    },
  };
}
