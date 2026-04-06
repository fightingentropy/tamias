export type CloudflareQueueGroup = "capture" | "ledger";

export type CloudflareAsyncMessage = {
  queue: CloudflareQueueGroup;
  queueName: string;
  runId?: string;
  jobName: string;
  payload: unknown;
  maxAttempts?: number;
};

export type CloudflareWorkflowName =
  | "team-cancellation-email"
  | "bank-initial-setup"
  | "onboard-team";

type TeamCancellationWorkflowPayload = {
  workflow: "team-cancellation-email";
  teamId: string;
  email: string;
  fullName: string;
  runId?: string;
};

type BankInitialSetupWorkflowPayload = {
  workflow: "bank-initial-setup";
  teamId: string;
  connectionId: string;
  runId?: string;
};

type OnboardTeamWorkflowPayload = {
  workflow: "onboard-team";
  email: string;
  runId?: string;
};

export type CloudflareWorkflowPayload =
  | TeamCancellationWorkflowPayload
  | BankInitialSetupWorkflowPayload
  | OnboardTeamWorkflowPayload;

type TeamCancellationWorkflowStartRequest = {
  workflow: "team-cancellation-email";
  instanceId: string;
  runId?: string;
  payload: {
    teamId: string;
    email: string;
    fullName: string;
  };
};

type BankInitialSetupWorkflowStartRequest = {
  workflow: "bank-initial-setup";
  instanceId: string;
  runId?: string;
  payload: {
    teamId: string;
    connectionId: string;
  };
};

type OnboardTeamWorkflowStartRequest = {
  workflow: "onboard-team";
  instanceId: string;
  runId?: string;
  payload: {
    email: string;
  };
};

export type CloudflareWorkflowStartRequest =
  | TeamCancellationWorkflowStartRequest
  | BankInitialSetupWorkflowStartRequest
  | OnboardTeamWorkflowStartRequest;

export type CloudflareBridgeAuthEnv = {
  TAMIAS_ENVIRONMENT?: string;
  CLOUDFLARE_ASYNC_BRIDGE_TOKEN?: string;
};

export type CloudflareWorkflowInstanceRequest = {
  instanceId: string;
};

export type CloudflareRecurringScheduleTask = "inbox-sync-scheduler" | "bank-sync-scheduler";

export type CloudflareRecurringScheduleRequest = {
  scheduleId: string;
  taskId: CloudflareRecurringScheduleTask;
  cron: string;
  timezone?: string;
  externalId?: string;
  deduplicationKey: string;
  message: CloudflareAsyncMessage;
};

export type CloudflareRecurringScheduleCancelRequest = {
  scheduleId: string;
};

type ScheduledCloudflareJob = {
  cron: string;
  minuteOfHour?: number;
  queue: CloudflareQueueGroup;
  queueName: string;
  jobName: string;
  payload: unknown;
  maxAttempts?: number;
};

const scheduledCloudflareJobs: ScheduledCloudflareJob[] = [
  {
    cron: "0 2 * * *",
    queue: "capture",
    queueName: "inbox",
    jobName: "no-match-scheduler",
    payload: {},
    maxAttempts: 3,
  },
  {
    cron: "0 3 * * *",
    queue: "capture",
    queueName: "institutions",
    jobName: "sync-institutions",
    payload: {},
    maxAttempts: 3,
  },
  {
    cron: "0 0,12 * * *",
    queue: "capture",
    queueName: "rates",
    jobName: "rates-scheduler",
    payload: {},
    maxAttempts: 3,
  },
  {
    cron: "0 0,12 * * *",
    queue: "ledger",
    queueName: "invoices",
    jobName: "invoice-status-scheduler",
    payload: {},
    maxAttempts: 3,
  },
  {
    cron: "*/30 * * * 1",
    queue: "ledger",
    queueName: "insights",
    jobName: "dispatch-insights",
    payload: {
      periodType: "weekly",
    },
    maxAttempts: 3,
  },
  {
    cron: "*/30 * * * *",
    minuteOfHour: 0,
    queue: "ledger",
    queueName: "invoices",
    jobName: "invoice-recurring-scheduler",
    payload: {},
    maxAttempts: 3,
  },
  {
    cron: "*/30 * * * *",
    minuteOfHour: 30,
    queue: "ledger",
    queueName: "invoices",
    jobName: "invoice-upcoming-notification",
    payload: {},
    maxAttempts: 3,
  },
];

