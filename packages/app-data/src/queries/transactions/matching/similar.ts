import {
  getTransactionByIdFromConvex,
  searchTransactionsFromConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../../../client";
import { calculateNameScore } from "../../../utils/transaction-matching";
import {
  EXACT_MERCHANT_SCORE,
  logger,
  MAX_CANDIDATES,
  MIN_SIMILARITY_THRESHOLD,
  dedupeTransactionsById,
  TRGM_CANDIDATE_THRESHOLD,
} from "./common";

type GetSimilarTransactionsParams = {
  name: string;
  teamId: string;
  categorySlug?: string;
  frequency?: "weekly" | "monthly" | "annually" | "irregular";
  transactionId?: string;
};

export async function getSimilarTransactions(_db: Database, params: GetSimilarTransactionsParams) {
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
    .filter((candidate) => (transactionId ? candidate.id !== transactionId : true))
    .filter((candidate) =>
      categorySlug
        ? candidate.categorySlug === null || candidate.categorySlug !== categorySlug
        : true,
    )
    .map((candidate) => {
      const score = Math.max(
        calculateNameScore(name, candidate.name, candidate.merchantName),
        sourceMerchantName
          ? calculateNameScore(sourceMerchantName, candidate.name, candidate.merchantName)
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
        sourceMerchantName.toLowerCase() === candidate.merchantName.toLowerCase()
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
        sourceMerchantName.toLowerCase() === candidate.merchantName.toLowerCase()
      ) {
        return { ...candidate, score: EXACT_MERCHANT_SCORE };
      }

      const scores: number[] = [calculateNameScore(name, candidate.name, candidate.merchantName)];

      if (sourceMerchantName) {
        scores.push(calculateNameScore(sourceMerchantName, candidate.name, candidate.merchantName));
      }

      return { ...candidate, score: Math.max(...scores) };
    })
    .filter((candidate) => candidate.score >= MIN_SIMILARITY_THRESHOLD)
    .sort((left, right) => right.score - left.score);

  logger.info("getSimilarTransactions completed", {
    name,
    teamId,
    sourceMerchantName,
    candidatesRetrieved: candidates.length,
    resultsAfterScoring: scored.length,
  });

  return scored.map(({ merchantName: _merchantName, score: _score, ...rest }) => rest);
}
