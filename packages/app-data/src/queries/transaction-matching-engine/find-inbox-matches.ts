import { getTransactionByIdFromConvex } from "../../convex";
import type { Database } from "../../client";
import {
  calculateAmountScore,
  calculateCurrencyScore,
  calculateDateScore,
  calculateNameScore,
  scoreMatch,
} from "../../utils/transaction-matching";
import {
  computeAliasScore,
  computeDeclinePenalty,
  computeMerchantPatterns,
  extractDomainToken,
  getTeamPairHistory,
  normalizeNameForLearning,
} from "../transaction-matching-history";
import type {
  FindInboxMatchesParams,
  InboxMatchResult,
} from "../transaction-matching-types";
import {
  getIsoDateDistanceInDays,
  shiftIsoDate,
} from "../transactions/shared";
import { getIndexedInboxMatchCandidates } from "./inbox-candidates";
import {
  getDismissedInboxIds,
  getMatchThresholds,
  logger,
  resolveMatchType,
  roundMatchMetric,
} from "./shared";

type TransactionItem = NonNullable<
  Awaited<ReturnType<typeof getTransactionByIdFromConvex>>
>;

type InboxCandidateRecord =
  | Awaited<ReturnType<typeof getIndexedInboxMatchCandidates>>[number]
  | NonNullable<FindInboxMatchesParams["candidateInboxItems"]>[number];

type InboxCandidate = {
  inboxId: string;
  displayName: string | null;
  amount: number | null;
  currency: string | null;
  baseAmount: number | null;
  baseCurrency: string | null;
  date: string | null;
  type: string | null;
  website: string | null;
  invoiceNumber: string | null;
};

function isRelevantInboxCandidate(
  transactionItem: TransactionItem,
  candidate: InboxCandidateRecord,
) {
  const transactionAmount = Math.abs(transactionItem.amount || 0);
  const transactionBaseAmount = Math.abs(transactionItem.baseAmount || 0);
  const lowerBound = shiftIsoDate(
    transactionItem.date,
    candidate.type === "invoice" ? -123 : -90,
  );
  const upperBound = shiftIsoDate(transactionItem.date, 30);

  if (
    !candidate.date ||
    candidate.date < lowerBound ||
    candidate.date > upperBound
  ) {
    return false;
  }

  const nameScore = calculateNameScore(
    candidate.displayName,
    transactionItem.name,
    transactionItem.merchantName,
  );

  return (
    (candidate.currency === (transactionItem.currency || "") &&
      Math.abs(Math.abs(candidate.amount ?? 0) - transactionAmount) <
        Math.max(1, transactionAmount * 0.25)) ||
    nameScore > 0.3 ||
    (candidate.baseCurrency === (transactionItem.baseCurrency || "") &&
      candidate.baseCurrency !== null &&
      Math.abs(Math.abs(candidate.baseAmount ?? 0) - transactionBaseAmount) <
        Math.max(50, transactionBaseAmount * 0.15))
  );
}

function compareInboxCandidates(
  transactionItem: TransactionItem,
  left: InboxCandidateRecord,
  right: InboxCandidateRecord,
) {
  const transactionAmount = Math.abs(transactionItem.amount || 0);
  const leftNameScore = calculateNameScore(
    left.displayName,
    transactionItem.name,
    transactionItem.merchantName,
  );
  const rightNameScore = calculateNameScore(
    right.displayName,
    transactionItem.name,
    transactionItem.merchantName,
  );

  if (rightNameScore !== leftNameScore) {
    return rightNameScore - leftNameScore;
  }

  const leftAmountRatio =
    Math.abs(Math.abs(left.amount ?? 0) - transactionAmount) /
    Math.max(1, transactionAmount);
  const rightAmountRatio =
    Math.abs(Math.abs(right.amount ?? 0) - transactionAmount) /
    Math.max(1, transactionAmount);

  if (leftAmountRatio !== rightAmountRatio) {
    return leftAmountRatio - rightAmountRatio;
  }

  return (
    getIsoDateDistanceInDays(left.date!, transactionItem.date) -
    getIsoDateDistanceInDays(right.date!, transactionItem.date)
  );
}

function toInboxCandidate(candidate: InboxCandidateRecord): InboxCandidate {
  return {
    inboxId: candidate.id,
    displayName: candidate.displayName,
    amount: candidate.amount,
    currency: candidate.currency,
    baseAmount: candidate.baseAmount,
    baseCurrency: candidate.baseCurrency,
    date: candidate.date,
    type: candidate.type,
    website: candidate.website,
    invoiceNumber: candidate.invoiceNumber,
  };
}

function boostInboxNameScore(args: {
  transactionItem: TransactionItem;
  candidate: InboxCandidate;
  nameScore: number;
}) {
  let nextNameScore = args.nameScore;
  const searchableText = normalizeNameForLearning(
    `${args.transactionItem.name} ${args.transactionItem.merchantName || ""} ${args.transactionItem.description || ""} ${args.transactionItem.counterpartyName || ""}`,
  );
  const invoiceNumber = normalizeNameForLearning(args.candidate.invoiceNumber);

  if (invoiceNumber.length >= 4 && searchableText.includes(invoiceNumber)) {
    nextNameScore = Math.max(nextNameScore, 0.95);
  }

  const domainToken = extractDomainToken(args.candidate.website);

  if (domainToken.length >= 4 && searchableText.includes(domainToken)) {
    nextNameScore = Math.max(nextNameScore, 0.88);
  }

  return nextNameScore;
}

