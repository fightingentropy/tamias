import {
  createAsyncRunInConvex,
  getAsyncRunByProviderRunIdFromConvex,
  getAsyncRunFromConvex,
  updateAsyncRunInConvex,
  type AsyncRunRecord,
  type AsyncRunStatus,
} from "@tamias/app-data-convex";
import { createLoggerWithContext } from "@tamias/logger";
import type {
  AsyncRunResponse,
  RunStatus,
  RunStatusResponse,
} from "./types";

// Create logger with job-client context
export const logger = createLoggerWithContext("job-client");

/**
 * Shared options for queueing a job
 */
export interface JobOptions {
  /** Delay in milliseconds before the job starts processing */
  delay?: number;
  /** Optional caller-provided identifier for observability */
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

type CloudflareRecurringScheduleTask =
  | "inbox-sync-scheduler"
  | "bank-sync-scheduler";

type CloudflareQueueGroup = "capture" | "ledger";

type CloudflareBridgeRequest = {
  queue: CloudflareQueueGroup;
  queueName: string;
  runId?: string;
  jobName: string;
  payload: unknown;
  delayMs?: number;
  maxAttempts: number;
};

type CloudflareWorkflowBridgeRequest = {
  workflow: string;
  instanceId: string;
  runId?: string;
  payload: unknown;
};

type CloudflareWorkflowInstanceRequest = {
  instanceId: string;
};

type CloudflareWorkflowStatusResponse = {
  workflowStatus: string;
  output?: unknown;
  error?: {
    name?: string;
    message?: string;
  } | null;
};

type CloudflareRecurringScheduleRequest = {
  scheduleId: string;
  taskId: CloudflareRecurringScheduleTask;
  cron: string;
  timezone?: string;
  externalId?: string;
  deduplicationKey: string;
  message: {
    queue: CloudflareQueueGroup;
    queueName: string;
    jobName: string;
    payload: unknown;
    maxAttempts?: number;
  };
};

type CloudflareQueueSendOptions = {
  contentType?: string;
  delaySeconds?: number;
};

type CloudflareQueueBinding = {
  send(message: unknown, options?: CloudflareQueueSendOptions): Promise<void>;
};

type CloudflareQueueRuntime = {
  captureQueue?: CloudflareQueueBinding;
  ledgerQueue?: CloudflareQueueBinding;
};

export interface CloudflareAsyncServiceBinding {
  enqueue(request: CloudflareBridgeRequest): Promise<unknown>;
  startWorkflow(request: CloudflareWorkflowBridgeRequest): Promise<unknown>;
  getWorkflowStatus(
    request: CloudflareWorkflowInstanceRequest,
  ): Promise<CloudflareWorkflowStatusResponse>;
  cancelWorkflow(
    request: CloudflareWorkflowInstanceRequest,
  ): Promise<{ canceled?: boolean }>;
  upsertRecurringSchedule(
    request: CloudflareRecurringScheduleRequest,
  ): Promise<unknown>;
  cancelRecurringSchedule(
    request: { scheduleId: string },
  ): Promise<{ canceled?: boolean }>;
}

type CloudflareAsyncServiceRuntime = {
  asyncWorker?: CloudflareAsyncServiceBinding;
};

type CloudflareScheduleRuntime = {
  upsertRecurringSchedule(
    request: CloudflareRecurringScheduleRequest,
  ): Promise<void>;
  cancelRecurringSchedule(scheduleId: string): Promise<boolean>;
};

const captureQueueNames = new Set([
  "inbox",
  "inbox-provider",
  "documents",
  "institutions",
  "rates",
]);

const ledgerQueueNames = new Set([
  "transactions",
  "accounting",
  "invoices",
  "customers",
  "teams",
  "insights",
  "notifications",
]);

let cloudflareQueueRuntime: CloudflareQueueRuntime | null = null;
let cloudflareAsyncServiceRuntime: CloudflareAsyncServiceRuntime | null = null;
let cloudflareScheduleRuntime: CloudflareScheduleRuntime | null = null;

function getCloudflareQueueGroup(
  queueName: string,
): CloudflareQueueGroup | null {
  if (captureQueueNames.has(queueName)) {
    return "capture";
  }

  if (ledgerQueueNames.has(queueName)) {
    return "ledger";
  }

  return null;
}

function hasCloudflareQueueRuntime() {
  return !!(
    cloudflareQueueRuntime?.captureQueue || cloudflareQueueRuntime?.ledgerQueue
  );
}

function getCloudflareQueueBinding(queue: CloudflareQueueGroup) {
  return queue === "capture"
    ? cloudflareQueueRuntime?.captureQueue
    : cloudflareQueueRuntime?.ledgerQueue;
}

export function configureCloudflareQueueRuntime(
  runtime: CloudflareQueueRuntime | null,
) {
  cloudflareQueueRuntime = runtime;
}

export function configureCloudflareAsyncServiceRuntime(
  runtime: CloudflareAsyncServiceRuntime | null,
) {
  cloudflareAsyncServiceRuntime = runtime;
}

export function configureCloudflareScheduleRuntime(
  runtime: CloudflareScheduleRuntime | null,
) {
  cloudflareScheduleRuntime = runtime;
}

function getCloudflareAsyncServiceBinding() {
  return cloudflareAsyncServiceRuntime?.asyncWorker;
}

function getCloudflareBridgeUrl() {
  return process.env.CLOUDFLARE_ASYNC_BRIDGE_URL?.trim();
}

function getCloudflareBridgeToken() {
  return process.env.CLOUDFLARE_ASYNC_BRIDGE_TOKEN?.trim();
}

function getCloudflareBridgeEnabledJobs() {
  return (process.env.CLOUDFLARE_ASYNC_BRIDGE_JOBS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function hasCloudflareBridgeCredentials() {
  return !!(getCloudflareBridgeUrl() && getCloudflareBridgeToken());
}

function isEnabledCloudflareQueueJob(queueName: string, jobName: string) {
  const enabledJobs = getCloudflareBridgeEnabledJobs();
  if (!enabledJobs.length) {
    return true;
  }

  return enabledJobs.some((rule) => {
    if (rule === jobName) {
      return true;
    }

    if (rule === `${queueName}:*`) {
      return true;
    }

    return rule === `${queueName}:${jobName}`;
  });
}

function requireCloudflareQueueTransport(
  queueName: string,
  jobName: string,
): CloudflareQueueGroup {
  const queueGroup = getCloudflareQueueGroup(queueName);

  if (!queueGroup) {
    throw new Error(`Unsupported Cloudflare queue group for ${queueName}`);
  }

  if (!isEnabledCloudflareQueueJob(queueName, jobName)) {
    throw new Error(
      `Cloudflare async queue job is not enabled: ${queueName}:${jobName}`,
    );
  }

  if (
    !hasCloudflareQueueRuntime() &&
    !getCloudflareAsyncServiceBinding() &&
    !hasCloudflareBridgeCredentials()
  ) {
    throw new Error("Cloudflare async queue transport is not configured");
  }

  return queueGroup;
}

function isSupportedCloudflareRecurringScheduleTask(
  taskId: string,
): taskId is CloudflareRecurringScheduleTask {
  return taskId === "inbox-sync-scheduler" || taskId === "bank-sync-scheduler";
}

function buildCloudflareRecurringScheduleId(
  taskId: CloudflareRecurringScheduleTask,
  externalId: string | undefined,
  deduplicationKey: string,
) {
  return `cloudflare-schedule:${taskId}:${externalId ?? deduplicationKey}`;
}

function toCloudflareDelaySeconds(delayMs?: number) {
  if (!delayMs || delayMs <= 0) {
    return undefined;
  }

  return Math.max(1, Math.ceil(delayMs / 1000));
}

function buildCloudflareRecurringScheduleMessage(
  taskId: CloudflareRecurringScheduleTask,
  externalId: string | undefined,
) {
  switch (taskId) {
    case "inbox-sync-scheduler":
      if (!externalId) {
        return null;
      }

      return {
        queue: "capture" as const,
        queueName: "inbox-provider",
        jobName: "sync-scheduler",
        payload: {
          id: externalId,
          manualSync: false,
        },
        maxAttempts: 4,
      };
    case "bank-sync-scheduler":
      if (!externalId) {
        return null;
      }

      return {
        queue: "ledger" as const,
        queueName: "transactions",
        jobName: "bank-sync-scheduler",
        payload: {
          teamId: externalId,
        },
        maxAttempts: 3,
      };
  }
}

async function enqueueViaCloudflareBridge(request: CloudflareBridgeRequest) {
  const queueBinding = getCloudflareQueueBinding(request.queue);

  if (queueBinding) {
    await queueBinding.send(
      {
        queue: request.queue,
        queueName: request.queueName,
        runId: request.runId,
        jobName: request.jobName,
        payload: request.payload,
        maxAttempts: request.maxAttempts,
      },
      {
        contentType: "json",
        delaySeconds: toCloudflareDelaySeconds(request.delayMs),
      },
    );
    return;
  }

  const asyncWorker = getCloudflareAsyncServiceBinding();
  if (asyncWorker) {
    await asyncWorker.enqueue(request);
    return;
  }

  const bridgeUrl = getCloudflareBridgeUrl();
  const bridgeToken = getCloudflareBridgeToken();

  if (!bridgeUrl || !bridgeToken) {
    throw new Error("Cloudflare async transport is not configured");
  }

  const response = await fetch(
    new URL("/internal/enqueue", bridgeUrl).toString(),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${bridgeToken}`,
      },
      body: JSON.stringify(request),
    },
  );

  if (response.ok) {
    return;
  }

  const errorText = await response.text().catch(() => "");
  throw new Error(
    `Cloudflare async bridge rejected enqueue (${response.status}): ${errorText || response.statusText}`,
  );
}

async function startCloudflareWorkflowViaBridge(
  request: CloudflareWorkflowBridgeRequest,
) {
  const asyncWorker = getCloudflareAsyncServiceBinding();
  if (asyncWorker) {
    await asyncWorker.startWorkflow(request);
    return;
  }

  const bridgeUrl = getCloudflareBridgeUrl();
  const bridgeToken = getCloudflareBridgeToken();

  if (!bridgeUrl || !bridgeToken) {
    throw new Error("Cloudflare async transport is not configured");
  }

  const response = await fetch(
    new URL("/internal/workflows/start", bridgeUrl).toString(),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${bridgeToken}`,
      },
      body: JSON.stringify(request),
    },
  );

  if (response.ok) {
    return;
  }

  const errorText = await response.text().catch(() => "");
  throw new Error(
    `Cloudflare workflow bridge rejected start (${response.status}): ${errorText || response.statusText}`,
  );
}

async function cancelCloudflareWorkflowViaBridge(
  request: CloudflareWorkflowInstanceRequest,
) {
  const asyncWorker = getCloudflareAsyncServiceBinding();
  if (asyncWorker) {
    const response = await asyncWorker.cancelWorkflow(request);
    return response.canceled === true;
  }

  const bridgeUrl = getCloudflareBridgeUrl();
  const bridgeToken = getCloudflareBridgeToken();

  if (!bridgeUrl || !bridgeToken) {
    throw new Error("Cloudflare async transport is not configured");
  }

  const response = await fetch(
    new URL("/internal/workflows/cancel", bridgeUrl).toString(),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${bridgeToken}`,
      },
      body: JSON.stringify(request),
    },
  );

  if (response.ok) {
    const body = (await response.json().catch(() => null)) as {
      canceled?: boolean;
    } | null;
    return body?.canceled === true;
  }

  const errorText = await response.text().catch(() => "");
  throw new Error(
    `Cloudflare workflow bridge rejected cancel (${response.status}): ${errorText || response.statusText}`,
  );
}

async function upsertCloudflareRecurringScheduleViaBridge(
  request: CloudflareRecurringScheduleRequest,
) {
  if (cloudflareScheduleRuntime) {
    await cloudflareScheduleRuntime.upsertRecurringSchedule(request);
    return;
  }

  const asyncWorker = getCloudflareAsyncServiceBinding();
  if (asyncWorker) {
    await asyncWorker.upsertRecurringSchedule(request);
    return;
  }

  const bridgeUrl = getCloudflareBridgeUrl();
  const bridgeToken = getCloudflareBridgeToken();

  if (!bridgeUrl || !bridgeToken) {
    throw new Error("Cloudflare async transport is not configured");
  }

  const response = await fetch(
    new URL("/internal/schedules/upsert", bridgeUrl).toString(),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${bridgeToken}`,
      },
      body: JSON.stringify(request),
    },
  );

  if (response.ok) {
    return;
  }

  const errorText = await response.text().catch(() => "");
  throw new Error(
    `Cloudflare schedule bridge rejected upsert (${response.status}): ${errorText || response.statusText}`,
  );
}

