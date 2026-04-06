import {
  addProviderAccounts,
  createBankConnection,
  deleteBankConnection,
  reconnectBankConnection,
  updateBankConnectionReconnectById,
} from "@tamias/app-data/queries";
import { getBankConnections } from "@tamias/app-data/queries/bank-connections";
import { chatCache } from "@tamias/cache/chat-cache";
import { enqueue, startCloudflareWorkflow } from "@tamias/job-client";
import { TRPCError } from "@trpc/server";
import {
  addProviderAccountsSchema,
  createBankConnectionSchema,
  deleteBankConnectionSchema,
  getBankConnectionsSchema,
  manualSyncBankConnectionSchema,
  queueReconnectBankConnectionSchema,
  reconnectBankConnectionSchema,
  updateBankConnectionReconnectByIdSchema,
} from "../../schemas/bank-connections";
import { createTRPCRouter, protectedProcedure, protectedWithConvexIdProcedure } from "../init";

export const bankConnectionsRouter = createTRPCRouter({
  get: protectedProcedure
    .input(getBankConnectionsSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      return getBankConnections(db, {
        teamId: teamId!,
        enabled: input?.enabled,
      });
    }),

  create: protectedWithConvexIdProcedure
    .input(createBankConnectionSchema)
    .mutation(async ({ input, ctx: { db, teamId, session } }) => {
      const data = await createBankConnection(db, {
        ...input,
        teamId: teamId!,
        userId: session.user.convexId,
      });

      if (!data) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Bank connection not found",
        });
      }

      try {
        await chatCache.invalidateTeamContext(teamId!);
      } catch {
        // Non-fatal — cache will expire naturally
      }

      const event = await startCloudflareWorkflow(
        "bank-initial-setup",
        {
          connectionId: data.id,
          teamId: teamId!,
        },
        {
          publicTeamId: teamId!,
          appUserId: session.user.convexId,
          instanceId: `bank-initial-setup-${data.id}`,
        },
      );

      return event;
    }),

  delete: protectedProcedure
    .input(deleteBankConnectionSchema)
    .mutation(async ({ input, ctx: { db, teamId } }) => {
      const data = await deleteBankConnection(db, {
        id: input.id,
        teamId: teamId!,
      });

      if (!data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bank connection not found",
        });
      }

      await enqueue(
        "delete-connection",
        {
          referenceId: data.referenceId,
          provider: data.provider!,
          accessToken: data.accessToken,
        },
        "transactions",
        {
          publicTeamId: teamId!,
        },
      );

      return data;
    }),

  addAccounts: protectedWithConvexIdProcedure
    .input(addProviderAccountsSchema)
    .mutation(async ({ input, ctx: { db, teamId, session } }) => {
      const result = await addProviderAccounts(db, {
        connectionId: input.connectionId,
        teamId: teamId!,
        userId: session.user.convexId,
        accounts: input.accounts,
      });

      try {
        await chatCache.invalidateTeamContext(teamId!);
      } catch {
        // Non-fatal
      }

      return result;
    }),

  reconnect: protectedProcedure
    .input(reconnectBankConnectionSchema)
    .mutation(async ({ input, ctx: { db, teamId } }) => {
      const result = await reconnectBankConnection(db, {
        referenceId: input.referenceId,
        newReferenceId: input.newReferenceId,
        expiresAt: input.expiresAt,
        teamId: teamId!,
      });

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bank connection not found",
        });
      }

      return result;
    }),

  manualSync: protectedProcedure
    .input(manualSyncBankConnectionSchema)
    .mutation(async ({ input, ctx: { db, teamId } }) => {
      const connection = await getTeamBankConnectionById(db, teamId!, input.connectionId);

      return enqueue(
        "sync-connection",
        {
          connectionId: connection.id,
          manualSync: true,
        },
        "transactions",
        {
          publicTeamId: teamId!,
        },
      );
    }),

  queueReconnect: protectedProcedure
    .input(queueReconnectBankConnectionSchema)
    .mutation(async ({ input, ctx: { db, teamId } }) => {
      const connection = await getTeamBankConnectionById(db, teamId!, input.connectionId);

      if (!connection.provider) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Bank connection provider missing",
        });
      }

      if (connection.provider !== input.provider) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Bank connection provider mismatch",
        });
      }

      return enqueue(
        "reconnect-connection",
        {
          teamId: teamId!,
          connectionId: connection.id,
          provider: connection.provider,
        },
        "transactions",
        {
          publicTeamId: teamId!,
        },
      );
    }),

  updateReconnectById: protectedProcedure
    .input(updateBankConnectionReconnectByIdSchema)
    .mutation(async ({ input, ctx: { db, teamId } }) => {
      const result = await updateBankConnectionReconnectById(db, {
        ...input,
        teamId: teamId!,
      });

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bank connection not found",
        });
      }

      return result;
    }),
});

async function getTeamBankConnectionById(
  db: Parameters<typeof getBankConnections>[0],
  teamId: string,
  connectionId: string,
) {
  const connections = await getBankConnections(db, { teamId });
  const connection = connections.find((item) => item.id === connectionId);

  if (!connection) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Bank connection not found",
    });
  }

  return connection;
}
