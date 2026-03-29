"use server";

import { LogEvents } from "@tamias/events/events";
import { enqueue } from "@tamias/job-client";
import { z } from "zod";
import { authActionClient } from "@/actions/safe-action";
import { getQueryClient, trpc } from "@/trpc/server";

export const manualSyncTransactionsAction = authActionClient
  .schema(
    z.object({
      connectionId: z.string(),
    }),
  )
  .metadata({
    name: "manual-sync-transactions",
    track: {
      event: LogEvents.TransactionsManualSync.name,
      channel: LogEvents.TransactionsManualSync.channel,
    },
  })
  .action(async ({ parsedInput: { connectionId }, ctx: { teamId } }) => {
    // Verify the connection belongs to the caller's team
    const queryClient = getQueryClient();
    const connections = await queryClient.fetchQuery(
      trpc.bankConnections.get.queryOptions(),
    );

    const ownsConnection = connections?.some(
      (conn) => conn.id === connectionId,
    );

    if (!ownsConnection) {
      throw new Error("Connection not found");
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

    return event;
  });
