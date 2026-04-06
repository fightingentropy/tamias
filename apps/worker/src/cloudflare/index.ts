import {
  DurableObject,
  WorkerEntrypoint,
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import {
  type CloudflareAsyncServiceBinding,
  configureCloudflareQueueRuntime,
  configureCloudflareScheduleRuntime,
  enqueue,
  getRunStatus,
  scheduleRecurring,
} from "@tamias/job-client";
import "./runtime-shims";
import { generateCronTag } from "../utils/generate-cron-tag";
import {
  type CloudflareAsyncMessage,
  type CloudflareRecurringScheduleRequest,
  type CloudflareWorkflowInstanceRequest,
  type CloudflareWorkflowPayload,
  type CloudflareWorkflowStartRequest,
  getNextRecurringScheduleAlarmAt,
  getScheduledCloudflareMessages,
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
  createCloudflareScheduleRuntime,
  upsertRecurringScheduleInRunCoordinator,
} from "./schedule-runtime";
import {
  type CloudflareAsyncEnv,
  getQueueBinding,
  logger,
  updateRunStatus,
} from "./shared";

export type { CloudflareAsyncMessage } from "./bridge-helpers";
export { handleCaptureQueueBatch } from "./capture";
export { handleLedgerQueueBatch } from "./ledger";
export type { CloudflareAsyncEnv } from "./shared";

type CloudflareEnqueueRequest = CloudflareAsyncMessage & {
  delayMs?: number;
};

function configureWorkerRuntime(env: CloudflareAsyncEnv) {
  configureCloudflareQueueRuntime({
    captureQueue: env.CAPTURE_QUEUE,
    ledgerQueue: env.LEDGER_QUEUE,
  });
  configureCloudflareScheduleRuntime(createCloudflareScheduleRuntime(env));
}

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

async function runTeamCancellationWorkflow(
  env: CloudflareAsyncEnv,
  payload: Extract<
    CloudflareWorkflowPayload,
    { workflow: "team-cancellation-email" }
  >,
  step: WorkflowStep,
) {
  const {
    evaluateCancellationFollowup,
    sendCancellationFollowupEmail,
    sendCancellationImmediateEmail,
  } = await import("./team-cancellation-email");

  await updateRunStatus(payload.runId, {
    status: "active",
    startedAt: new Date().toISOString(),
    progress: 5,
    progressStep: "sending-initial-email",
  });

  await step.do(
    "send-initial-email",
    {
      retries: {
        limit: 3,
        delay: "1 minute",
      },
    },
    async () => {
      await sendCancellationImmediateEmail(payload, env);
      return { sent: true };
    },
  );

  await updateRunStatus(payload.runId, {
    status: "waiting",
    progress: 50,
    progressStep: "waiting-for-followup",
  });

  await step.sleep("wait-three-days", "3 days");

  await updateRunStatus(payload.runId, {
    status: "active",
    progress: 70,
    progressStep: "evaluating-followup",
  });

  const followupState = await step.do("evaluate-followup", async () => {
    return evaluateCancellationFollowup(payload.teamId);
  });

  if (!followupState.stillCanceled) {
    const result = {
      sentInitialEmail: true,
      sentFollowupEmail: false,
      skippedReason: "team-reactivated-or-deleted",
    };

    await updateRunStatus(payload.runId, {
      status: "completed",
      progress: 100,
      progressStep: "skipped-reactivated",
      result,
      completedAt: new Date().toISOString(),
    });

    return result;
  }

  if (!followupState.teamHasData) {
    const result = {
      sentInitialEmail: true,
      sentFollowupEmail: false,
      skippedReason: "team-has-no-data",
    };

    await updateRunStatus(payload.runId, {
      status: "completed",
      progress: 100,
      progressStep: "skipped-no-data",
      result,
      completedAt: new Date().toISOString(),
    });

    return result;
  }

  await updateRunStatus(payload.runId, {
    status: "active",
    progress: 85,
    progressStep: "sending-followup-email",
  });

  await step.do(
    "send-followup-email",
    {
      retries: {
        limit: 3,
        delay: "1 minute",
      },
    },
    async () => {
      await sendCancellationFollowupEmail(payload, env);
      return { sent: true };
    },
  );

  const result = {
    sentInitialEmail: true,
    sentFollowupEmail: true,
  };

  await updateRunStatus(payload.runId, {
    status: "completed",
    progress: 100,
    progressStep: "completed",
    result,
    completedAt: new Date().toISOString(),
  });

  return result;
}

const INITIAL_BANK_SETUP_SYNC_TIMEOUT_MS = 3 * 60 * 1000;
const INITIAL_BANK_SETUP_POLL_INTERVAL_MS = 5 * 1000;

type WorkflowAsyncRunSnapshot = {
  status:
    | "waiting"
    | "active"
    | "completed"
    | "failed"
    | "delayed"
    | "canceled"
    | "unknown";
  error?: string;
  progress?: number;
  progressStep?: string;
};

async function waitForAsyncRunInWorkflow(
  step: WorkflowStep,
  runId: string,
  label: string,
  timeoutMs: number,
): Promise<WorkflowAsyncRunSnapshot> {
  const maxAttempts = Math.max(
    1,
    Math.ceil(timeoutMs / INITIAL_BANK_SETUP_POLL_INTERVAL_MS),
  );

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const status = await step.do(`${label}-status-${attempt}`, async () => {
      const runStatus = await getRunStatus(runId);

      return {
        status: runStatus.status,
        error: runStatus.error,
        progress: runStatus.progress,
        progressStep: runStatus.progressStep,
      } satisfies WorkflowAsyncRunSnapshot;
    });

    if (
      status.status === "completed" ||
      status.status === "failed" ||
      status.status === "canceled" ||
      status.status === "unknown"
    ) {
      return status;
    }

    if (attempt < maxAttempts - 1) {
      await step.sleep(
        `${label}-sleep-${attempt}`,
        `${INITIAL_BANK_SETUP_POLL_INTERVAL_MS / 1000} seconds`,
      );
    }
  }

  return step.do(`${label}-status-final`, async () => {
    const runStatus = await getRunStatus(runId);

    return {
      status: runStatus.status,
      error: runStatus.error,
      progress: runStatus.progress,
      progressStep: runStatus.progressStep,
    } satisfies WorkflowAsyncRunSnapshot;
  });
}

