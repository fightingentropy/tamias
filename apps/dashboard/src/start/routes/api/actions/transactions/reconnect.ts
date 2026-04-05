import { createFileRoute } from "@tanstack/react-router"
import { createAppPublicFileRoute } from "@/start/route-hosts";
import { LogEvents } from "@/lib/telemetry/events";
import { reconnectConnectionActionSchema } from "@/actions/transactions/reconnect-connection-action";
import {
  requireAuthenticatedActionUser,
  trackAction,
} from "@/start/server/action-auth";
import { isNotFoundQueryError } from "@/start/server/route-data/shared";
import { getTRPCClient } from "@/trpc/server";

export const Route = createAppPublicFileRoute("/api/actions/transactions/reconnect")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { connectionId, provider } = reconnectConnectionActionSchema.parse(
          await request.json(),
        );
        await requireAuthenticatedActionUser();

        await trackAction({
          event: LogEvents.ReconnectConnection.name,
          channel: LogEvents.ReconnectConnection.channel,
        });

        try {
          const trpc = await getTRPCClient();
          const event = await trpc.bankConnections.queueReconnect.mutate({
            connectionId,
            provider,
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