export function toDelaySeconds(delayMs?: number) {
  if (!delayMs || delayMs <= 0) {
    return undefined;
  }

  return Math.max(1, Math.ceil(delayMs / 1000));
}

export function isSupportedCloudflareMessage(message: CloudflareAsyncMessage) {
  return (
    (message.queue === "capture" &&
      message.queueName === "inbox" &&
      (message.jobName === "no-match-scheduler" ||
        message.jobName === "batch-process-matching" ||
        message.jobName === "match-transactions-bidirectional" ||
        message.jobName === "process-attachment" ||
        message.jobName === "slack-upload" ||
        message.jobName === "whatsapp-upload")) ||
    (message.queue === "capture" &&
      message.queueName === "inbox-provider" &&
      (message.jobName === "initial-setup" || message.jobName === "sync-scheduler")) ||
    (message.queue === "capture" &&
      message.queueName === "documents" &&
      (message.jobName === "process-document" ||
        message.jobName === "classify-image" ||
        message.jobName === "classify-document" ||
        message.jobName === "embed-document-tags")) ||
    (message.queue === "ledger" &&
      message.queueName === "transactions" &&
      (message.jobName === "bank-sync-scheduler" ||
        message.jobName === "delete-connection" ||
        message.jobName === "enrich-transactions" ||
        message.jobName === "export-transactions" ||
        message.jobName === "import-transactions" ||
        message.jobName === "process-transaction-attachment" ||
        message.jobName === "reconnect-connection" ||
        message.jobName === "sync-connection" ||
        message.jobName === "transaction-notifications" ||
        message.jobName === "update-account-base-currency" ||
        message.jobName === "update-base-currency")) ||
    (message.queue === "ledger" &&
      message.queueName === "accounting" &&
      (message.jobName === "export-to-accounting" ||
        message.jobName === "sync-accounting-attachments")) ||
    (message.queue === "capture" &&
      message.queueName === "institutions" &&
      message.jobName === "sync-institutions") ||
    (message.queue === "capture" &&
      message.queueName === "rates" &&
      message.jobName === "rates-scheduler") ||
    (message.queue === "ledger" &&
      message.queueName === "notifications" &&
      message.jobName === "notification") ||
    (message.queue === "ledger" &&
      message.queueName === "invoices" &&
      (message.jobName === "invoice-status-scheduler" ||
        message.jobName === "invoice-recurring-scheduler" ||
        message.jobName === "invoice-upcoming-notification" ||
        message.jobName === "generate-invoice" ||
        message.jobName === "send-invoice-email" ||
        message.jobName === "send-invoice-reminder" ||
        message.jobName === "schedule-invoice")) ||
    (message.queue === "ledger" &&
      message.queueName === "insights" &&
      (message.jobName === "dispatch-insights" || message.jobName === "generate-team-insights")) ||
    (message.queue === "ledger" &&
      message.queueName === "customers" &&
      message.jobName === "enrich-customer") ||
    (message.queue === "ledger" &&
      message.queueName === "teams" &&
      (message.jobName === "invite-team-members" ||
        message.jobName === "payment-issue" ||
        message.jobName === "delete-team"))
  );
}

function getBridgeTokenFromRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  return request.headers.get("x-tamias-async-token")?.trim() ?? null;
}

export function isBridgeAuthorized(request: Request, env: CloudflareBridgeAuthEnv) {
  const configuredToken = env.CLOUDFLARE_ASYNC_BRIDGE_TOKEN?.trim();

  if (!configuredToken) {
    return env.TAMIAS_ENVIRONMENT === "development";
  }

  return getBridgeTokenFromRequest(request) === configuredToken;
}

export function isCloudflareWorkflowStartRequest(
  value: unknown,
): value is CloudflareWorkflowStartRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const payload =
    candidate.payload && typeof candidate.payload === "object"
      ? (candidate.payload as Record<string, unknown>)
      : null;

  if (
    candidate.workflow === "team-cancellation-email" &&
    typeof candidate.instanceId === "string" &&
    (typeof candidate.runId === "string" || typeof candidate.runId === "undefined") &&
    !!payload &&
    typeof payload.teamId === "string" &&
    typeof payload.email === "string" &&
    typeof payload.fullName === "string"
  ) {
    return true;
  }

  if (
    candidate.workflow === "bank-initial-setup" &&
    typeof candidate.instanceId === "string" &&
    (typeof candidate.runId === "string" || typeof candidate.runId === "undefined") &&
    !!payload &&
    typeof payload.teamId === "string" &&
    typeof payload.connectionId === "string"
  ) {
    return true;
  }

  return (
    candidate.workflow === "onboard-team" &&
    typeof candidate.instanceId === "string" &&
    (typeof candidate.runId === "string" || typeof candidate.runId === "undefined") &&
    !!payload &&
    typeof payload.email === "string"
  );
}

