import { getBankConnections } from "@tamias/app-data/queries";
import { enqueue } from "@tamias/job-client";
import { createLoggerWithContext } from "@tamias/logger";

const logger = createLoggerWithContext("worker:cloudflare:bank-sync-scheduler");

export async function runBankSyncScheduler(teamId: string) {
  const connections = await getBankConnections(undefined as never, {
    teamId,
  });

  if (!connections?.length) {
    logger.info("No bank connections found for scheduled sync", {
      teamId,
    });
    return {
      teamId,
      connectionsScheduled: 0,
    };
  }

  const scheduledRuns = await Promise.all(
    connections.map((connection) =>
      enqueue(
        "sync-connection",
        {
          connectionId: connection.id,
          manualSync: false,
        },
        "transactions",
        {
          publicTeamId: teamId,
          metadata: {
            source: "cloudflare-schedule",
            schedulerTask: "bank-sync-scheduler",
          },
        },
      ),
    ),
  );

  logger.info("Scheduled bank sync jobs", {
    teamId,
    connectionsScheduled: scheduledRuns.length,
    connectionIds: connections.map((connection) => connection.id),
    runIds: scheduledRuns.map((run) => run.runId),
  });

  return {
    teamId,
    connectionsScheduled: scheduledRuns.length,
    runIds: scheduledRuns.map((run) => run.runId),
  };
}
