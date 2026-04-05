import {
  getTransactionAttachmentsForTransactionIdsFromConvex,
  getTransactionsByAmountRangeFromConvex,
  searchTransactionsFromConvex,
} from "../../../convex";
import { calculateNameScore } from "../../../utils/transaction-matching";
import {
  buildTransactionAttachmentLookups,
  compareTransactionsByDateDesc,
  getTransactionSearchText,
} from "../shared";
import {
  dedupeTransactionsById,
  roundMatchingScore,
  type SearchTransactionMatchResult,
} from "./common";

export async function searchTransactionMatchByQuery(params: {
  teamId: string;
  query: string;
  maxResults: number;
  includeAlreadyMatched: boolean;
}): Promise<SearchTransactionMatchResult[]> {
  const normalizedQuery = params.query.trim();

  if (!normalizedQuery) {
    return [];
  }

  const numericQuery = Number(normalizedQuery);
  const candidateLimit = Math.max(params.maxResults * 20, 100);
  const amountSearchValue = Math.round(Math.abs(numericQuery) * 100);
  const amountTolerance = Math.ceil(
    Math.max(1, Math.abs(numericQuery)) * 0.65 * 100,
  );
  const indexedCandidates = dedupeTransactionsById([
    ...(await searchTransactionsFromConvex({
      teamId: params.teamId,
      query: normalizedQuery,
      limit: candidateLimit,
    })),
    ...(!Number.isNaN(numericQuery)
      ? await getTransactionsByAmountRangeFromConvex({
          teamId: params.teamId,
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
    .slice(0, Math.max(params.maxResults * 3, 30));

  const { attachmentsByTransactionId } = buildTransactionAttachmentLookups(
    await getTransactionAttachmentsForTransactionIdsFromConvex({
      teamId: params.teamId,
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
        candidate.transaction.hasAttachment ||
        candidate.transaction.status === "completed";

      return {
        transaction_id: candidate.transaction.id,
        name: candidate.transaction.name,
        transaction_amount: candidate.transaction.amount,
        transaction_currency: candidate.transaction.currency,
        transaction_date: candidate.transaction.date,
        name_score: roundMatchingScore(candidate.nameScore),
        amount_score: roundMatchingScore(candidate.amountScore),
        currency_score: 0,
        date_score: 0,
        confidence_score: roundMatchingScore(candidate.confidence),
        is_already_matched: isAlreadyMatched,
        matched_attachment_filename:
          transactionAttachments[0]?.name ?? undefined,
      };
    })
    .filter((result) =>
      params.includeAlreadyMatched ? true : !result.is_already_matched,
    )
    .slice(0, params.maxResults);
}