export async function findInboxMatches(
  db: Database,
  params: FindInboxMatchesParams & { excludeInboxIds?: Set<string> },
): Promise<InboxMatchResult | null> {
  const { teamId, transactionId, excludeInboxIds, candidateInboxItems } = params;
  const { suggestedThreshold, autoThreshold } = await getMatchThresholds(
    db,
    teamId,
  );
  const transactionItem = await getTransactionByIdFromConvex({
    teamId,
    transactionId,
  });

  if (!transactionItem?.date) {
    return null;
  }

  const normalizedTransactionName = normalizeNameForLearning(
    transactionItem.merchantName || transactionItem.name,
  );
  const inboxItems: InboxCandidateRecord[] =
    candidateInboxItems ??
    (await getIndexedInboxMatchCandidates({
      teamId,
      amount: transactionItem.amount,
      searchTerms: [
        transactionItem.name,
        transactionItem.merchantName,
        transactionItem.counterpartyName,
      ],
      limit: 120,
    }));
  const candidates = inboxItems
    .filter((candidate) => candidate.transactionId == null)
    .filter(
      (candidate) =>
        candidate.status === "pending" || candidate.status === "no_match",
    )
    .filter((candidate) => candidate.date !== null)
    .filter((candidate) =>
      excludeInboxIds ? !excludeInboxIds.has(candidate.id) : true,
    )
    .filter((candidate) => isRelevantInboxCandidate(transactionItem, candidate))
    .sort((left, right) => compareInboxCandidates(transactionItem, left, right))
    .slice(0, 30)
    .map((candidate) => toInboxCandidate(candidate));
  const teamPairHistory = await getTeamPairHistory(db, teamId);
  const scoredCandidates: InboxMatchResult[] = [];

  for (const candidate of candidates) {
    const normalizedInboxName = normalizeNameForLearning(candidate.displayName);
    const aliasScore = computeAliasScore(
      teamPairHistory,
      normalizedInboxName,
      normalizedTransactionName,
    );
    const declinePenalty = computeDeclinePenalty(
      teamPairHistory,
      normalizedInboxName,
      normalizedTransactionName,
    );
    const pattern = computeMerchantPatterns(
      teamPairHistory,
      normalizedInboxName,
      normalizedTransactionName,
    );

    const nameScore = boostInboxNameScore({
      transactionItem,
      candidate,
      nameScore: calculateNameScore(
        candidate.displayName,
        transactionItem.name,
        transactionItem.merchantName || transactionItem.counterpartyName,
        aliasScore,
      ),
    });
    const amountScore = calculateAmountScore(candidate, transactionItem);
    const currencyScore = calculateCurrencyScore(
      candidate.currency || undefined,
      transactionItem.currency || undefined,
      candidate.baseCurrency || undefined,
      transactionItem.baseCurrency || undefined,
    );
    const dateScore = calculateDateScore(
      candidate.date || transactionItem.date,
      transactionItem.date,
      candidate.type,
    );
    const isExactAmount =
      candidate.amount !== null &&
      Math.abs(
        Math.abs(candidate.amount || 0) - Math.abs(transactionItem.amount || 0),
      ) < 0.01;
    const isSameCurrency = candidate.currency === transactionItem.currency;
    const confidence = scoreMatch({
      nameScore,
      amountScore,
      dateScore,
      currencyScore,
      isSameCurrency,
      isExactAmount,
      declinePenalty,
    });

    if (confidence < suggestedThreshold) {
      continue;
    }

    scoredCandidates.push({
      inboxId: candidate.inboxId,
      displayName: candidate.displayName,
      amount: candidate.amount,
      currency: candidate.currency,
      date: candidate.date || transactionItem.date,
      nameScore: roundMatchMetric(nameScore),
      amountScore: roundMatchMetric(amountScore),
      currencyScore: roundMatchMetric(currencyScore),
      dateScore: roundMatchMetric(dateScore),
      confidenceScore: roundMatchMetric(confidence),
      matchType: resolveMatchType(
        confidence,
        pattern.canAutoMatch,
        nameScore,
        autoThreshold,
      ),
      isAlreadyMatched: false,
    });
  }

  scoredCandidates.sort(
    (left, right) => right.confidenceScore - left.confidenceScore,
  );

  const dismissedInboxIds = await getDismissedInboxIds({
    teamId,
    transactionId,
    inboxIds: scoredCandidates.map((candidate) => candidate.inboxId),
  });

  for (const candidate of scoredCandidates) {
    if (dismissedInboxIds.has(candidate.inboxId)) {
      logger.info("Skipping dismissed reverse match candidate, trying next", {
        teamId,
        transactionId,
        inboxId: candidate.inboxId,
      });
      continue;
    }

    return candidate;
  }

  return null;
}