export function isCloudflareWorkflowInstanceRequest(
  value: unknown,
): value is CloudflareWorkflowInstanceRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.instanceId === "string";
}

export function isAlreadyExistingWorkflowError(error: unknown) {
  return error instanceof Error && error.message.toLowerCase().includes("already exists");
}

export function isWorkflowNotFoundError(error: unknown) {
  return error instanceof Error && error.message.toLowerCase().includes("not found");
}

export function buildCloudflareRecurringScheduleId(
  taskId: CloudflareRecurringScheduleTask,
  externalId: string | undefined,
  deduplicationKey: string,
) {
  return `cloudflare-schedule:${taskId}:${externalId ?? deduplicationKey}`;
}

export function buildCloudflareRecurringScheduleMessage(
  taskId: CloudflareRecurringScheduleTask,
  externalId: string | undefined,
): CloudflareAsyncMessage | null {
  switch (taskId) {
    case "inbox-sync-scheduler":
      if (!externalId) {
        return null;
      }

      return {
        queue: "capture",
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
        queue: "ledger",
        queueName: "transactions",
        jobName: "bank-sync-scheduler",
        payload: {
          teamId: externalId,
        },
        maxAttempts: 3,
      };
  }
}

export function isCloudflareRecurringScheduleRequest(
  value: unknown,
): value is CloudflareRecurringScheduleRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.scheduleId === "string" &&
    (candidate.taskId === "inbox-sync-scheduler" || candidate.taskId === "bank-sync-scheduler") &&
    typeof candidate.cron === "string" &&
    (typeof candidate.timezone === "string" || typeof candidate.timezone === "undefined") &&
    (typeof candidate.externalId === "string" || typeof candidate.externalId === "undefined") &&
    typeof candidate.deduplicationKey === "string" &&
    !!candidate.message &&
    isSupportedCloudflareMessage(candidate.message as CloudflareAsyncMessage)
  );
}

export function isCloudflareRecurringScheduleCancelRequest(
  value: unknown,
): value is CloudflareRecurringScheduleCancelRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.scheduleId === "string";
}

export function getNextRecurringScheduleAlarmAt(cron: string, nowMs = Date.now()) {
  const [minuteField, hourField, dayOfMonth, month, dayOfWeek] = cron.trim().split(/\s+/);

  if (!minuteField || !hourField || dayOfMonth !== "*" || month !== "*" || dayOfWeek !== "*") {
    return null;
  }

  const minute = Number.parseInt(minuteField, 10);
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    return null;
  }

  const hours =
    hourField === "*/6"
      ? [0, 6, 12, 18]
      : hourField
          .split(",")
          .map((value) => Number.parseInt(value, 10))
          .filter((value) => Number.isInteger(value) && value >= 0 && value <= 23);

  if (!hours.length) {
    return null;
  }

  const now = new Date(nowMs);
  const candidates: number[] = [];

  for (let dayOffset = 0; dayOffset <= 1; dayOffset += 1) {
    for (const hour of hours) {
      const candidate = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + dayOffset,
        hour,
        minute,
        0,
        0,
      );

      if (candidate > nowMs) {
        candidates.push(candidate);
      }
    }
  }

  if (!candidates.length) {
    return null;
  }

  return Math.min(...candidates);
}

export function getScheduledCloudflareMessages(cron: string, scheduledTime?: number) {
  const scheduledMinute =
    typeof scheduledTime === "number" ? new Date(scheduledTime).getUTCMinutes() : null;

  return scheduledCloudflareJobs
    .filter((job) => {
      if (job.cron !== cron) {
        return false;
      }

      if (typeof job.minuteOfHour !== "number") {
        return true;
      }

      return scheduledMinute === job.minuteOfHour;
    })
    .map(
      (scheduledJob) =>
        ({
          queue: scheduledJob.queue,
          queueName: scheduledJob.queueName,
          jobName: scheduledJob.jobName,
          payload: scheduledJob.payload,
          maxAttempts: scheduledJob.maxAttempts,
        }) satisfies CloudflareAsyncMessage,
    );
}
