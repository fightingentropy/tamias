"use server";

import { LogEvents } from "@tamias/events/events";
import { enqueue } from "@tamias/job-client";
import { z } from "zod";
import { authActionClient } from "@/actions/safe-action";

export const reconnectConnectionAction = authActionClient
  .schema(
    z.object({
      connectionId: z.string(),
      provider: z.string(),
    }),
  )
  .metadata({
    name: "reconnect-connection",
    track: {
      event: LogEvents.ReconnectConnection.name,
      channel: LogEvents.ReconnectConnection.channel,
    },
  })
  .action(
    async ({ parsedInput: { connectionId, provider }, ctx: { teamId } }) => {
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

      return event;
    },
  );