async function runBankInitialSetupWorkflow(
  payload: Extract<
    CloudflareWorkflowPayload,
    { workflow: "bank-initial-setup" }
  >,
  step: WorkflowStep,
) {
  await updateRunStatus(payload.runId, {
    status: "active",
    startedAt: new Date().toISOString(),
    progress: 10,
    progressStep: "scheduling-recurring-sync",
  });

  await step.do("schedule-recurring-sync", async () => {
    return scheduleRecurring(
      "bank-sync-scheduler",
      generateCronTag(payload.teamId),
      {
        publicTeamId: payload.teamId,
        timezone: "UTC",
        externalId: payload.teamId,
        deduplicationKey: `${payload.teamId}-bank-sync-scheduler`,
      },
    );
  });

  await updateRunStatus(payload.runId, {
    status: "active",
    progress: 35,
    progressStep: "starting-initial-sync",
  });

  const initialSyncRun = await step.do("enqueue-initial-sync", async () => {
    return enqueue(
      "sync-connection",
      {
        connectionId: payload.connectionId,
        manualSync: true,
      },
      "transactions",
      {
        publicTeamId: payload.teamId,
      },
    );
  });

  await updateRunStatus(payload.runId, {
    status: "active",
    progress: 50,
    progressStep: "waiting-for-initial-sync",
  });

  const initialSyncStatus = await waitForAsyncRunInWorkflow(
    step,
    initialSyncRun.runId,
    "initial-sync",
    INITIAL_BANK_SETUP_SYNC_TIMEOUT_MS,
  );

  if (initialSyncStatus.status !== "completed") {
    throw new Error(
      initialSyncStatus.error ??
        `Initial sync finished with status ${initialSyncStatus.status}`,
    );
  }

  await updateRunStatus(payload.runId, {
    status: "active",
    progress: 85,
    progressStep: "scheduling-followup-sync",
  });

  const followupSyncRun = await step.do("enqueue-followup-sync", async () => {
    return enqueue(
      "sync-connection",
      {
        connectionId: payload.connectionId,
        manualSync: true,
      },
      "transactions",
      {
        publicTeamId: payload.teamId,
        delay: 5 * 60 * 1000,
      },
    );
  });

  const result = {
    connectionId: payload.connectionId,
    initialSyncRunId: initialSyncRun.runId,
    followupSyncRunId: followupSyncRun.runId,
  };

  await updateRunStatus(payload.runId, {
    status: "completed",
    progress: 100,
    progressStep: "completed",
    result,
    completedAt: new Date().toISOString(),
  });

  return result;
}

