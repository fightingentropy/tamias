import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import {
  getTransactionsForEnrichment,
  markTransactionsAsEnriched,
  type UpdateTransactionEnrichmentParams,
  updateTransactionEnrichments,
} from "@tamias/app-data/queries";
import { generateObject } from "ai";
import type { WorkerJob as Job } from "../../types/job";
import type { EnrichTransactionsPayload } from "../../schemas/transactions";
import { getDb } from "../../utils/db";
import {
  generateEnrichmentPrompt,
  prepareTransactionData,
  prepareUpdateData,
} from "../../utils/enrichment-helpers";
import { enrichmentSchema } from "../../utils/enrichment-schema";
import { processBatch } from "../../utils/process-batch";
import { BaseProcessor } from "../base";

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_OPENROUTER_BATCH_SIZE = 30;
const DEFAULT_GOOGLE_ENRICHMENT_MODEL = "gemini-2.5-flash-lite";
const DEFAULT_OPENROUTER_ENRICHMENT_MODEL = "openai/gpt-4o-mini";

type EnrichmentProviderName = "google" | "openrouter";

let googleProvider: ReturnType<typeof createGoogleGenerativeAI> | null = null;
let openRouterProvider: ReturnType<typeof createOpenAI> | null = null;

function getGoogleProvider() {
  return (googleProvider ??= createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  }));
}

function buildOpenRouterHeaders(): Record<string, string> | undefined {
  const referer = process.env.OPENROUTER_HTTP_REFERER?.trim();
  const title = process.env.OPENROUTER_APP_NAME?.trim();
  if (!referer && !title) {
    return undefined;
  }

  return {
    ...(referer ? { "HTTP-Referer": referer } : {}),
    ...(title ? { "X-Title": title } : {}),
  };
}

function getOpenRouterProvider() {
  return (openRouterProvider ??= createOpenAI({
    name: "openrouter",
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.OPENROUTER_BASE_URL?.replace(/\/$/, "") || "https://openrouter.ai/api/v1",
    headers: buildOpenRouterHeaders(),
  }));
}

function resolveEnrichmentProviderName(): EnrichmentProviderName {
  const configured = process.env.TRANSACTION_ENRICHMENT_PROVIDER?.trim().toLowerCase();

  if (configured === "openrouter" || configured === "google") {
    return configured;
  }

  if (process.env.OPENROUTER_API_KEY) {
    return "openrouter";
  }

  return "google";
}

function getEnrichmentModelConfig() {
  const provider = resolveEnrichmentProviderName();

  if (provider === "openrouter") {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("OpenRouter transaction enrichment requires OPENROUTER_API_KEY.");
    }

    const modelName =
      process.env.OPENROUTER_TRANSACTION_ENRICHMENT_MODEL || DEFAULT_OPENROUTER_ENRICHMENT_MODEL;

    return {
      model: getOpenRouterProvider().chat(modelName),
      modelName,
      provider,
    };
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error("Google transaction enrichment requires GOOGLE_GENERATIVE_AI_API_KEY.");
  }

  const modelName =
    process.env.GOOGLE_TRANSACTION_ENRICHMENT_MODEL || DEFAULT_GOOGLE_ENRICHMENT_MODEL;

  return {
    model: getGoogleProvider().chat(modelName),
    modelName,
    provider,
  };
}

function getEnrichmentBatchSize() {
  const configured = Number(process.env.TRANSACTION_ENRICHMENT_BATCH_SIZE);
  if (Number.isInteger(configured) && configured > 0) {
    return configured;
  }

  return resolveEnrichmentProviderName() === "openrouter"
    ? DEFAULT_OPENROUTER_BATCH_SIZE
    : DEFAULT_BATCH_SIZE;
}

/**
 * Enriches transactions with AI (merchant names, categories)
 * Uses the configured AI provider to extract merchant names and categorize transactions.
 */
