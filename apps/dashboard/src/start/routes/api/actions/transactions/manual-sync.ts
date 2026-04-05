import { createFileRoute } from "@tanstack/react-router"
import { createAppPublicFileRoute } from "@/start/route-hosts";
import { LogEvents } from "@/lib/analytics/events";
import { manualSyncTransactionsActionSchema } from "@/actions/transactions/manual-sync-transactions-action";
import {
  requireAuthenticatedActionUser,
  trackAction,
} from "@/start/server/action-auth";
import { isNotFoundQueryError } from "@/start/server/route-data/shared";
import { getTRPCClient } from "@/trpc/server";

export const Route = createAppPublicFileRoute("/api/actions/transactions/manual-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { connectionId } = manualSyncTransactionsActionSchema.parse(
          await request.json(),
        );
        await requireAuthenticatedActionUser();

        await trackAction({
          event: LogEvents.TransactionsManualSync.name,
          channel: LogEvents.TransactionsManualSync.channel,
        });

        try {
          const trpc = await getTRPCClient();
          const event = await trpc.bankConnections.manualSync.mutate({
            connectionId,
          });

          return Response.json(event);
        } catch (error) {
          if (isNotFoundQueryError(error)) {
            return Response.json(
              {
                error: "Connection not found",
              },
              {
                status: 404,
              },
            );
          }

          throw error;
        }
      },
    },
  },
});
