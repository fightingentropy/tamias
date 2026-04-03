import { createFileRoute } from "@tanstack/react-router"
import { createAppPublicFileRoute } from "@/start/route-hosts";
import { LogEvents } from "@tamias/events/events";
import { enqueue } from "@tamias/job-client";
import { reconnectConnectionActionSchema } from "@/actions/transactions/reconnect-connection-action";
import {
  requireAuthenticatedActionUser,
  trackAction,
} from "@/start/server/action-auth";

export const Route = createAppPublicFileRoute("/api/actions/transactions/reconnect")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { connectionId, provider } = reconnectConnectionActionSchema.parse(
          await request.json(),
        );
        const { teamId } = await requireAuthenticatedActionUser();

        await trackAction({
          event: LogEvents.ReconnectConnection.name,
          channel: LogEvents.ReconnectConnection.channel,
        });

        const event = await enqueue(
          "reconnect-connection",
          {
            teamId: teamId!,
            connectionId,
            provider,
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
