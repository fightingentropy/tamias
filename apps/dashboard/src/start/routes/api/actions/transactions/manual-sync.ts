import { createFileRoute } from "@tanstack/react-router";
import { LogEvents } from "@tamias/events/events";
import { enqueue } from "@tamias/job-client";
import { manualSyncTransactionsActionSchema } from "@/actions/transactions/manual-sync-transactions-action";
import {
  requireAuthenticatedActionUser,
  trackAction,
} from "@/start/server/action-auth";
import { getTRPCClient } from "@/trpc/server";

export const Route = createFileRoute("/api/actions/transactions/manual-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { connectionId } = manualSyncTransactionsActionSchema.parse(
          await request.json(),
        );
        const { teamId } = await requireAuthenticatedActionUser();

        await trackAction({
          event: LogEvents.TransactionsManualSync.name,
          channel: LogEvents.TransactionsManualSync.channel,
        });

        const trpc = await getTRPCClient();
        const connections = await trpc.bankConnections.get.query();
        const ownsConnection = connections?.some(
          (connection) => connection.id === connectionId,
        );

        if (!ownsConnection) {
          return Response.json(
            {
              error: "Connection not found",
            },
            {
              status: 404,
            },
          );
        }

        const event = await enqueue(
          "sync-connection",
          {
            connectionId,
            manualSync: true,
          },
          "transactions",
          {
            publicTeamId: teamId!,
          },
        );

        return Response.json(event);
      },
    },
  },
});
