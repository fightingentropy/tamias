type CloudflareRecurringScheduleTask =
  | "inbox-sync-scheduler"
  | "bank-sync-scheduler";

type CloudflareQueueGroup = "capture" | "ledger";

export type CloudflareBridgeRequest = {
  queue: CloudflareQueueGroup;
  queueName: string;
  runId?: string;
  jobName: string;
  payload: unknown;
  delayMs?: number;
  maxAttempts: number;
};

export type CloudflareWorkflowBridgeRequest = {
  workflow: string;
  instanceId: string;
  runId?: string;
  payload: unknown;
};

export type CloudflareWorkflowInstanceRequest = {
  instanceId: string;
};

export type CloudflareWorkflowStatusResponse = {
  workflowStatus: string;
  output?: unknown;
  error?: {
    name?: string;
    message?: string;
  } | null;
};

export type CloudflareRecurringScheduleRequest = {
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

function getCloudflareBridgeEnabledJobs() {
  return (process.env.CLOUDFLARE_ASYNC_BRIDGE_JOBS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
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

export function getCloudflareQueueBinding(queue: CloudflareQueueGroup) {
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

export function getCloudflareAsyncServiceBinding() {
  return cloudflareAsyncServiceRuntime?.asyncWorker;
}

export function getCloudflareScheduleRuntime() {
  return cloudflareScheduleRuntime;
}

export function getCloudflareBridgeUrl() {
  return process.env.CLOUDFLARE_ASYNC_BRIDGE_URL?.trim();
}

export function getCloudflareBridgeToken() {
  return process.env.CLOUDFLARE_ASYNC_BRIDGE_TOKEN?.trim();
}

export function hasCloudflareBridgeCredentials() {
  return !!(getCloudflareBridgeUrl() && getCloudflareBridgeToken());
}

export function requireCloudflareQueueTransport(
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

export function isSupportedCloudflareRecurringScheduleTask(
  taskId: string,
): taskId is CloudflareRecurringScheduleTask {
  return taskId === "inbox-sync-scheduler" || taskId === "bank-sync-scheduler";
}

export function buildCloudflareRecurringScheduleId(
  taskId: CloudflareRecurringScheduleTask,
  externalId: string | undefined,
  deduplicationKey: string,
) {
  return `cloudflare-schedule:${taskId}:${externalId ?? deduplicationKey}`;
}

export function toCloudflareDelaySeconds(delayMs?: number) {
  if (!delayMs || delayMs <= 0) {
    return undefined;
  }

  return Math.max(1, Math.ceil(delayMs / 1000));
}

export function buildCloudflareRecurringScheduleMessage(
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
