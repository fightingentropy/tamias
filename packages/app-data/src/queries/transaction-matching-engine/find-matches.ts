import {
  getInboxItemByIdFromConvex,
  getTransactionMatchSuggestionsFromConvex,
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
  computeAliasScore,
  computeDeclinePenalty,
  computeMerchantPatterns,
  extractDomainToken,
  getTeamPairHistory,
  normalizeNameForLearning,
} from "../transaction-matching-history";
import type { FindMatchesParams, MatchResult } from "../transaction-matching-types";
import {
  getIndexedTransactionMatchCandidates,
  getIsoDateDistanceInDays,
  MATCHING_EXCLUDED_TRANSACTION_STATUSES,
  shiftIsoDate,
} from "../transactions/shared";
import {
  getDismissedTransactionIds,
  getMatchThresholds,
  logger,
  resolveMatchType,
  roundMatchMetric,
} from "./shared";

type InboxItem = NonNullable<Awaited<ReturnType<typeof getInboxItemByIdFromConvex>>>;

type IndexedTransactionCandidate = Awaited<
  ReturnType<typeof getIndexedTransactionMatchCandidates>
>[number];

type MatchCandidate = {
  transactionId: string;
  name: string;
  amount: number;
  currency: string;
  baseAmount: number | null;
  baseCurrency: string | null;
  date: string;
  merchantName: string | null;
  description: string | null;
  counterpartyName: string | null;
};

function isRelevantTransactionCandidate(
  inboxItem: InboxItem,
  transaction: IndexedTransactionCandidate,
) {
  const inboxAmount = Math.abs(inboxItem.amount || 0);
  const inboxBaseAmount = Math.abs(inboxItem.baseAmount || 0);
  const nameScore = calculateNameScore(
    inboxItem.displayName,
    transaction.name,
    transaction.merchantName,
  );

  return (
    (transaction.currency === (inboxItem.currency || "") &&
      Math.abs(Math.abs(transaction.amount) - inboxAmount) < Math.max(1, inboxAmount * 0.25)) ||
    nameScore > 0.3 ||
    (transaction.baseCurrency === (inboxItem.baseCurrency || "") &&
      transaction.baseCurrency !== null &&
      Math.abs(Math.abs(transaction.baseAmount ?? 0) - inboxBaseAmount) <
        Math.max(50, inboxBaseAmount * 0.15))
  );
}

function compareTransactionCandidates(
  inboxItem: InboxItem,
  left: IndexedTransactionCandidate,
  right: IndexedTransactionCandidate,
) {
  const inboxAmount = Math.abs(inboxItem.amount || 0);
  const leftNameScore = calculateNameScore(inboxItem.displayName, left.name, left.merchantName);
  const rightNameScore = calculateNameScore(inboxItem.displayName, right.name, right.merchantName);

  if (rightNameScore !== leftNameScore) {
    return rightNameScore - leftNameScore;
  }

  const leftAmountRatio = Math.abs(Math.abs(left.amount) - inboxAmount) / Math.max(1, inboxAmount);
  const rightAmountRatio =
    Math.abs(Math.abs(right.amount) - inboxAmount) / Math.max(1, inboxAmount);

  if (leftAmountRatio !== rightAmountRatio) {
    return leftAmountRatio - rightAmountRatio;
  }

  return (
    getIsoDateDistanceInDays(left.date!, inboxItem.date!) -
    getIsoDateDistanceInDays(right.date!, inboxItem.date!)
  );
}

function toMatchCandidate(transaction: IndexedTransactionCandidate): MatchCandidate {
  return {
    transactionId: transaction.id,
    name: transaction.name,
    amount: transaction.amount,
    currency: transaction.currency,
    baseAmount: transaction.baseAmount,
    baseCurrency: transaction.baseCurrency,
    date: transaction.date,
    merchantName: transaction.merchantName,
    description: transaction.description,
    counterpartyName: transaction.counterpartyName,
  };
}

function boostTransactionNameScore(args: {
  inboxItem: InboxItem;
  candidate: MatchCandidate;
  nameScore: number;
}) {
  let nextNameScore = args.nameScore;
  const searchableText = normalizeNameForLearning(
    `${args.candidate.name} ${args.candidate.merchantName || ""} ${args.candidate.description || ""} ${args.candidate.counterpartyName || ""}`,
  );
  const invoiceNumber = normalizeNameForLearning(args.inboxItem.invoiceNumber);

  if (invoiceNumber.length >= 4 && searchableText.includes(invoiceNumber)) {
    nextNameScore = Math.max(nextNameScore, 0.95);
  }

  const domainToken = extractDomainToken(args.inboxItem.website);

  if (domainToken.length >= 4 && searchableText.includes(domainToken)) {
    nextNameScore = Math.max(nextNameScore, 0.88);
  }

  return nextNameScore;
}

