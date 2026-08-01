import {
  addProviderAccounts,
  createBankConnection,
  deleteBankConnection,
} from "@tamias/app-data/queries";
import { getBankConnections } from "@tamias/app-data/queries/bank-connections";
import { chatCache } from "@tamias/cache/chat-cache";
import { enqueue, startCloudflareWorkflow } from "@tamias/job-client";
import { createLoggerWithContext } from "@tamias/logger";
import { TRPCError } from "@trpc/server";

const logger = createLoggerWithContext("bank-connections-router");
import {
  addProviderAccountsSchema,
  createBankConnectionSchema,
  deleteBankConnectionSchema,
  getBankConnectionsSchema,
  manualSyncBankConnectionSchema,
  queueReconnectBankConnectionSchema,
} from "../../schemas/bank-connections";
import { createTRPCRouter, protectedProcedure } from "../init";

export const bankConnectionsRouter = createTRPCRouter({
  get: protectedProcedure
    .input(getBankConnectionsSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      return getBankConnections(db, {
        teamId: teamId!,
        enabled: input?.enabled,
      });
    }),

  create: protectedProcedure
    .input(createBankConnectionSchema)
    .mutation(async ({ input, ctx: { db, teamId, session } }) => {
      logger.info("bankConnections.create input", {
        provider: input.provider,
        accountCount: input.accounts.length,
        accountInstitutionIds: input.accounts.map((a) => a.institutionId),
        accountBankNames: input.accounts.map((a) => a.bankName),
        hasAccessToken: !!input.accessToken,
        accessTokenLength: input.accessToken?.length ?? 0,
      });

      let data: Awaited<ReturnType<typeof createBankConnection>>;
      try {
        data = await createBankConnection(db, {
          ...input,
          teamId: teamId!,
          userId: session.user.id,
        });
      } catch (error) {
        logger.error("bankConnections.create failed", {
          errorName: error instanceof Error ? error.name : typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
        });
        throw error;
      }

      if (!data) {
        logger.error("bankConnections.create returned no record", {
          provider: input.provider,
          firstAccount: input.accounts[0],
        });
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
          appUserId: session.user.id,
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

  addAccounts: protectedProcedure
    .input(addProviderAccountsSchema)
    .mutation(async ({ input, ctx: { db, teamId, session } }) => {
      const result = await addProviderAccounts(db, {
        connectionId: input.connectionId,
        teamId: teamId!,
        userId: session.user.id,
        accounts: input.accounts,
      });

      try {
        await chatCache.invalidateTeamContext(teamId!);
      } catch {
        // Non-fatal
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
