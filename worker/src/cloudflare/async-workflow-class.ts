import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { configureEmailRuntime } from "@tamias/email/send";
import {
  configureCloudflareQueueRuntime,
  configureCloudflareScheduleRuntime,
} from "@tamias/job-client/cloudflare-runtime";
import type { CloudflareWorkflowPayload } from "./async-helpers";
import { createCloudflareScheduleRuntime } from "./schedule-runtime";
import type { CloudflareAsyncEnv } from "./shared";
import { configureWorkerRuntime } from "./worker-runtime";

export class AsyncWorkflow extends WorkflowEntrypoint<
  CloudflareAsyncEnv,
  CloudflareWorkflowPayload
> {
  async run(event: Readonly<WorkflowEvent<CloudflareWorkflowPayload>>, step: WorkflowStep) {
    configureCloudflareQueueRuntime({
      captureQueue: this.env.CAPTURE_QUEUE,
      ledgerQueue: this.env.LEDGER_QUEUE,
    });
    configureCloudflareScheduleRuntime(createCloudflareScheduleRuntime(this.env));
    configureEmailRuntime(this.env.EMAIL);
    configureWorkerRuntime(this.env);

    try {
      const { runBankInitialSetupWorkflow, runOnboardTeamWorkflow, runTeamCancellationWorkflow } =
        await import("./workflow-runs");

      switch (event.payload.workflow) {
        case "team-cancellation-email":
          return runTeamCancellationWorkflow(event.payload, step);
        case "bank-initial-setup":
          return runBankInitialSetupWorkflow(event.payload, step);
        case "onboard-team":
          return runOnboardTeamWorkflow(event.payload, step);
        default: {
          const _never: never = event.payload;
          throw new Error(`Unhandled workflow: ${JSON.stringify(_never)}`);
        }
      }
    } catch (error) {
      const { updateRunStatus } = await import("./shared");
      await updateRunStatus(event.payload.runId, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        completedAt: new Date().toISOString(),
      });

      throw error;
    }
  }
}
