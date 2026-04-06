import { anthropic } from "@ai-sdk/anthropic";
import {
  createTransaction,
  deleteTransactions,
  getBankAccountById,
  getSimilarTransactions,
  moveTransactionToReview,
  searchTransactionMatch,
  updateBankAccount,
  updateTransaction,
  updateTransactions,
} from "@tamias/app-data/queries";
import {
  getTransactionByIdForTeam,
  getTransactionsPage,
  getTransactionsReviewCount,
} from "@tamias/app-services/transactions";
import {
  buildCsvMappingPrompt,
  compactSampleRows,
  formatAmountValue,
  selectPromptColumns,
} from "@tamias/import";
import { enqueue } from "@tamias/job-client";
import { TRPCError } from "@trpc/server";
import { generateObject } from "ai";
import {
  createTransactionSchema,
  deleteTransactionsSchema,
  exportTransactionsSchema,
  generateCsvMappingResponseSchema,
  generateCsvMappingSchema,
  getSimilarTransactionsSchema,
  getTransactionByIdSchema,
  getTransactionsSchema,
  importTransactionsSchema,
  moveToReviewSchema,
  searchTransactionMatchSchema,
  updateTransactionSchema,
  updateTransactionsSchema,
} from "../../schemas/transactions";
import { createTRPCRouter, protectedProcedure } from "../init";

const csvMappingInFlight = new Map<
  string,
  Promise<{
    date?: string;
    description?: string;
    counterparty?: string;
    amount?: string;
    balance?: string;
    currency?: string;
  }>
>();