export class EnrichTransactionProcessor extends BaseProcessor<EnrichTransactionsPayload> {
  async process(job: Job<EnrichTransactionsPayload>): Promise<{
    enrichedCount: number;
    teamId: string;
  }> {
    const { transactionIds, teamId } = job.data;
    const db = getDb();

    this.logger.info("Starting enrich-transactions job", {
      jobId: job.id,
      teamId,
      transactionCount: transactionIds.length,
    });

    // Get transactions that need enrichment
    const transactionsToEnrich = await getTransactionsForEnrichment(db, {
      transactionIds,
      teamId,
    });

    if (transactionsToEnrich.length === 0) {
      this.logger.info("No transactions need enrichment", { teamId });
      return { enrichedCount: 0, teamId };
    }

    this.logger.info("Starting transaction enrichment", {
      aiModel:
        process.env.OPENROUTER_TRANSACTION_ENRICHMENT_MODEL ||
        process.env.GOOGLE_TRANSACTION_ENRICHMENT_MODEL ||
        (resolveEnrichmentProviderName() === "openrouter"
          ? DEFAULT_OPENROUTER_ENRICHMENT_MODEL
          : DEFAULT_GOOGLE_ENRICHMENT_MODEL),
      aiProvider: resolveEnrichmentProviderName(),
      teamId,
      transactionCount: transactionsToEnrich.length,
    });

    let totalEnriched = 0;

    // Process in provider-sized batches to keep structured output stable.
    await processBatch(
      transactionsToEnrich,
      getEnrichmentBatchSize(),
      async (batch): Promise<string[]> => {
        // Prepare transactions for LLM
        const transactionData = prepareTransactionData(batch);
        const prompt = generateEnrichmentPrompt(transactionData, batch);

        // Track transactions enriched in this batch to avoid double counting
        let batchEnrichedCount = 0;

        try {
          const { model, modelName, provider } = getEnrichmentModelConfig();

          const { object } = await generateObject({
            model,
            prompt,
            output: "array",
            schema: enrichmentSchema,
            temperature: 0.1, // Low temperature for consistency
          });

          // Prepare updates for batch processing
          const updates: UpdateTransactionEnrichmentParams[] = [];
          const noUpdateNeeded: string[] = [];
          let categoriesUpdated = 0;
          let skippedResults = 0;

          // With output: "array", object is the array directly
          const results = object;
          const resultsToProcess = Math.min(results.length, batch.length);

          for (let i = 0; i < resultsToProcess; i++) {
            const result = results[i];
            const transaction = batch[i];

            if (!result || !transaction) {
              skippedResults++;
              // Still mark the transaction as processed even if LLM result is invalid
              if (transaction) {
                noUpdateNeeded.push(transaction.id);
              }
              continue;
            }

            const updateData = prepareUpdateData(transaction, result);

            // Check if any updates are needed
            if (!updateData.merchantName && !updateData.categorySlug) {
              // No updates needed - mark as enriched separately
              noUpdateNeeded.push(transaction.id);
              continue;
            }

            // Track if category was updated
            if (updateData.categorySlug) {
              categoriesUpdated++;
            }

            updates.push({
              transactionId: transaction.id,
              data: updateData,
            });
          }

          // Log if we have mismatched result counts
          if (results.length !== batch.length) {
            this.logger.warn("LLM returned different number of results than expected", {
              expectedCount: batch.length,
              actualCount: results.length,
              teamId,
            });
          }

          // Execute all updates
          if (updates.length > 0) {
            await updateTransactionEnrichments(db, { teamId, updates });
            batchEnrichedCount += updates.length;
          }

          // Mark transactions that don't need updates as enriched
          if (noUpdateNeeded.length > 0) {
            await markTransactionsAsEnriched(db, {
              teamId,
              transactionIds: noUpdateNeeded,
            });
            batchEnrichedCount += noUpdateNeeded.length;
          }

          const totalProcessed = updates.length + noUpdateNeeded.length;
          if (totalProcessed > 0) {
            this.logger.info("Enriched transaction batch", {
              aiModel: modelName,
              aiProvider: provider,
              batchSize: batch.length,
              enrichedCount: totalProcessed,
              updatesApplied: updates.length,
              noUpdateNeeded: noUpdateNeeded.length,
              merchantNamesUpdated: updates.filter((update) => update.data.merchantName).length,
              categoriesUpdated,
              skippedResults,
              teamId,
            });
          }

          // Ensure ALL transactions in the batch are marked as enrichment completed
          // This is critical for UI loading states - enrichment_completed indicates the process finished, not success
          const processedIds = new Set([...updates.map((u) => u.transactionId), ...noUpdateNeeded]);

          const unprocessedTransactions = batch.filter((tx) => !processedIds.has(tx.id));

          // Mark ANY remaining unprocessed transactions as enriched (process completed, even if no data found)
          if (unprocessedTransactions.length > 0) {
            const fallbackCategoryUpdates: UpdateTransactionEnrichmentParams[] =
              unprocessedTransactions
                .filter((tx) => !tx.categorySlug && tx.amount <= 0)
                .map((tx) => ({
                  transactionId: tx.id,
                  data: { categorySlug: "uncategorized" },
                }));
            const fallbackCategoryIds = new Set(
              fallbackCategoryUpdates.map((update) => update.transactionId),
            );
            const remainingTransactionIds = unprocessedTransactions
              .filter((tx) => !fallbackCategoryIds.has(tx.id))
              .map((tx) => tx.id);

            if (fallbackCategoryUpdates.length > 0) {
              await updateTransactionEnrichments(db, {
                teamId,
                updates: fallbackCategoryUpdates,
              });
              batchEnrichedCount += fallbackCategoryUpdates.length;
            }

            if (remainingTransactionIds.length > 0) {
              await markTransactionsAsEnriched(db, {
                teamId,
                transactionIds: remainingTransactionIds,
              });
              batchEnrichedCount += remainingTransactionIds.length;
            }

            this.logger.info("Marked remaining unprocessed transactions as completed", {
              count: unprocessedTransactions.length,
              fallbackCategorized: fallbackCategoryUpdates.length,
              reason: "enrichment_process_finished",
              teamId,
            });
          }

          // Add the actual count of enriched transactions from this batch
          totalEnriched += batchEnrichedCount;

          // Return ALL transaction IDs from the batch (all should now be marked as enriched)
          // Defensive handling for potentially falsy transactions
          return batch.filter((tx) => tx?.id).map((tx) => tx.id);
        } catch (error) {
          this.logger.error("Failed to enrich transaction batch", {
            aiProvider: resolveEnrichmentProviderName(),
            error: error instanceof Error ? error.message : "Unknown error",
            batchSize: batch.length,
            teamId,
          });

          // Even if enrichment fails, mark all transactions as completed to prevent infinite loading
          // The enrichment_completed field indicates process completion, not success
          try {
            // Defensive handling for potentially falsy transactions
            const validTransactions = batch.filter((tx) => tx?.id);
            const fallbackCategoryUpdates: UpdateTransactionEnrichmentParams[] = validTransactions
              .filter((tx) => !tx.categorySlug && tx.amount <= 0)
              .map((tx) => ({
                transactionId: tx.id,
                data: { categorySlug: "uncategorized" },
              }));
            const fallbackCategoryIds = new Set(
              fallbackCategoryUpdates.map((update) => update.transactionId),
            );
            const transactionIdsToMark = validTransactions
              .filter((tx) => !fallbackCategoryIds.has(tx.id))
              .map((tx) => tx.id);
            const validTransactionIds = validTransactions.map((tx) => tx.id);

            if (fallbackCategoryUpdates.length > 0) {
              await updateTransactionEnrichments(db, {
                teamId,
                updates: fallbackCategoryUpdates,
              });
            }

            if (transactionIdsToMark.length > 0) {
              await markTransactionsAsEnriched(db, {
                teamId,
                transactionIds: transactionIdsToMark,
              });
            }

            this.logger.info(
              "Marked failed batch transactions as completed to prevent infinite loading",
              {
                count: validTransactionIds.length,
                fallbackCategorized: fallbackCategoryUpdates.length,
                reason: "enrichment_process_failed_but_completed",
                teamId,
              },
            );

            // Only add transactions that weren't already counted in batchEnrichedCount
            // If batchEnrichedCount > 0, some transactions were already processed and counted
            const uncountedTransactions = validTransactionIds.length - batchEnrichedCount;
            if (uncountedTransactions > 0) {
              totalEnriched += uncountedTransactions;
            }

            // Return the valid transaction IDs even though enrichment failed
            return validTransactionIds;
          } catch (markError) {
            this.logger.error("Failed to mark transactions as completed after enrichment error", {
              markError: markError instanceof Error ? markError.message : "Unknown error",
              originalError: error instanceof Error ? error.message : "Unknown error",
              batchSize: batch.length,
              teamId,
            });
            throw error; // Re-throw original error
          }
        }
      },
    );

    this.logger.info("Transaction enrichment completed", {
      totalEnriched,
      teamId,
    });

    return { enrichedCount: totalEnriched, teamId };
  }
}