async function runOnboardTeamWorkflow(
  env: CloudflareAsyncEnv,
  payload: Extract<CloudflareWorkflowPayload, { workflow: "onboard-team" }>,
  step: WorkflowStep,
) {
  const {
    createTeamOnboardingContact,
    hasBankConnectionsForOnboarding,
    loadTeamOnboardingUser,
    sendTrialActivationEmailForOnboarding,
    sendTrialDeactivatedEmailForOnboarding,
    sendTrialEndedEmailForOnboarding,
    sendTrialExpiringEmailForOnboarding,
    sendWelcomeEmailForOnboarding,
    shouldSendTeamOnboardingEmail,
  } = await import("./team-onboarding");

  await updateRunStatus(payload.runId, {
    status: "waiting",
    progress: 0,
    progressStep: "waiting-initial-delay",
  });

  await step.sleep("wait-initial-delay", "10 minutes");

  await updateRunStatus(payload.runId, {
    status: "active",
    startedAt: new Date().toISOString(),
    progress: 10,
    progressStep: "loading-user",
  });

  const user = await step.do("load-user", async () => {
    return loadTeamOnboardingUser(payload.email);
  });

  await updateRunStatus(payload.runId, {
    status: "active",
    progress: 20,
    progressStep: "creating-contact",
  });

  await step.do(
    "create-contact",
    {
      retries: {
        limit: 3,
        delay: "1 minute",
      },
    },
    async () => {
      await createTeamOnboardingContact(user, env);
      return { created: true };
    },
  );

  await updateRunStatus(payload.runId, {
    status: "active",
    progress: 30,
    progressStep: "sending-welcome-email",
  });

  await step.do(
    "send-welcome-email",
    {
      retries: {
        limit: 3,
        delay: "1 minute",
      },
    },
    async () => {
      await sendWelcomeEmailForOnboarding(user, env);
      return { sent: true };
    },
  );

  if (!user.teamId) {
    const result = {
      createdContact: true,
      sentWelcomeEmail: true,
      sentTrialActivationEmail: false,
      sentTrialExpiringEmail: false,
      sentTrialEndedEmail: false,
      sentTrialDeactivatedEmail: false,
      skippedReason: "user-has-no-team",
    };

    await updateRunStatus(payload.runId, {
      status: "completed",
      progress: 100,
      progressStep: "completed-no-team",
      result,
      completedAt: new Date().toISOString(),
    });

    return result;
  }

  await updateRunStatus(payload.runId, {
    status: "waiting",
    progress: 35,
    progressStep: "waiting-activation-nudge",
  });

  await step.sleep("wait-activation-nudge", "3 days");

  const shouldSendActivationEmail = await step.do(
    "evaluate-activation-nudge",
    async () => {
      const [shouldSend, hasBankConnections] = await Promise.all([
        shouldSendTeamOnboardingEmail(user.teamId!),
        hasBankConnectionsForOnboarding(user.teamId!),
      ]);

      return shouldSend && !hasBankConnections;
    },
  );

  if (shouldSendActivationEmail) {
    await updateRunStatus(payload.runId, {
      status: "active",
      progress: 45,
      progressStep: "sending-activation-email",
    });

    await step.do(
      "send-activation-email",
      {
        retries: {
          limit: 3,
          delay: "1 minute",
        },
      },
      async () => {
        await sendTrialActivationEmailForOnboarding(user, env);
        return { sent: true };
      },
    );
  }

  await updateRunStatus(payload.runId, {
    status: "waiting",
    progress: 55,
    progressStep: "waiting-trial-expiring",
  });

  await step.sleep("wait-trial-expiring", "10 days");

  const shouldSendTrialExpiringEmail = await step.do(
    "evaluate-trial-expiring",
    async () => {
      return shouldSendTeamOnboardingEmail(user.teamId!);
    },
  );

  if (shouldSendTrialExpiringEmail) {
    await updateRunStatus(payload.runId, {
      status: "active",
      progress: 65,
      progressStep: "sending-trial-expiring-email",
    });

    await step.do(
      "send-trial-expiring-email",
      {
        retries: {
          limit: 3,
          delay: "1 minute",
        },
      },
      async () => {
        await sendTrialExpiringEmailForOnboarding(user, env);
        return { sent: true };
      },
    );
  }

  await updateRunStatus(payload.runId, {
    status: "waiting",
    progress: 75,
    progressStep: "waiting-trial-ended",
  });

  await step.sleep("wait-trial-ended", "1 day");

  const shouldSendTrialEndedEmail = await step.do(
    "evaluate-trial-ended",
    async () => {
      return shouldSendTeamOnboardingEmail(user.teamId!);
    },
  );

  if (shouldSendTrialEndedEmail) {
    await updateRunStatus(payload.runId, {
      status: "active",
      progress: 82,
      progressStep: "sending-trial-ended-email",
    });

    await step.do(
      "send-trial-ended-email",
      {
        retries: {
          limit: 3,
          delay: "1 minute",
        },
      },
      async () => {
        await sendTrialEndedEmailForOnboarding(user, env);
        return { sent: true };
      },
    );
  }

  await updateRunStatus(payload.runId, {
    status: "waiting",
    progress: 90,
    progressStep: "waiting-trial-deactivated",
  });

  await step.sleep("wait-trial-deactivated", "3 days");

  const shouldSendTrialDeactivatedEmail = await step.do(
    "evaluate-trial-deactivated",
    async () => {
      const [shouldSend, hasBankConnections] = await Promise.all([
        shouldSendTeamOnboardingEmail(user.teamId!),
        hasBankConnectionsForOnboarding(user.teamId!),
      ]);

      return shouldSend && hasBankConnections;
    },
  );

  if (shouldSendTrialDeactivatedEmail) {
    await updateRunStatus(payload.runId, {
      status: "active",
      progress: 95,
      progressStep: "sending-trial-deactivated-email",
    });

    await step.do(
      "send-trial-deactivated-email",
      {
        retries: {
          limit: 3,
          delay: "1 minute",
        },
      },
      async () => {
        await sendTrialDeactivatedEmailForOnboarding(user, env);
        return { sent: true };
      },
    );
  }

  const result = {
    createdContact: true,
    sentWelcomeEmail: true,
    sentTrialActivationEmail: shouldSendActivationEmail,
    sentTrialExpiringEmail: shouldSendTrialExpiringEmail,
    sentTrialEndedEmail: shouldSendTrialEndedEmail,
    sentTrialDeactivatedEmail: shouldSendTrialDeactivatedEmail,
  };

  await updateRunStatus(payload.runId, {
    status: "completed",
    progress: 100,
    progressStep: "completed",
    result,
    completedAt: new Date().toISOString(),
  });

  return result;
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

type StoredRecurringSchedule = CloudflareRecurringScheduleRequest & {
  createdAt: string;
  updatedAt: string;
};

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

export async function handleAsyncWorkerScheduled(
  controller: ScheduledControllerLike,
  env: CloudflareAsyncEnv,
) {
  configureWorkerRuntime(env);
  const messages = controller.cron
    ? getScheduledCloudflareMessages(controller.cron, controller.scheduledTime)
    : [];

  if (!messages.length) {
    logger.info("Skipping unsupported Cloudflare scheduled trigger", {
      cron: controller.cron ?? "unknown",
      scheduledTime: controller.scheduledTime ?? null,
    });
    return;
  }

  for (const message of messages) {
    const queueBinding = getQueueBinding(env, message.queue);
    if (!queueBinding) {
      logger.error("Missing Cloudflare queue binding for scheduled job", {
        cron: controller.cron ?? "unknown",
        queue: message.queue,
        queueName: message.queueName,
        jobName: message.jobName,
      });
      continue;
    }

    await queueBinding.send(message, {
      contentType: "json",
    });

    logger.info("Cloudflare scheduled trigger fired", {
      cron: controller.cron ?? "unknown",
      scheduledTime: controller.scheduledTime ?? null,
      queue: message.queue,
      queueName: message.queueName,
      jobName: message.jobName,
    });
  }
}

export function isCaptureConsumerQueue(queueName: string) {
  return queueName.includes("tamias-capture") && !queueName.includes("-dlq");
}

export function isLedgerConsumerQueue(queueName: string) {
  return queueName.includes("tamias-ledger") && !queueName.includes("-dlq");
}

type ScheduledControllerLike = {
  cron?: string;
  scheduledTime?: number;
};

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

export class RunCoordinator extends DurableObject<CloudflareAsyncEnv> {
  private async getStoredSchedule() {
    return this.ctx.storage.get<StoredRecurringSchedule>("schedule");
  }

  private async scheduleNextAlarm(cron: string) {
    const nextAlarmAt = getNextRecurringScheduleAlarmAt(cron);

    if (!nextAlarmAt) {
      throw new Error(`Unsupported recurring schedule cron: ${cron}`);
    }

    await this.ctx.storage.setAlarm(nextAlarmAt);
    return nextAlarmAt;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/schedule") {
      const payload = await request.json().catch(() => null);
      if (!isCloudflareRecurringScheduleRequest(payload)) {
        return Response.json(
          { error: "Invalid recurring schedule payload" },
          { status: 400 },
        );
      }

      const timestamp = new Date().toISOString();
      const existing = await this.getStoredSchedule();
      const schedule: StoredRecurringSchedule = {
        ...payload,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };

      const nextAlarmAt = await this.scheduleNextAlarm(schedule.cron);
      await this.ctx.storage.put("schedule", schedule);

      return Response.json({
        status: "active",
        scheduleId: schedule.scheduleId,
        taskId: schedule.taskId,
        nextAlarmAt: new Date(nextAlarmAt).toISOString(),
      });
    }

    if (request.method === "POST" && url.pathname === "/schedule/cancel") {
      const payload = await request.json().catch(() => null);
      if (!isCloudflareRecurringScheduleCancelRequest(payload)) {
        return Response.json(
          { error: "Invalid recurring schedule cancel payload" },
          { status: 400 },
        );
      }

      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.deleteAll();

      return Response.json({
        canceled: true,
        scheduleId: payload.scheduleId,
      });
    }

    const schedule = await this.getStoredSchedule();
    const nextAlarmAt = await this.ctx.storage.getAlarm();

    return Response.json({
      status: schedule ? "active" : "idle",
      runtime: "cloudflare-durable-object",
      environment: this.env.TAMIAS_ENVIRONMENT ?? "development",
      schedule,
      nextAlarmAt:
        typeof nextAlarmAt === "number"
          ? new Date(nextAlarmAt).toISOString()
          : null,
    });
  }

  async alarm() {
    const schedule = await this.getStoredSchedule();
    if (!schedule) {
      logger.warn("RunCoordinator alarm fired without stored schedule", {
        durableObjectId: this.ctx.id.toString(),
      });
      return;
    }

    const queueBinding = getQueueBinding(this.env, schedule.message.queue);
    if (!queueBinding) {
      logger.error("Missing queue binding for recurring schedule", {
        scheduleId: schedule.scheduleId,
        queue: schedule.message.queue,
        queueName: schedule.message.queueName,
        jobName: schedule.message.jobName,
      });
      return;
    }

    await queueBinding.send(schedule.message, {
      contentType: "json",
    });

    const nextAlarmAt = await this.scheduleNextAlarm(schedule.cron);

    logger.info("RunCoordinator alarm enqueued recurring job", {
      scheduleId: schedule.scheduleId,
      taskId: schedule.taskId,
      queue: schedule.message.queue,
      queueName: schedule.message.queueName,
      jobName: schedule.message.jobName,
      nextAlarmAt: new Date(nextAlarmAt).toISOString(),
    });
  }
}

export class AsyncWorkflow extends WorkflowEntrypoint<
  CloudflareAsyncEnv,
  CloudflareWorkflowPayload
> {
  async run(
    event: Readonly<WorkflowEvent<CloudflareWorkflowPayload>>,
    step: WorkflowStep,
  ) {
    configureCloudflareQueueRuntime({
      captureQueue: this.env.CAPTURE_QUEUE,
      ledgerQueue: this.env.LEDGER_QUEUE,
    });
    configureCloudflareScheduleRuntime(
      createCloudflareScheduleRuntime(this.env),
    );

    try {
      switch (event.payload.workflow) {
        case "team-cancellation-email":
          return runTeamCancellationWorkflow(this.env, event.payload, step);
        case "bank-initial-setup":
          return runBankInitialSetupWorkflow(event.payload, step);
        case "onboard-team":
          return runOnboardTeamWorkflow(this.env, event.payload, step);
      }
    } catch (error) {
      await updateRunStatus(event.payload.runId, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        completedAt: new Date().toISOString(),
      });

      throw error;
    }
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