export const transactionsRouter = createTRPCRouter({
  get: protectedProcedure
    .input(getTransactionsSchema)
    .query(async ({ input, ctx: { db, teamId } }) => {
      return getTransactionsPage({
        db,
        teamId: teamId!,
        input,
      });
    }),

  getById: protectedProcedure
    .input(getTransactionByIdSchema)
    .query(async ({ input, ctx: { db, teamId } }) => {
      return getTransactionByIdForTeam({
        db,
        teamId: teamId!,
        input: { id: input.id },
      });
    }),

  deleteMany: protectedProcedure
    .input(deleteTransactionsSchema)
    .mutation(async ({ input, ctx: { db, teamId } }) => {
      return deleteTransactions(db, { ids: input, teamId: teamId! });
    }),

  getReviewCount: protectedProcedure.query(async ({ ctx: { db, teamId } }) => {
    return getTransactionsReviewCount({
      db,
      teamId: teamId!,
    });
  }),

  update: protectedProcedure
    .input(updateTransactionSchema)
    .mutation(async ({ input, ctx: { db, teamId, session } }) => {
      return updateTransaction(db, {
        ...input,
        userId: session.user.convexId ?? undefined,
        teamId: teamId!,
      });
    }),

  updateMany: protectedProcedure
    .input(updateTransactionsSchema)
    .mutation(async ({ input, ctx: { db, teamId, session } }) => {
      return updateTransactions(db, {
        ...input,
        userId: session.user.convexId ?? undefined,
        teamId: teamId!,
      });
    }),

  getSimilarTransactions: protectedProcedure
    .input(getSimilarTransactionsSchema)
    .query(async ({ input, ctx: { db, teamId } }) => {
      return getSimilarTransactions(db, {
        name: input.name,
        categorySlug: input.categorySlug,
        frequency: input.frequency,
        teamId: teamId!,
        transactionId: input.transactionId,
      });
    }),

  searchTransactionMatch: protectedProcedure
    .input(searchTransactionMatchSchema)
    .query(async ({ input, ctx: { db, teamId } }) => {
      return searchTransactionMatch(db, {
        query: input.query,
        teamId: teamId!,
        inboxId: input.inboxId,
        maxResults: input.maxResults,
        minConfidenceScore: input.minConfidenceScore,
        includeAlreadyMatched: input.includeAlreadyMatched,
      });
    }),

  create: protectedProcedure
    .input(createTransactionSchema)
    .mutation(async ({ input, ctx: { db, teamId, session } }) => {
      const transaction = await createTransaction(db, {
        ...input,
        teamId: teamId!,
      });

      if (transaction?.id) {
        await enqueue(
          "enrich-transactions",
          {
            transactionIds: [transaction.id],
            teamId: teamId!,
          },
          "transactions",
          {
            publicTeamId: teamId!,
            appUserId: session.user.convexId ?? undefined,
          },
        );

        await enqueue(
          "match-transactions-bidirectional",
          {
            teamId: teamId!,
            newTransactionIds: [transaction.id],
          },
          "inbox",
          {
            publicTeamId: teamId!,
            appUserId: session.user.convexId ?? undefined,
          },
        );
      }

      return transaction;
    }),

  export: protectedProcedure
    .input(exportTransactionsSchema)
    .mutation(async ({ input, ctx: { teamId, session } }) => {
      if (!teamId) {
        throw new Error("Team not found");
      }

      return enqueue(
        "export-transactions",
        {
          teamId,
          userId: session.user.id,
          userEmail: session.user.email ?? undefined,
          locale: input.locale,
          transactionIds: input.transactionIds,
          dateFormat: input.dateFormat,
          exportSettings: input.exportSettings,
        },
        "transactions",
        {
          publicTeamId: teamId,
          appUserId: session.user.convexId ?? undefined,
        },
      );
    }),

  import: protectedProcedure
    .input(importTransactionsSchema)
    .mutation(async ({ input, ctx: { db, teamId, session } }) => {
      if (!teamId) {
        throw new Error("Team not found");
      }

      // Only update balance/currency for manual accounts (backfill into connected accounts keeps bank-synced balance)
      const account = await getBankAccountById(db, {
        id: input.bankAccountId,
        teamId,
      });

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bank account not found",
        });
      }

      if (account.manual) {
        const parsedBalance = input.currentBalance
          ? formatAmountValue({ amount: input.currentBalance })
          : null;

        const balance =
          parsedBalance !== null && Number.isFinite(parsedBalance)
            ? parsedBalance
            : null;

        await updateBankAccount(db, {
          id: input.bankAccountId,
          teamId,
          currency: input.currency,
          balance: balance ?? undefined,
        });
      }

      return enqueue(
        "import-transactions",
        {
          filePath: input.filePath,
          bankAccountId: input.bankAccountId,
          currency: input.currency,
          mappings: input.mappings,
          teamId,
          inverted: input.inverted,
        },
        "transactions",
        {
          publicTeamId: teamId,
          appUserId: session.user.convexId ?? undefined,
        },
      );
    }),

  moveToReview: protectedProcedure
    .input(moveToReviewSchema)
    .mutation(async ({ input, ctx: { db, teamId } }) => {
      if (!teamId) {
        throw new Error("Team not found");
      }

      await moveTransactionToReview(db, {
        transactionId: input.transactionId,
        teamId,
      });

      return { success: true };
    }),

  generateCsvMapping: protectedProcedure
    .input(generateCsvMappingSchema)
    .mutation(async ({ input, ctx: { teamId } }) => {
      const requestStartedAt = Date.now();
      const promptColumns = selectPromptColumns(input.fieldColumns);
      const sampleRows = compactSampleRows(input.firstRows, promptColumns);
      const prompt = buildCsvMappingPrompt(promptColumns, sampleRows);
      const requestKey = JSON.stringify({
        teamId,
        columns: promptColumns,
        sampleRows,
      });

      const inFlight = csvMappingInFlight.get(requestKey);
      if (inFlight) {
        console.info("CSV mapping reusing in-flight request", {
          mode: "object",
          columnsCount: promptColumns.length,
          sampleRowsCount: sampleRows.length,
        });
        return inFlight;
      }

      const mappingPromise = (async () => {
        try {
          const { object } = await generateObject({
            model: anthropic("claude-3-haiku-20240307"),
            schema: generateCsvMappingResponseSchema,
            prompt,
          });

          return generateCsvMappingResponseSchema.parse(object);
        } catch (error) {
          console.error("Error generating CSV mapping:", {
            mode: "object",
            durationMs: Date.now() - requestStartedAt,
            error,
          });
          throw error;
        } finally {
          csvMappingInFlight.delete(requestKey);
        }
      })();

      csvMappingInFlight.set(requestKey, mappingPromise);

      return mappingPromise;
    }),
});
