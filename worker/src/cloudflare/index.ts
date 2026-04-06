import { WorkerEntrypoint } from "cloudflare:workers";
import {
  type CloudflareAsyncServiceBinding,
  enqueue,
} from "@tamias/job-client";
import "./runtime-shims";
import {
  type CloudflareAsyncMessage,
  type CloudflareRecurringScheduleRequest,
  type CloudflareWorkflowInstanceRequest,
  type CloudflareWorkflowStartRequest,
  isAlreadyExistingWorkflowError,
  isBridgeAuthorized,
  isCloudflareRecurringScheduleCancelRequest,
  isCloudflareRecurringScheduleRequest,
  isCloudflareWorkflowInstanceRequest,
  isCloudflareWorkflowStartRequest,
  isSupportedCloudflareMessage,
  isWorkflowNotFoundError,
  toDelaySeconds,
} from "./bridge-helpers";
import {
  cancelRecurringScheduleInRunCoordinator,
  upsertRecurringScheduleInRunCoordinator,
} from "./schedule-runtime";
import { handleAsyncWorkerScheduled } from "./scheduled-cron";
import { type CloudflareAsyncEnv, getQueueBinding, logger } from "./shared";
import { configureWorkerRuntime } from "./worker-runtime";

export type { CloudflareAsyncMessage } from "./bridge-helpers";
export { handleCaptureQueueBatch } from "./capture";
export { handleLedgerQueueBatch } from "./ledger";
export type { CloudflareAsyncEnv } from "./shared";
export { AsyncWorkflow, RunCoordinator } from "./durable-classes";
export { handleAsyncWorkerScheduled } from "./scheduled-cron";
export {
  isCaptureConsumerQueue,
  isLedgerConsumerQueue,
} from "./queue-route";

type CloudflareEnqueueRequest = CloudflareAsyncMessage & {
  delayMs?: number;
};

function isCloudflareEnqueueRequest(
  value: unknown,
): value is CloudflareEnqueueRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    (candidate.queue === "capture" || candidate.queue === "ledger") &&
    typeof candidate.queueName === "string" &&
    typeof candidate.jobName === "string" &&
    typeof candidate.payload !== "undefined" &&
    (typeof candidate.runId === "string" ||
      typeof candidate.runId === "undefined") &&
    (typeof candidate.delayMs === "number" ||
      typeof candidate.delayMs === "undefined") &&
    (typeof candidate.maxAttempts === "number" ||
      typeof candidate.maxAttempts === "undefined")
  );
}

