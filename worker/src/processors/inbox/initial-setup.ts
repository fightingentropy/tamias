import { getInboxAccountInfo, updateInboxAccount } from "@tamias/app-data/queries";
import { enqueue, scheduleRecurring } from "@tamias/job-client";
import type { WorkerJob as Job } from "../../types/job";
import type { InboxProviderInitialSetupPayload } from "../../schemas/inbox";
import { generateQuarterDailyCronTag } from "../../utils/generate-cron-tag";
import { BaseProcessor } from "../base";

/**
 * Initial inbox setup processor
 * Registers a dynamic scheduler for the inbox account and triggers initial sync
 */
export class InitialSetupProcessor extends BaseProcessor<InboxProviderInitialSetupPayload> {
  async process(job: Job<InboxProviderInitialSetupPayload>): Promise<{
    inboxAccountId: string;
    schedulerRegistered: boolean;
  }> {
    const { inboxAccountId } = job.data;

    this.logger.info("Starting initial inbox setup", { inboxAccountId });

    const cronPattern = generateQuarterDailyCronTag(inboxAccountId);
    const account = await getInboxAccountInfo({ id: inboxAccountId });

    try {
      const schedule = await scheduleRecurring("inbox-sync-scheduler", cronPattern, {
        publicTeamId: account?.teamId,
        timezone: "UTC",
        externalId: inboxAccountId,
        deduplicationKey: `${inboxAccountId}-inbox-sync-scheduler`,
      });

      this.logger.info("Recurring inbox sync registered", {
        inboxAccountId,
        cronPattern,
        scheduleRunId: schedule.runId,
      });

      await updateInboxAccount({
        id: inboxAccountId,
        scheduleId: schedule.runId,
      });

      // Trigger initial sync
      await enqueue(
        "sync-scheduler",
        {
          id: inboxAccountId,
          manualSync: true,
        },
        "inbox-provider",
      );

      this.logger.info("Initial inbox setup completed", { inboxAccountId });

      return {
        inboxAccountId,
        schedulerRegistered: true,
      };
    } catch (error) {
      this.logger.error("Failed to register inbox scheduler", {
        inboxAccountId,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      throw error;
    }
  }
}
