import {
  addProviderAccountsSchema,
  createBankConnectionSchema,
  deleteBankConnectionSchema,
  getBankConnectionsSchema,
  reconnectBankConnectionSchema,
  updateBankConnectionReconnectByIdSchema,
} from "../../schemas/bank-connections";
import { createTRPCRouter, protectedProcedure } from "../init";
import { getBankConnectionsForTeam } from "@tamias/app-services/bank";
import { chatCache } from "@tamias/cache/chat-cache";
import {
  addProviderAccounts,
  createBankConnection,
  deleteBankConnection,
  reconnectBankConnection,
  updateBankConnectionReconnectById,
} from "@tamias/app-data/queries";
import { enqueue, startCloudflareWorkflow } from "@tamias/job-client";
import { TRPCError } from "@trpc/server";

export const bankConnectionsRouter = createTRPCRouter({
  get: protectedProcedure
    .input(getBankConnectionsSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      return getBankConnectionsForTeam({
        db,
        teamId: teamId!,
        input: {
          enabled: input?.enabled,
        },
      });
    }),

  create: protectedProcedure
    .input(createBankConnectionSchema)
    .mutation(async ({ input, ctx: { db, teamId, session } }) => {
      if (!session.user.convexId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Missing Convex user id",
        });
      }

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
        throw new Error("Bank connection not found");
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
      if (!session.user.convexId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Missing Convex user id",
        });
      }

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