async function cancelCloudflareScheduleViaBridge(scheduleId: string) {
  if (cloudflareScheduleRuntime) {
    return cloudflareScheduleRuntime.cancelRecurringSchedule(scheduleId);
  }

  const asyncWorker = getCloudflareAsyncServiceBinding();
  if (asyncWorker) {
    const response = await asyncWorker.cancelRecurringSchedule({ scheduleId });
    return response.canceled === true;
  }

  const bridgeUrl = getCloudflareBridgeUrl();
  const bridgeToken = getCloudflareBridgeToken();

  if (!bridgeUrl || !bridgeToken) {
    throw new Error("Cloudflare async transport is not configured");
  }

  const response = await fetch(
    new URL("/internal/schedules/cancel", bridgeUrl).toString(),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${bridgeToken}`,
      },
      body: JSON.stringify({ scheduleId }),
    },
  );

  if (response.ok) {
    const body = (await response.json().catch(() => null)) as {
      canceled?: boolean;
    } | null;
    return body?.canceled === true;
  }

  const errorText = await response.text().catch(() => "");
  throw new Error(
    `Cloudflare schedule bridge rejected cancel (${response.status}): ${errorText || response.statusText}`,
  );
}

async function getCloudflareWorkflowStatusViaBridge(instanceId: string) {
  const asyncWorker = getCloudflareAsyncServiceBinding();
  if (asyncWorker) {
    return asyncWorker.getWorkflowStatus({ instanceId });
  }

  const bridgeUrl = getCloudflareBridgeUrl();
  const bridgeToken = getCloudflareBridgeToken();

  if (!bridgeUrl || !bridgeToken) {
    throw new Error("Cloudflare async transport is not configured");
  }

  const url = new URL("/internal/workflows/status", bridgeUrl);
  url.searchParams.set("instanceId", instanceId);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      authorization: `Bearer ${bridgeToken}`,
    },
  });

  if (response.ok) {
    return (await response.json()) as CloudflareWorkflowStatusResponse;
  }

  const errorText = await response.text().catch(() => "");
  throw new Error(
    `Cloudflare workflow bridge rejected status (${response.status}): ${errorText || response.statusText}`,
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function extractPublicTeamId(payload: unknown, explicitTeamId?: string) {
  if (explicitTeamId) {
    return explicitTeamId;
  }

  if (
    payload &&
    typeof payload === "object" &&
    "teamId" in payload &&
    typeof payload.teamId === "string"
  ) {
    return payload.teamId;
  }

  return undefined;
}

async function waitForRunCompletion(
  runId: string,
  timeout: number,
): Promise<RunStatusResponse> {
  const initialPollInterval = 50;
  const maxPollInterval = 200;
  let pollInterval = initialPollInterval;
  let pollCount = 0;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const status = await getRunStatus(runId);

    if (status.status === "completed") {
      return status;
    }

    if (status.status === "failed") {
      throw new Error(status.error || "Cloudflare job failed");
    }

    if (status.status === "canceled") {
      throw new Error("Cloudflare job was canceled");
    }

    if (status.status === "unknown") {
      throw new Error("Cloudflare job status became unknown");
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
    pollCount++;

    if (pollCount === 5) {
      pollInterval = 100;
    } else if (pollCount === 10) {
      pollInterval = maxPollInterval;
    }
  }

  const finalStatus = await getRunStatus(runId);
  if (finalStatus.status !== "completed") {
    throw new Error(
      `Cloudflare job did not complete within ${timeout}ms timeout. Final status: ${finalStatus.status}`,
    );
  }

  return finalStatus;
}

function mapCloudflareWorkflowStatus(status: string): RunStatus {
  switch (status) {
    case "queued":
    case "waiting":
    case "paused":
    case "waitingForPause":
      return "waiting";
    case "running":
      return "active";
    case "complete":
      return "completed";
    case "terminated":
      return "canceled";
    case "errored":
      return "failed";
    default:
      return "unknown";
  }
}

function normalizeStoredRun(run: AsyncRunRecord): RunStatusResponse {
  return {
    status: run.status,
    progress: run.progress ?? undefined,
    progressStep: run.progressStep ?? undefined,
    result: run.result,
    error: run.error ?? undefined,
  };
}

async function createRunRecord(params: {
  publicTeamId?: string;
  appUserId?: string;
  provider: AsyncRunRecord["provider"];
  kind: AsyncRunRecord["kind"];
  providerRunId?: string;
  status?: AsyncRunStatus;
  providerQueueName?: string;
  providerJobName?: string;
  metadata?: Record<string, unknown>;
}) {
  return createAsyncRunInConvex({
    publicTeamId: params.publicTeamId,
    appUserId: params.appUserId,
    provider: params.provider,
    kind: params.kind,
    providerRunId: params.providerRunId,
    status: params.status,
    providerQueueName: params.providerQueueName,
    providerJobName: params.providerJobName,
    metadata: params.metadata,
  });
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
    await enqueueViaCloudflareBridge({
      queue: queueGroup,
      queueName,
      runId: asyncRun.id,
      jobName,
      payload,
      delayMs: options?.delay,
      maxAttempts: 4,
    });

    await updateAsyncRunInConvex({
      runId: asyncRun.id,
      providerQueueName: queueName,
      providerJobName: jobName,
      status: options?.delay ? "delayed" : "waiting",
      metadata,
    });

    return { runId: asyncRun.id };
  } catch (error) {
    await updateAsyncRunInConvex({
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
  const existingRun = await getAsyncRunByProviderRunIdFromConvex(
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
    await startCloudflareWorkflowViaBridge({
      workflow: workflowName,
      instanceId: options.instanceId,
      runId: asyncRun.id,
      payload,
    });

    await updateAsyncRunInConvex({
      runId: asyncRun.id,
      providerRunId: options.instanceId,
      providerJobName: workflowName,
      status: "waiting",
    });

    return { runId: asyncRun.id };
  } catch (error) {
    await updateAsyncRunInConvex({
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
  const message = buildCloudflareRecurringScheduleMessage(
    taskId,
    options.externalId,
  );

  if (!message) {
    throw new Error(
      `Cloudflare recurring schedule requires externalId for ${taskId}`,
    );
  }

  const existingRun = await getAsyncRunByProviderRunIdFromConvex(
    "cloudflare-schedule",
    scheduleId,
  ).catch(() => null);
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
      metadata: {
        ...(options.metadata ?? {}),
        cron,
        timezone: options.timezone ?? "UTC",
        externalId: options.externalId,
        deduplicationKey: options.deduplicationKey,
      },
    }));

  try {
    await upsertCloudflareRecurringScheduleViaBridge({
      scheduleId,
      taskId,
      cron,
      timezone: options.timezone ?? "UTC",
      externalId: options.externalId,
      deduplicationKey: options.deduplicationKey,
      message,
    });

    await updateAsyncRunInConvex({
      runId: asyncRun.id,
      providerRunId: scheduleId,
      providerJobName: taskId,
      status: "active",
      metadata: {
        ...(options.metadata ?? {}),
        cron,
        timezone: options.timezone ?? "UTC",
        externalId: options.externalId,
        deduplicationKey: options.deduplicationKey,
      },
    });

    return { runId: asyncRun.id };
  } catch (error) {
    await updateAsyncRunInConvex({
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
  const asyncRun = await getAsyncRunFromConvex(runId);

  if (!asyncRun) {
    return false;
  }

  if (asyncRun.provider === "cloudflare-schedule" && asyncRun.providerRunId) {
    const canceled = await cancelCloudflareScheduleViaBridge(
      asyncRun.providerRunId,
    );

    if (!canceled) {
      return false;
    }

    await updateAsyncRunInConvex({
      runId,
      status: "canceled",
      canceledAt: new Date().toISOString(),
    });
    return true;
  }

  if (asyncRun.provider === "cloudflare-workflow" && asyncRun.providerRunId) {
    const canceled = await cancelCloudflareWorkflowViaBridge({
      instanceId: asyncRun.providerRunId,
    });

    if (!canceled) {
      return false;
    }

    await updateAsyncRunInConvex({
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
  const asyncRun = await getAsyncRunFromConvex(runId);

  if (!asyncRun) {
    return {
      status: "unknown",
    };
  }

  if (
    options?.teamId &&
    asyncRun.teamId &&
    asyncRun.teamId !== options.teamId
  ) {
    logger.warn("Unauthorized run access attempt", {
      runId,
      requestingTeamId: options.teamId,
      runTeamId: asyncRun.teamId,
    });
    throw new Error("Run not found or access denied");
  }

  if (asyncRun.provider === "cloudflare-workflow" && asyncRun.providerRunId) {
    try {
      const workflow = await getCloudflareWorkflowStatusViaBridge(
        asyncRun.providerRunId,
      );
      const status = mapCloudflareWorkflowStatus(workflow.workflowStatus);
      const error =
        typeof workflow.error?.message === "string"
          ? workflow.error.message
          : undefined;
      const response = {
        status,
        result: workflow.output,
        error,
      } satisfies RunStatusResponse;

      await updateAsyncRunInConvex({
        runId,
        status,
        result: workflow.output,
        error,
        completedAt:
          status === "completed" || status === "failed"
            ? new Date().toISOString()
            : undefined,
        canceledAt:
          status === "canceled" ? new Date().toISOString() : undefined,
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
