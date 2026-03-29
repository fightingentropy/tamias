import { createLoggerWithContext } from "@tamias/logger";
import {
  getTransactionsByAmountRangeFromConvex,
  getInboxItemByIdFromConvex,
  getTransactionAttachmentsForTransactionIdsFromConvex,
  getTransactionByIdFromConvex,
  searchTransactionsFromConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../../client";
import {
  calculateAmountScore,
  calculateCurrencyScore,
  calculateDateScore,
  calculateNameScore,
  scoreMatch,
} from "../../utils/transaction-matching";
import {
  buildTransactionAttachmentLookups,
  compareTransactionsByDateDesc,
  getIsoDateDistanceInDays,
  getTransactionSearchText,
  shiftIsoDate,
} from "./shared";
import { getTransactionsPaged } from "../paged-records";

const logger = createLoggerWithContext("transactions");

const MIN_SIMILARITY_THRESHOLD = 0.6;
const TRGM_CANDIDATE_THRESHOLD = 0.3;
const EXACT_MERCHANT_SCORE = 0.95;
const MAX_CANDIDATES = 200;

function dedupeTransactionsById<T extends { id: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

type GetSimilarTransactionsParams = {
  name: string;
  teamId: string;
  categorySlug?: string;
  frequency?: "weekly" | "monthly" | "annually" | "irregular";
  transactionId?: string;
};

export async function getSimilarTransactions(
  _db: Database,
  params: GetSimilarTransactionsParams,
) {
  const { name, teamId, categorySlug, transactionId } = params;

  let sourceMerchantName: string | null = null;
  if (transactionId) {
    sourceMerchantName =
      (
        await getTransactionByIdFromConvex({
          teamId,
          transactionId,
        })
      )?.merchantName ?? null;
  }

  const searchTerms = [...new Set([name, sourceMerchantName].filter(Boolean))];
  const indexedCandidates = dedupeTransactionsById(
    (
      await Promise.all(
        searchTerms.map((searchTerm) =>
          searchTransactionsFromConvex({
            teamId,
            query: searchTerm!,
            limit: MAX_CANDIDATES * 4,
          }),
        ),
      )
    ).flat(),
  );
  const candidates = indexedCandidates
    .filter((candidate) =>
      transactionId ? candidate.id !== transactionId : true,
    )
    .filter((candidate) =>
      categorySlug
        ? candidate.categorySlug === null ||
          candidate.categorySlug !== categorySlug
        : true,
    )
    .map((candidate) => {
      const score = Math.max(
        calculateNameScore(name, candidate.name, candidate.merchantName),
        sourceMerchantName
          ? calculateNameScore(
              sourceMerchantName,
              candidate.name,
              candidate.merchantName,
            )
          : 0,
      );

      return {
        id: candidate.id,
        amount: candidate.amount,
        teamId: candidate.teamId,
        name: candidate.name,
        date: candidate.date,
        categorySlug: candidate.categorySlug,
        frequency: candidate.frequency,
        merchantName: candidate.merchantName,
        score,
      };
    })
    .filter((candidate) => {
      if (
        sourceMerchantName &&
        candidate.merchantName &&
        sourceMerchantName.toLowerCase() ===
          candidate.merchantName.toLowerCase()
      ) {
        return true;
      }

      return candidate.score > TRGM_CANDIDATE_THRESHOLD;
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_CANDIDATES);

  const scored = candidates
    .map((candidate) => {
      if (
        sourceMerchantName &&
        candidate.merchantName &&
        sourceMerchantName.toLowerCase() ===
          candidate.merchantName.toLowerCase()
      ) {
        return { ...candidate, score: EXACT_MERCHANT_SCORE };
      }

      const scores: number[] = [
        calculateNameScore(name, candidate.name, candidate.merchantName),
      ];

      if (sourceMerchantName) {
        scores.push(
          calculateNameScore(
            sourceMerchantName,
            candidate.name,
            candidate.merchantName,
          ),
        );
      }

      return { ...candidate, score: Math.max(...scores) };
    })
    .filter((r) => r.score >= MIN_SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  logger.info("getSimilarTransactions completed", {
    name,
    teamId,
    sourceMerchantName,
    candidatesRetrieved: candidates.length,
    resultsAfterScoring: scored.length,
  });

  return scored.map(({ merchantName: _m, score: _s, ...rest }) => rest);
}

type SearchTransactionMatchParams = {
  teamId: string;
  inboxId?: string;
  query?: string;
  maxResults?: number;
  minConfidenceScore?: number;
  includeAlreadyMatched?: boolean;
};

type SearchTransactionMatchResult = {
  transaction_id: string;
  name: string;
  transaction_amount: number;
  transaction_currency: string;
  transaction_date: string;
  name_score: number;
  amount_score: number;
  currency_score: number;
  date_score: number;
  confidence_score: number;
  is_already_matched: boolean;
  matched_attachment_filename?: string;
};

export async function searchTransactionMatch(
  db: Database,
  params: SearchTransactionMatchParams,
): Promise<SearchTransactionMatchResult[]> {
  const {
    teamId,
    query,
    inboxId,
    maxResults = 5,
    minConfidenceScore = 0.5,
    includeAlreadyMatched = false,
  } = params;

  if (query) {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return [];
    }

    const numericQuery = Number(normalizedQuery);
    const candidateLimit = Math.max(maxResults * 20, 100);
    const amountSearchValue = Math.round(Math.abs(numericQuery) * 100);
    const amountTolerance = Math.ceil(
      Math.max(1, Math.abs(numericQuery)) * 0.65 * 100,
    );
    const indexedCandidates = dedupeTransactionsById([
      ...(await searchTransactionsFromConvex({
        teamId,
        query: normalizedQuery,
        limit: candidateLimit,
      })),
      ...(!Number.isNaN(numericQuery)
        ? await getTransactionsByAmountRangeFromConvex({
            teamId,
            minAmount: Math.max(0, amountSearchValue - amountTolerance),
            maxAmount: amountSearchValue + amountTolerance,
            limit: candidateLimit,
          })
        : []),
    ]);
    const candidateTransactions = indexedCandidates
      .map((transaction) => {
        const nameScore = calculateNameScore(
          normalizedQuery,
          transaction.name,
          transaction.merchantName || transaction.counterpartyName,
        );
        const textScore = getTransactionSearchText(transaction).includes(
          normalizedQuery.toLowerCase(),
        )
          ? 0.85
          : 0;
        const amountDelta = Number.isNaN(numericQuery)
          ? null
          : Math.abs(Math.abs(transaction.amount) - Math.abs(numericQuery));
        const amountScore =
          amountDelta === null
            ? 0
            : amountDelta < 0.01
              ? 1
              : Math.max(
                  0,
                  1 - amountDelta / Math.max(1, Math.abs(numericQuery)),
                );
        const confidence = Math.max(nameScore, textScore, amountScore);

        return {
          transaction,
          nameScore,
          amountScore,
          confidence,
        };
      })
      .filter((candidate) => candidate.confidence >= 0.35)
      .sort((left, right) => {
        if (right.confidence !== left.confidence) {
          return right.confidence - left.confidence;
        }

        return compareTransactionsByDateDesc(
          left.transaction,
          right.transaction,
        );
      })
      .slice(0, Math.max(maxResults * 3, 30));

    const { attachmentsByTransactionId, transactionIdsWithAttachments } =
      buildTransactionAttachmentLookups(
        await getTransactionAttachmentsForTransactionIdsFromConvex({
          teamId,
          transactionIds: candidateTransactions.map(
            (candidate) => candidate.transaction.id,
          ),
        }),
      );

    return candidateTransactions
      .map((candidate) => {
        const transactionAttachments =
          attachmentsByTransactionId.get(candidate.transaction.id) ?? [];
        const isAlreadyMatched =
          transactionIdsWithAttachments.has(candidate.transaction.id) ||
          candidate.transaction.status === "completed";

        return {
          transaction_id: candidate.transaction.id,
          name: candidate.transaction.name,
          transaction_amount: candidate.transaction.amount,
          transaction_currency: candidate.transaction.currency,
          transaction_date: candidate.transaction.date,
          name_score: Math.round(candidate.nameScore * 1000) / 1000,
          amount_score: Math.round(candidate.amountScore * 1000) / 1000,
          currency_score: 0,
          date_score: 0,
          confidence_score: Math.round(candidate.confidence * 1000) / 1000,
          is_already_matched: isAlreadyMatched,
          matched_attachment_filename:
            transactionAttachments[0]?.name ?? undefined,
        };
      })
      .filter((result) =>
        includeAlreadyMatched ? true : !result.is_already_matched,
      )
      .slice(0, maxResults);
  }

  if (inboxId) {
    try {
      const item = await getInboxItemByIdFromConvex({
        teamId,
        inboxId,
      });

      if (!item || !item.date) {
        return [];
      }

      const inboxAmount = Math.abs(item.amount || 0);
      const inboxBaseAmount = Math.abs(item.baseAmount || 0);
      const inboxDate = item.date;
      const candidateTransactions = (
        await getTransactionsPaged({
          teamId,
          dateGte: shiftIsoDate(inboxDate, -90),
          dateLte: shiftIsoDate(inboxDate, 30),
          statusesNotIn: [
            "pending",
            "excluded",
            "completed",
            "archived",
            "exported",
          ],
        })
      )
        .filter((transaction) => {
          const nameScore = calculateNameScore(
            item.displayName,
            transaction.name,
            transaction.merchantName,
          );

          return (
            (transaction.currency === (item.currency ?? "") &&
              Math.abs(Math.abs(transaction.amount) - inboxAmount) <
                Math.max(1, inboxAmount * 0.25)) ||
            nameScore > 0.3 ||
            (Boolean(transaction.baseCurrency) &&
              (item.baseCurrency ?? "") !== "" &&
              transaction.baseCurrency === item.baseCurrency &&
              Math.abs(
                Math.abs(transaction.baseAmount ?? 0) - inboxBaseAmount,
              ) < Math.max(50, inboxBaseAmount * 0.15))
          );
        })
        .sort((left, right) => {
          const leftNameScore = calculateNameScore(
            item.displayName,
            left.name,
            left.merchantName,
          );
          const rightNameScore = calculateNameScore(
            item.displayName,
            right.name,
            right.merchantName,
          );

          if (rightNameScore !== leftNameScore) {
            return rightNameScore - leftNameScore;
          }

          const leftAmountRatio =
            Math.abs(Math.abs(left.amount) - inboxAmount) /
            Math.max(1, inboxAmount);
          const rightAmountRatio =
            Math.abs(Math.abs(right.amount) - inboxAmount) /
            Math.max(1, inboxAmount);

          if (leftAmountRatio !== rightAmountRatio) {
            return leftAmountRatio - rightAmountRatio;
          }

          return (
            getIsoDateDistanceInDays(left.date, inboxDate) -
            getIsoDateDistanceInDays(right.date, inboxDate)
          );
        })
        .slice(0, Math.max(maxResults * 3, 30))
        .map((transaction) => ({
          transactionId: transaction.id,
          name: transaction.name,
          transactionAmount: transaction.amount,
          transactionCurrency: transaction.currency,
          transactionDate: transaction.date,
          baseAmount: transaction.baseAmount,
          baseCurrency: transaction.baseCurrency,
          status: transaction.status,
          merchantName: transaction.merchantName,
        }));

      const { attachmentsByTransactionId, transactionIdsWithAttachments } =
        buildTransactionAttachmentLookups(
          await getTransactionAttachmentsForTransactionIdsFromConvex({
            teamId,
            transactionIds: candidateTransactions.map(
              (transaction) => transaction.transactionId,
            ),
          }),
        );

      const scoredResults = candidateTransactions
        .map((transaction) => {
          const nameScore = calculateNameScore(
            item.displayName,
            transaction.name,
            transaction.merchantName,
          );
          const amountScore = calculateAmountScore(
            {
              amount: item.amount,
              currency: item.currency,
              baseAmount: item.baseAmount,
              baseCurrency: item.baseCurrency,
            },
            {
              amount: transaction.transactionAmount,
              currency: transaction.transactionCurrency,
              baseAmount: transaction.baseAmount,
              baseCurrency: transaction.baseCurrency,
            },
          );
          const currencyScore = calculateCurrencyScore(
            item.currency || undefined,
            transaction.transactionCurrency || undefined,
            item.baseCurrency || undefined,
            transaction.baseCurrency || undefined,
          );
          const dateScore = calculateDateScore(
            item.date!,
            transaction.transactionDate,
          );
          const isExactAmount =
            item.amount !== null &&
            Math.abs(
              Math.abs(item.amount || 0) -
                Math.abs(transaction.transactionAmount || 0),
            ) < 0.01;
          const isSameCurrency =
            item.currency === transaction.transactionCurrency;
          const confidence = scoreMatch({
            nameScore,
            amountScore,
            dateScore,
            currencyScore,
            isSameCurrency,
            isExactAmount,
          });
          const transactionAttachments =
            attachmentsByTransactionId.get(transaction.transactionId) ?? [];
          const isAlreadyMatched =
            transactionIdsWithAttachments.has(transaction.transactionId) ||
            transaction.status === "completed";

          return {
            transaction_id: transaction.transactionId,
            name: transaction.name,
            transaction_amount: transaction.transactionAmount,
            transaction_currency: transaction.transactionCurrency,
            transaction_date: transaction.transactionDate,
            name_score: Math.round(nameScore * 1000) / 1000,
            amount_score: Math.round(amountScore * 1000) / 1000,
            currency_score: Math.round(currencyScore * 1000) / 1000,
            date_score: Math.round(dateScore * 1000) / 1000,
            confidence_score: Math.round(confidence * 1000) / 1000,
            is_already_matched: isAlreadyMatched,
            matched_attachment_filename:
              transactionAttachments[0]?.name ?? undefined,
          };
        })
        .filter((result) => result.confidence_score >= minConfidenceScore)
        .filter((result) =>
          includeAlreadyMatched ? true : !result.is_already_matched,
        )
        .sort((a, b) => {
          if (a.confidence_score !== b.confidence_score) {
            return b.confidence_score - a.confidence_score;
          }

          if (a.is_already_matched !== b.is_already_matched) {
            return a.is_already_matched ? 1 : -1;
          }

          return 0;
        })
        .slice(0, maxResults);

      return scoredResults;
    } catch {
      return [];
    }
  }

  return [];
}
