import type { WorkflowStep } from "cloudflare:workers";
import { enqueue, getRunStatus, scheduleRecurring } from "@tamias/job-client";
import { generateCronTag } from "../utils/generate-cron-tag";
import type { CloudflareWorkflowPayload } from "./bridge-helpers";
import type { CloudflareAsyncEnv } from "./shared";
import { updateRunStatus } from "./shared";

export async function runTeamCancellationWorkflow(
  env: CloudflareAsyncEnv,
  payload: Extract<CloudflareWorkflowPayload, { workflow: "team-cancellation-email" }>,
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
  status: "waiting" | "active" | "completed" | "failed" | "delayed" | "canceled" | "unknown";
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
  const maxAttempts = Math.max(1, Math.ceil(timeoutMs / INITIAL_BANK_SETUP_POLL_INTERVAL_MS));

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

export async function runBankInitialSetupWorkflow(
  payload: Extract<CloudflareWorkflowPayload, { workflow: "bank-initial-setup" }>,
  step: WorkflowStep,
) {
  await updateRunStatus(payload.runId, {
    status: "active",
    startedAt: new Date().toISOString(),
    progress: 10,
    progressStep: "scheduling-recurring-sync",
  });

  await step.do("schedule-recurring-sync", async () => {
    return scheduleRecurring("bank-sync-scheduler", generateCronTag(payload.teamId), {
      publicTeamId: payload.teamId,
      timezone: "UTC",
      externalId: payload.teamId,
      deduplicationKey: `${payload.teamId}-bank-sync-scheduler`,
    });
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
      initialSyncStatus.error ?? `Initial sync finished with status ${initialSyncStatus.status}`,
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

export async function runOnboardTeamWorkflow(
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

  const shouldSendActivationEmail = await step.do("evaluate-activation-nudge", async () => {
    const [shouldSend, hasBankConnections] = await Promise.all([
      shouldSendTeamOnboardingEmail(user.teamId!),
      hasBankConnectionsForOnboarding(user.teamId!),
    ]);

    return shouldSend && !hasBankConnections;
  });

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

  const shouldSendTrialExpiringEmail = await step.do("evaluate-trial-expiring", async () => {
    return shouldSendTeamOnboardingEmail(user.teamId!);
  });

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

  const shouldSendTrialEndedEmail = await step.do("evaluate-trial-ended", async () => {
    return shouldSendTeamOnboardingEmail(user.teamId!);
  });

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

  const shouldSendTrialDeactivatedEmail = await step.do("evaluate-trial-deactivated", async () => {
    const [shouldSend, hasBankConnections] = await Promise.all([
      shouldSendTeamOnboardingEmail(user.teamId!),
      hasBankConnectionsForOnboarding(user.teamId!),
    ]);

    return shouldSend && hasBankConnections;
  });

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
