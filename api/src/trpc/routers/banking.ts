import { getProviderErrorDetails, getRates, Provider, TrueLayerApi } from "@tamias/banking";
import type { TrueLayerTokens } from "@tamias/banking";
import { decryptOAuthState, encryptOAuthState } from "@tamias/encryption";
import { createLoggerWithContext } from "@tamias/logger";
import { TRPCError } from "@trpc/server";
import {
  connectionStatusSchema,
  deleteConnectionSchema,
  getBalanceSchema,
  getProviderAccountsSchema,
  getProviderTransactionsSchema,
  truelayerAuthUrlSchema,
  truelayerExchangeSchema,
} from "../../schemas/banking";
import {
  createTRPCRouter,
  internalProcedure,
  protectedOrInternalProcedure,
  protectedProcedure,
} from "../init";

export type TrueLayerOAuthStatePayload = {
  teamId: string;
  userId: string;
  institutionId: string;
  reconnect: boolean;
  connectionId?: string;
  source: "connect";
};

const logger = createLoggerWithContext("trpc:banking");

export const bankingRouter = createTRPCRouter({
  truelayerAuthUrl: protectedProcedure
    .input(truelayerAuthUrlSchema)
    .mutation(async ({ input, ctx }) => {
      const teamId = ctx.teamId;
      if (!teamId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Missing team context" });
      }

      try {
        const state = encryptOAuthState<TrueLayerOAuthStatePayload>({
          teamId,
          userId: ctx.session.user.id,
          institutionId: input.institutionId,
          reconnect: input.reconnect ?? false,
          connectionId: input.connectionId,
          source: "connect",
        });

        const api = new TrueLayerApi();
        const url = api.buildAuthUrl({ state });

        return { url };
      } catch (error) {
        logger.error("Failed to build TrueLayer auth url", getProviderErrorDetails(error));
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to build TrueLayer authorization URL",
        });
      }
    }),

  truelayerExchange: protectedProcedure
    .input(truelayerExchangeSchema)
    .mutation(async ({ input }) => {
      const tokens = decryptOAuthState<TrueLayerTokens>(input.token, (parsed): parsed is TrueLayerTokens => {
        if (!parsed || typeof parsed !== "object") return false;
        const record = parsed as Record<string, unknown>;
        return (
          typeof record.accessToken === "string" &&
          typeof record.refreshToken === "string" &&
          typeof record.expiresAt === "string"
        );
      });

      if (!tokens) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or expired TrueLayer token",
        });
      }

      return { data: tokens };
    }),

  connectionStatus: internalProcedure.input(connectionStatusSchema).query(async ({ input }) => {
    const api = new Provider({ provider: input.provider });

    try {
      const data = await api.getConnectionStatus({
        id: input.id,
        accessToken: input.accessToken,
      });
      return { data };
    } catch (error) {
      logger.error("Failed to get connection status", getProviderErrorDetails(error));
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get connection status",
      });
    }
  }),

  deleteConnection: internalProcedure.input(deleteConnectionSchema).mutation(async ({ input }) => {
    const api = new Provider({ provider: input.provider });

    try {
      await api.deleteConnection({
        id: input.id,
        accessToken: input.accessToken,
      });
      return { data: { success: true } };
    } catch (error) {
      logger.error("Failed to delete connection", getProviderErrorDetails(error));
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to delete connection",
      });
    }
  }),

  getProviderAccounts: protectedOrInternalProcedure
    .input(getProviderAccountsSchema)
    .query(async ({ input }) => {
      const api = new Provider({ provider: input.provider });

      try {
        const data = await api.getAccounts({
          id: input.id,
          accessToken: input.accessToken,
          institutionId: input.institutionId,
        });

        // Sort accounts by balance descending (highest first) for display
        const sorted = [...data].sort((a, b) => b.balance.amount - a.balance.amount);

        return { data: sorted };
      } catch (error) {
        logger.error("Failed to get provider accounts", getProviderErrorDetails(error));
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get provider accounts",
        });
      }
    }),

  getBalance: internalProcedure.input(getBalanceSchema).query(async ({ input }) => {
    const api = new Provider({ provider: input.provider });

    try {
      const data = await api.getAccountBalance({
        accessToken: input.accessToken,
        accountId: input.id,
        accountType: input.accountType,
      });
      return { data };
    } catch (error) {
      logger.error("Failed to get account balance", getProviderErrorDetails(error));
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get account balance",
      });
    }
  }),

  getProviderTransactions: internalProcedure
    .input(getProviderTransactionsSchema)
    .query(async ({ input }) => {
      const api = new Provider({ provider: input.provider });

      try {
        const data = await api.getTransactions({
          accountId: input.accountId,
          accountType: input.accountType,
          latest: input.latest,
          accessToken: input.accessToken,
        });
        return { data };
      } catch (error) {
        logger.error("Failed to get provider transactions", getProviderErrorDetails(error));
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get provider transactions",
        });
      }
    }),

  rates: internalProcedure.query(async () => {
    try {
      const data = await getRates();
      return { data };
    } catch (error) {
      logger.error("Failed to get exchange rates", getProviderErrorDetails(error));
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get exchange rates",
      });
    }
  }),
});