export async function findMatches(
  db: Database,
  params: FindMatchesParams & { excludeTransactionIds?: Set<string> },
): Promise<MatchResult | null> {
  const { teamId, inboxId, excludeTransactionIds } = params;
  const { suggestedThreshold, autoThreshold } = await getMatchThresholds(db, teamId);
  const inboxItem = await getInboxItemByIdFromConvex({
    teamId,
    inboxId,
  });

  if (!inboxItem?.date) {
    return null;
  }

  const normalizedInboxName = normalizeNameForLearning(inboxItem.displayName);
  const candidateDateLowerBound = shiftIsoDate(inboxItem.date, -90);
  const candidateDateUpperBound = shiftIsoDate(
    inboxItem.date,
    inboxItem.type === "invoice" ? 123 : 30,
  );
  const candidateTransactionRows = (
    await getIndexedTransactionMatchCandidates({
      teamId,
      searchTerms: [
        inboxItem.displayName,
        inboxItem.fileName,
        inboxItem.invoiceNumber,
        inboxItem.website,
        inboxItem.senderEmail,
      ],
      amount: inboxItem.amount,
      dateGte: candidateDateLowerBound,
      dateLte: candidateDateUpperBound,
      statusesNotIn: MATCHING_EXCLUDED_TRANSACTION_STATUSES,
      limit: 180,
    })
  )
    .filter((transaction) =>
      excludeTransactionIds ? !excludeTransactionIds.has(transaction.id) : true,
    )
    .filter((transaction) => isRelevantTransactionCandidate(inboxItem, transaction))
    .sort((left, right) => compareTransactionCandidates(inboxItem, left, right))
    .slice(0, 90);
  const pendingSuggestionRows = await getTransactionMatchSuggestionsFromConvex({
    teamId,
    transactionIds: candidateTransactionRows.map((transaction) => transaction.id),
    statuses: ["pending"],
  });
  const pendingSuggestionIdSet = new Set(pendingSuggestionRows.map((row) => row.transactionId));
  const candidates = candidateTransactionRows
    .filter((transaction) => !transaction.hasAttachment)
    .filter((transaction) => !pendingSuggestionIdSet.has(transaction.id))
    .slice(0, 30)
    .map((transaction) => toMatchCandidate(transaction));
  const teamPairHistory = await getTeamPairHistory(db, teamId);
  const scoredCandidates: MatchResult[] = [];

  for (const candidate of candidates) {
    const normalizedTransactionName = normalizeNameForLearning(
      candidate.merchantName || candidate.name,
    );
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

    const nameScore = boostTransactionNameScore({
      inboxItem,
      candidate,
      nameScore: calculateNameScore(
        inboxItem.displayName,
        candidate.name,
        candidate.merchantName || candidate.counterpartyName,
        aliasScore,
      ),
    });
    const amountScore = calculateAmountScore(inboxItem, candidate);
    const currencyScore = calculateCurrencyScore(
      inboxItem.currency || undefined,
      candidate.currency || undefined,
      inboxItem.baseCurrency || undefined,
      candidate.baseCurrency || undefined,
    );
    const dateScore = calculateDateScore(inboxItem.date, candidate.date, inboxItem.type);
    const isExactAmount =
      inboxItem.amount !== null &&
      Math.abs(Math.abs(inboxItem.amount || 0) - Math.abs(candidate.amount || 0)) < 0.01;
    const isSameCurrency = inboxItem.currency === candidate.currency;
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
      transactionId: candidate.transactionId,
      name: candidate.name,
      amount: candidate.amount,
      currency: candidate.currency,
      date: candidate.date,
      nameScore: roundMatchMetric(nameScore),
      amountScore: roundMatchMetric(amountScore),
      currencyScore: roundMatchMetric(currencyScore),
      dateScore: roundMatchMetric(dateScore),
      confidenceScore: roundMatchMetric(confidence),
      matchType: resolveMatchType(confidence, pattern.canAutoMatch, nameScore, autoThreshold),
      isAlreadyMatched: false,
    });
  }

  scoredCandidates.sort((left, right) => right.confidenceScore - left.confidenceScore);

  const dismissedTransactionIds = await getDismissedTransactionIds({
    teamId,
    inboxId,
    transactionIds: scoredCandidates.map((candidate) => candidate.transactionId),
  });

  for (const candidate of scoredCandidates) {
    if (dismissedTransactionIds.has(candidate.transactionId)) {
      logger.info("Skipping dismissed match candidate, trying next", {
        teamId,
        inboxId,
        transactionId: candidate.transactionId,
      });
      continue;
    }

    return candidate;
  }

  return null;
}
