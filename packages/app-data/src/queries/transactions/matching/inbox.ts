import {
  getInboxItemByIdFromConvex,
  getTransactionAttachmentsForTransactionIdsFromConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../../../client";
import {
  calculateAmountScore,
  calculateCurrencyScore,
  calculateDateScore,
  calculateNameScore,
  scoreMatch,
} from "../../../utils/transaction-matching";
import {
  buildTransactionAttachmentLookups,
  getIndexedTransactionMatchCandidates,
  getIsoDateDistanceInDays,
  MATCHING_EXCLUDED_TRANSACTION_STATUSES,
  shiftIsoDate,
} from "../shared";
import {
  roundMatchingScore,
  type SearchTransactionMatchResult,
} from "./common";

export async function searchTransactionMatchByInbox(
  db: Database,
  params: {
    teamId: string;
    inboxId: string;
    maxResults: number;
    minConfidenceScore: number;
    includeAlreadyMatched: boolean;
  },
): Promise<SearchTransactionMatchResult[]> {
  try {
    const item = await getInboxItemByIdFromConvex({
      teamId: params.teamId,
      inboxId: params.inboxId,
    });

    if (!item?.date) {
      return [];
    }

    const inboxAmount = Math.abs(item.amount || 0);
    const inboxBaseAmount = Math.abs(item.baseAmount || 0);
    const inboxDate = item.date;
    const candidateTransactions = (
      await getIndexedTransactionMatchCandidates({
        teamId: params.teamId,
        searchTerms: [
          item.displayName,
          item.fileName,
          item.invoiceNumber,
          item.website,
          item.senderEmail,
        ],
        amount: item.amount,
        dateGte: shiftIsoDate(inboxDate, -90),
        dateLte: shiftIsoDate(inboxDate, 30),
        statusesNotIn: MATCHING_EXCLUDED_TRANSACTION_STATUSES,
        limit: Math.max(params.maxResults * 12, 120),
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
      .slice(0, Math.max(params.maxResults * 3, 30))
      .map((transaction) => ({
        transactionId: transaction.id,
        name: transaction.name,
        transactionAmount: transaction.amount,
        transactionCurrency: transaction.currency,
        transactionDate: transaction.date,
        baseAmount: transaction.baseAmount,
        baseCurrency: transaction.baseCurrency,
        status: transaction.status,
        hasAttachment: transaction.hasAttachment,
        merchantName: transaction.merchantName,
      }));

    const { attachmentsByTransactionId } = buildTransactionAttachmentLookups(
      await getTransactionAttachmentsForTransactionIdsFromConvex({
        teamId: params.teamId,
        transactionIds: candidateTransactions.map(
          (transaction) => transaction.transactionId,
        ),
      }),
    );

    return candidateTransactions
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
          transaction.hasAttachment || transaction.status === "completed";

        return {
          transaction_id: transaction.transactionId,
          name: transaction.name,
          transaction_amount: transaction.transactionAmount,
          transaction_currency: transaction.transactionCurrency,
          transaction_date: transaction.transactionDate,
          name_score: roundMatchingScore(nameScore),
          amount_score: roundMatchingScore(amountScore),
          currency_score: roundMatchingScore(currencyScore),
          date_score: roundMatchingScore(dateScore),
          confidence_score: roundMatchingScore(confidence),
          is_already_matched: isAlreadyMatched,
          matched_attachment_filename:
            transactionAttachments[0]?.name ?? undefined,
        };
      })
      .filter((result) => result.confidence_score >= params.minConfidenceScore)
      .filter((result) =>
        params.includeAlreadyMatched ? true : !result.is_already_matched,
      )
      .sort((left, right) => {
        if (left.confidence_score !== right.confidence_score) {
          return right.confidence_score - left.confidence_score;
        }

        if (left.is_already_matched !== right.is_already_matched) {
          return left.is_already_matched ? 1 : -1;
        }

        return 0;
      })
      .slice(0, params.maxResults);
  } catch {
    void db;
    return [];
  }
}
