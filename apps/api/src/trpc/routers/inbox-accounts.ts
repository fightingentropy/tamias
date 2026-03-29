import {
  connectInboxAccountSchema,
  deleteInboxAccountSchema,
  exchangeCodeForAccountSchema,
  syncInboxAccountSchema,
} from "../../schemas/inbox-accounts";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  deleteInboxAccount,
  getInboxAccountById,
} from "@tamias/app-data/queries";
import { getInboxAccountsForTeam } from "@tamias/app-services/inbox";
import { InboxConnector } from "@tamias/inbox/connector";
import { encryptOAuthState } from "@tamias/inbox/utils";
import { cancelSchedule, enqueue } from "@tamias/job-client";
import { createLoggerWithContext } from "@tamias/logger";
import { TRPCError } from "@trpc/server";

const logger = createLoggerWithContext("trpc:inbox-accounts");

export const inboxAccountsRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx: { teamId } }) => {
    return getInboxAccountsForTeam(teamId!);
  }),

  connect: protectedProcedure
    .input(connectInboxAccountSchema)
    .mutation(async ({ ctx: { teamId }, input }) => {
      if (!teamId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Team not found",
        });
      }

      try {
        // Encrypt state to prevent tampering with teamId
        const state = encryptOAuthState({
          teamId,
          provider: input.provider,
          source: "inbox",
          redirectPath: input.redirectPath,
        });

        const connector = new InboxConnector(input.provider);
        return connector.connect(state);
      } catch (error) {
        logger.error("Failed to connect to inbox account", {
          error: error instanceof Error ? error.message : String(error),
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to connect to inbox account",
        });
      }
    }),

  exchangeCodeForAccount: protectedProcedure
    .input(exchangeCodeForAccountSchema)
    .query(async ({ ctx: { teamId }, input }) => {
      try {
        const connector = new InboxConnector(input.provider);

        const account = await connector.exchangeCodeForAccount({
          code: input.code,
          teamId: teamId!,
        });

        return account;
      } catch (error) {
        logger.error("Failed to exchange code for account", {
          error: error instanceof Error ? error.message : String(error),
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to exchange code for account",
        });
      }
    }),

  delete: protectedProcedure
    .input(deleteInboxAccountSchema)
    .mutation(async ({ ctx: { teamId }, input }) => {
      const data = await deleteInboxAccount({
        id: input.id,
        teamId: teamId!,
      });

      if (data?.scheduleId) {
        await cancelSchedule(data.scheduleId);
      }

      return data;
    }),

  sync: protectedProcedure
    .input(syncInboxAccountSchema)
    .mutation(async ({ input, ctx: { teamId } }) => {
      // Verify the inbox account belongs to the caller's team
      const account = await getInboxAccountById({
        id: input.id,
        teamId: teamId!,
      });

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Inbox account not found",
        });
      }

      const event = await enqueue(
        "sync-scheduler",
        {
          id: input.id,
          manualSync: input.manualSync || false,
        },
        "inbox-provider",
        {
          publicTeamId: teamId!,
        },
      );

      return event;
    }),
});