async function enqueueInAsyncWorker(
  env: CloudflareAsyncEnv,
  payload: CloudflareEnqueueRequest,
) {
  if (!isSupportedCloudflareMessage(payload)) {
    throw new Error(
      `Unsupported Cloudflare bridge job ${payload.queueName}:${payload.jobName}`,
    );
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

async function handleEnqueueRequest(request: Request, env: CloudflareAsyncEnv) {
  if (!isBridgeAuthorized(request, env)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (!isCloudflareEnqueueRequest(payload)) {
    return Response.json({ error: "Invalid enqueue payload" }, { status: 400 });
  }

  if (!isSupportedCloudflareMessage(payload)) {
    return Response.json(
      {
        error: `Unsupported Cloudflare bridge job ${payload.queueName}:${payload.jobName}`,
      },
      { status: 400 },
    );
  }

  try {
    return Response.json(await enqueueInAsyncWorker(env, payload));
  } catch (error) {
    logger.error("Failed to enqueue Cloudflare async message", {
      queue: payload.queue,
      queueName: payload.queueName,
      jobName: payload.jobName,
      runId: payload.runId,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      { error: "Queue binding not configured" },
      { status: 500 },
    );
  }
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

async function handleWorkflowStartRequest(
  request: Request,
  env: CloudflareAsyncEnv,
) {
  if (!isBridgeAuthorized(request, env)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (!isCloudflareWorkflowStartRequest(payload)) {
    return Response.json(
      { error: "Invalid workflow start payload" },
      { status: 400 },
    );
  }

  try {
    return Response.json(await startWorkflowInAsyncWorker(env, payload));
  } catch (error) {
    logger.error("Failed to start Cloudflare workflow", {
      workflow: payload.workflow,
      instanceId: payload.instanceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      { error: "Failed to start workflow" },
      { status: 500 },
    );
  }
}

async function getWorkflowStatusInAsyncWorker(
  env: CloudflareAsyncEnv,
  instanceId: string,
) {
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

async function handleWorkflowStatusRequest(
  request: Request,
  env: CloudflareAsyncEnv,
) {
  if (!isBridgeAuthorized(request, env)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const instanceId = new URL(request.url).searchParams.get("instanceId");
  if (!instanceId) {
    return Response.json({ error: "Missing instanceId" }, { status: 400 });
  }

  try {
    return Response.json(await getWorkflowStatusInAsyncWorker(env, instanceId));
  } catch (error) {
    if (isWorkflowNotFoundError(error)) {
      return Response.json({ error: "Workflow not found" }, { status: 404 });
    }

    logger.error("Failed to fetch Cloudflare workflow status", {
      instanceId,
      error: error instanceof Error ? error.message : String(error),
    });

    return Response.json(
      { error: "Failed to fetch workflow status" },
      { status: 500 },
    );
  }
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

async function handleWorkflowCancelRequest(
  request: Request,
  env: CloudflareAsyncEnv,
) {
  if (!isBridgeAuthorized(request, env)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (!isCloudflareWorkflowInstanceRequest(payload)) {
    return Response.json(
      { error: "Invalid workflow cancel payload" },
      { status: 400 },
    );
  }

  try {
    return Response.json(await cancelWorkflowInAsyncWorker(env, payload));
  } catch (error) {
    if (isWorkflowNotFoundError(error)) {
      return Response.json({ error: "Workflow not found" }, { status: 404 });
    }

    logger.error("Failed to cancel Cloudflare workflow", {
      instanceId: payload.instanceId,
      error: error instanceof Error ? error.message : String(error),
    });

    return Response.json(
      { error: "Failed to cancel workflow" },
      { status: 500 },
    );
  }
}

async function handleScheduleUpsertRequest(
  request: Request,
  env: CloudflareAsyncEnv,
) {
  if (!isBridgeAuthorized(request, env)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!env.RUN_COORDINATOR) {
    return Response.json(
      { error: "Run coordinator binding not configured" },
      { status: 500 },
    );
  }

  const payload = await request.json().catch(() => null);
  if (!isCloudflareRecurringScheduleRequest(payload)) {
    return Response.json(
      { error: "Invalid recurring schedule payload" },
      { status: 400 },
    );
  }

  const response = await upsertRecurringScheduleInRunCoordinator(env, payload);

  if (!response.ok) {
    return Response.json(
      { error: "Failed to upsert recurring schedule" },
      { status: response.status },
    );
  }

  return response;
}

async function handleScheduleCancelRequest(
  request: Request,
  env: CloudflareAsyncEnv,
) {
  if (!isBridgeAuthorized(request, env)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!env.RUN_COORDINATOR) {
    return Response.json(
      { error: "Run coordinator binding not configured" },
      { status: 500 },
    );
  }

  const payload = await request.json().catch(() => null);
  if (!isCloudflareRecurringScheduleCancelRequest(payload)) {
    return Response.json(
      { error: "Invalid recurring schedule cancel payload" },
      { status: 400 },
    );
  }

  const response = await cancelRecurringScheduleInRunCoordinator(
    env,
    payload.scheduleId,
  );

  if (!response.ok) {
    return Response.json(
      { error: "Failed to cancel recurring schedule" },
      { status: response.status },
    );
  }

  return response;
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

async function cancelRecurringScheduleInAsyncWorker(
  env: CloudflareAsyncEnv,
  scheduleId: string,
) {
  const response = await cancelRecurringScheduleInRunCoordinator(
    env,
    scheduleId,
  );

  if (!response.ok) {
    throw new Error("Failed to cancel Cloudflare recurring schedule");
  }

  return (await response.json().catch(() => null)) as {
    canceled?: boolean;
    scheduleId?: string;
  } | null;
}

export function createInProcessAsyncBridge(
  env: CloudflareAsyncEnv,
): CloudflareAsyncServiceBinding {
  return {
    enqueue: (request) =>
      enqueueInAsyncWorker(env, request as CloudflareEnqueueRequest),
    startWorkflow: (request) =>
      startWorkflowInAsyncWorker(
        env,
        request as CloudflareWorkflowStartRequest,
      ),
    getWorkflowStatus: (request) =>
      getWorkflowStatusInAsyncWorker(env, request.instanceId),
    cancelWorkflow: (request) => cancelWorkflowInAsyncWorker(env, request),
    upsertRecurringSchedule: (request) =>
      upsertRecurringScheduleInAsyncWorker(env, request),
    cancelRecurringSchedule: async (request) => {
      const result = await cancelRecurringScheduleInAsyncWorker(
        env,
        request.scheduleId,
      );
      return result ?? { canceled: false };
    },
  };
}

export async function handleAsyncWorkerHttp(
  request: Request,
  env: CloudflareAsyncEnv,
): Promise<Response | null> {
  configureWorkerRuntime(env);

  const url = new URL(request.url);

  if (request.method === "POST" && url.pathname === "/internal/enqueue") {
    return handleEnqueueRequest(request, env);
  }

  if (
    request.method === "POST" &&
    url.pathname === "/internal/workflows/start"
  ) {
    return handleWorkflowStartRequest(request, env);
  }

  if (
    request.method === "GET" &&
    url.pathname === "/internal/workflows/status"
  ) {
    return handleWorkflowStatusRequest(request, env);
  }

  if (
    request.method === "POST" &&
    url.pathname === "/internal/workflows/cancel"
  ) {
    return handleWorkflowCancelRequest(request, env);
  }

  if (
    request.method === "POST" &&
    url.pathname === "/internal/schedules/upsert"
  ) {
    return handleScheduleUpsertRequest(request, env);
  }

  if (
    request.method === "POST" &&
    url.pathname === "/internal/schedules/cancel"
  ) {
    return handleScheduleCancelRequest(request, env);
  }

  return null;
}

function buildAsyncWorkerDiscoveryResponse(env: CloudflareAsyncEnv) {
  return Response.json({
    status: "ok",
    runtime: "cloudflare-worker",
    environment: env.TAMIAS_ENVIRONMENT ?? "development",
    mode: "ledger-bridge",
    supportedJobs: [
      "inbox:no-match-scheduler",
      "inbox:batch-process-matching",
      "inbox:match-transactions-bidirectional",
      "inbox:process-attachment",
      "inbox:slack-upload",
      "inbox:whatsapp-upload",
      "inbox-provider:initial-setup",
      "inbox-provider:sync-scheduler",
      "documents:process-document",
      "documents:classify-image",
      "documents:classify-document",
      "documents:embed-document-tags",
      "transactions:bank-sync-scheduler",
      "transactions:delete-connection",
      "transactions:enrich-transactions",
      "transactions:export-transactions",
      "transactions:import-transactions",
      "transactions:process-transaction-attachment",
      "transactions:reconnect-connection",
      "transactions:sync-connection",
      "transactions:transaction-notifications",
      "transactions:update-account-base-currency",
      "transactions:update-base-currency",
      "accounting:export-to-accounting",
      "accounting:sync-accounting-attachments",
      "institutions:sync-institutions",
      "rates:rates-scheduler",
      "invoices:invoice-recurring-scheduler",
      "invoices:invoice-status-scheduler",
      "invoices:invoice-upcoming-notification",
      "invoices:generate-invoice",
      "invoices:send-invoice-email",
      "invoices:send-invoice-reminder",
      "invoices:schedule-invoice",
      "insights:dispatch-insights",
      "insights:generate-team-insights",
      "customers:enrich-customer",
      "notifications:notification",
      "teams:invite-team-members",
      "teams:delete-team",
      "teams:payment-issue",
    ],
    supportedWorkflows: [
      "team-cancellation-email",
      "bank-initial-setup",
      "onboard-team",
    ],
    supportedWorkflowEndpoints: [
      "POST /internal/workflows/start",
      "GET /internal/workflows/status",
      "POST /internal/workflows/cancel",
    ],
    supportedScheduleEndpoints: [
      "POST /internal/schedules/upsert",
      "POST /internal/schedules/cancel",
    ],
    supportedScheduledCrons: [
      "0 2 * * * -> inbox:no-match-scheduler",
      "0 3 * * * -> institutions:sync-institutions",
      "*/30 * * * * @ :00 -> invoices:invoice-recurring-scheduler",
      "*/30 * * * * @ :30 -> invoices:invoice-upcoming-notification",
      "0 0,12 * * * -> rates:rates-scheduler",
      "0 0,12 * * * -> invoices:invoice-status-scheduler",
      "*/30 * * * 1 -> insights:dispatch-insights",
    ],
  });
}

export class AsyncBridgeService extends WorkerEntrypoint<CloudflareAsyncEnv> {
  async enqueue(request: CloudflareEnqueueRequest) {
    return enqueueInAsyncWorker(this.env, request);
  }

  async startWorkflow(request: CloudflareWorkflowStartRequest) {
    return startWorkflowInAsyncWorker(this.env, request);
  }

  async getWorkflowStatus(request: CloudflareWorkflowInstanceRequest) {
    return getWorkflowStatusInAsyncWorker(this.env, request.instanceId);
  }

  async cancelWorkflow(request: CloudflareWorkflowInstanceRequest) {
    return cancelWorkflowInAsyncWorker(this.env, request);
  }

  async upsertRecurringSchedule(request: CloudflareRecurringScheduleRequest) {
    return upsertRecurringScheduleInAsyncWorker(this.env, request);
  }

  async cancelRecurringSchedule(request: { scheduleId: string }) {
    return cancelRecurringScheduleInAsyncWorker(this.env, request.scheduleId);
  }
}

export default {
  async fetch(request: Request, env: CloudflareAsyncEnv) {
    return (
      (await handleAsyncWorkerHttp(request, env)) ??
      buildAsyncWorkerDiscoveryResponse(env)
    );
  },

  scheduled: handleAsyncWorkerScheduled,
};
