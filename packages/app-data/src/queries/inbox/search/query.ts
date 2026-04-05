import { getTransactionByIdFromConvex } from "@tamias/app-data-convex";
import { createLoggerWithContext } from "@tamias/logger";
import type { Database } from "../../../client";
import {
  calculateAmountScore as calculateUnifiedAmountScore,
  calculateCurrencyScore as calculateUnifiedCurrencyScore,
  calculateDateScore as calculateUnifiedDateScore,
  calculateNameScore as calculateUnifiedNameScore,
  scoreMatch,
} from "../../../utils/transaction-matching";
import {
  compareNullableDates,
  includesSearch,
  shiftIsoDate,
} from "../shared";
import {
  getIndexedInboxSearchCandidates,
  getRecentInboxSearchItems,
  isInboxSearchCandidate,
} from "./shared";

const logger = createLoggerWithContext("inbox");

export type GetInboxSearchParams = {
  teamId: string;
  limit?: number;
  q?: string;
  transactionId?: string;
};

export async function getInboxSearch(
  _db: Database,
  params: GetInboxSearchParams,
) {
  try {
    const { teamId, q, transactionId, limit = 10 } = params;

    if (q && q.trim().length > 0) {
      const searchTerm = q.trim();
      const numericSearch = Number.parseFloat(
        searchTerm.replace(/[^\d.-]/g, ""),
      );
      const isNumericSearch =
        !Number.isNaN(numericSearch) && Number.isFinite(numericSearch);
      const candidateLimit = Math.max(limit * 20, 100);
      const [textCandidates, amountCandidates] = await Promise.all([
        getIndexedInboxSearchCandidates({
          teamId,
          searchTerms: [searchTerm],
          limit: candidateLimit,
        }),
        isNumericSearch
          ? getIndexedInboxSearchCandidates({
              teamId,
              searchTerms: [],
              amount: numericSearch,
              limit: candidateLimit,
            })
          : Promise.resolve([]),
      ]);
      const items = [
        ...new Map(
          [...textCandidates, ...amountCandidates]
            .filter(isInboxSearchCandidate)
            .map((item) => [item.id, item]),
        ).values(),
      ];
      const searchResults = items
        .filter((item) => {
          if (isNumericSearch) {
            const tolerance = Math.max(1, Math.abs(numericSearch) * 0.1);
            return (
              includesSearch(item.displayName, searchTerm) ||
              includesSearch(item.fileName, searchTerm) ||
              includesSearch(item.description, searchTerm) ||
              Math.abs((item.amount ?? 0) - numericSearch) <= tolerance
            );
          }

          return (
            includesSearch(item.displayName, searchTerm) ||
            includesSearch(item.fileName, searchTerm) ||
            includesSearch(item.description, searchTerm)
          );
        })
        .sort((left, right) => {
          const dateComparison = compareNullableDates(
            right.date,
            left.date,
            "desc",
          );
          if (dateComparison !== 0) {
            return dateComparison;
          }

          return right.createdAt.localeCompare(left.createdAt);
        })
        .slice(0, limit);

      logger.info("SEARCH RESULTS:", {
        searchTerm,
        resultsCount: searchResults.length,
        results: searchResults.slice(0, 3).map((result) => ({
          id: result.id,
          displayName: result.displayName,
          amount: result.amount,
          currency: result.currency,
        })),
      });

      return searchResults;
    }

    if (transactionId) {
      const transaction = await getTransactionByIdFromConvex({
        teamId,
        transactionId,
      });

      if (transaction) {
        if (transaction.hasAttachment) {
          return [];
        }

        const unifiedTransactionAmount = Math.abs(transaction.amount || 0);
        const unifiedTransactionBaseAmount = Math.abs(
          transaction.baseAmount || 0,
        );
        const dateGte = shiftIsoDate(transaction.date, -123);
        const dateLte = shiftIsoDate(transaction.date, 30);
        const items = await getIndexedInboxSearchCandidates({
          teamId,
          searchTerms: [
            transaction.name,
            transaction.merchantName,
            transaction.counterpartyName,
          ],
          amount: transaction.amount,
          limit: Math.max(limit * 12, 120),
        });

        return items
          .filter((candidate) => candidate.date !== null)
          .filter(
            (candidate) =>
              candidate.date! >= dateGte && candidate.date! <= dateLte,
          )
          .filter((candidate) => {
            const nameScore = calculateUnifiedNameScore(
              candidate.displayName,
              transaction.name,
              transaction.merchantName || transaction.counterpartyName,
            );

            return (
              (candidate.currency === (transaction.currency || "") &&
                Math.abs(
                  Math.abs(candidate.amount ?? 0) - unifiedTransactionAmount,
                ) < Math.max(1, unifiedTransactionAmount * 0.25)) ||
              nameScore > 0.3 ||
              (candidate.baseCurrency === (transaction.baseCurrency || "") &&
                candidate.baseCurrency !== null &&
                Math.abs(
                  Math.abs(candidate.baseAmount ?? 0) -
                    unifiedTransactionBaseAmount,
                ) < Math.max(50, unifiedTransactionBaseAmount * 0.15))
            );
          })
          .map((candidate) => {
            const nameScore = calculateUnifiedNameScore(
              candidate.displayName,
              transaction.name,
              transaction.merchantName || transaction.counterpartyName,
            );
            const amountScore = calculateUnifiedAmountScore(
              candidate,
              transaction,
            );
            const currencyScore = calculateUnifiedCurrencyScore(
              candidate.currency || undefined,
              transaction.currency || undefined,
              candidate.baseCurrency || undefined,
              transaction.baseCurrency || undefined,
            );
            const dateScore = calculateUnifiedDateScore(
              candidate.date!,
              transaction.date,
              candidate.type,
            );
            const isExactAmount =
              candidate.amount !== null &&
              Math.abs(
                Math.abs(candidate.amount || 0) -
                  Math.abs(transaction.amount || 0),
              ) < 0.01;
            const isSameCurrency = candidate.currency === transaction.currency;

            return {
              ...candidate,
              nameScore,
              amountScore,
              currencyScore,
              dateScore,
              confidenceScore: scoreMatch({
                nameScore,
                amountScore,
                dateScore,
                currencyScore,
                isSameCurrency,
                isExactAmount,
              }),
            };
          })
          .filter((candidate) => candidate.confidenceScore >= 0.6)
          .sort((left, right) => right.confidenceScore - left.confidenceScore)
          .slice(0, limit);
      }
    }

    return getRecentInboxSearchItems(teamId, limit);
  } catch (error) {
    logger.error("Error in getInboxSearch:", { error });
    return [];
  }
}
