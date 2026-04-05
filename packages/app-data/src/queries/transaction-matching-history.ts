import type { Database } from "../client";
import { reuseQueryResult } from "../utils/request-cache";
import { getTeamSuggestions } from "./transaction-matching-calibration";
import type { TeamPairHistory, TeamPairHistoryMap } from "./transaction-matching-types";

const HISTORY_SUGGESTION_LIMIT = 2000;

export function normalizeNameForLearning(input: string | null | undefined): string {
  if (!input) return "";

  return input
    .toLowerCase()
    .replace(/[.,\-_'"()&]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractDomainToken(url: string | null | undefined): string {
  if (!url) return "";

  const cleaned = url
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];

  return cleaned?.split(".")[0]?.toLowerCase() ?? "";
}

async function loadTeamPairHistory(
  _db: Database,
  teamId: string,
): Promise<TeamPairHistoryMap> {
  const cutoff = new Date(
    Date.now() - 180 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const suggestions = await getTeamSuggestions(
    teamId,
    ["confirmed", "declined", "unmatched"],
    {
      createdAtFrom: cutoff,
      limit: HISTORY_SUGGESTION_LIMIT,
    },
  );
  const historyMap: TeamPairHistoryMap = new Map();

  for (const suggestion of suggestions) {
    if (
      !suggestion.normalizedInboxName ||
      !suggestion.normalizedTransactionName
    ) {
      continue;
    }

    const key = `${suggestion.normalizedInboxName}\0${suggestion.normalizedTransactionName}`;
    let entries = historyMap.get(key);

    if (!entries) {
      entries = [];
      historyMap.set(key, entries);
    }

    entries.push({
      status: suggestion.status,
      confidenceScore: suggestion.confidenceScore,
      createdAt: suggestion.createdAt,
    });
  }

  return historyMap;
}

const getTeamPairHistoryReused = reuseQueryResult({
  keyPrefix: "transaction-matching-pair-history",
  keyFn: (teamId: string) => teamId,
  load: loadTeamPairHistory,
});

export async function getTeamPairHistory(
  db: Database,
  teamId: string,
): Promise<TeamPairHistoryMap> {
  return getTeamPairHistoryReused(db, teamId);
}

function lookupPairHistory(
  historyMap: TeamPairHistory,
  normalizedInboxName: string,
  normalizedTransactionName: string,
  maxAgeDays?: number,
) {
  const key = `${normalizedInboxName}\0${normalizedTransactionName}`;
  const rows = historyMap.get(key) ?? [];

  if (maxAgeDays == null) {
    return rows;
  }

  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

  return rows.filter((row) => new Date(row.createdAt).getTime() > cutoff);
}

export function computeMerchantPatterns(
  historyMap: TeamPairHistory,
  normalizedInboxName: string,
  normalizedTransactionName: string,
): {
  canAutoMatch: boolean;
  confidence: number;
  historicalAccuracy: number;
  matchCount: number;
  reason: string;
} {
  if (!normalizedInboxName || !normalizedTransactionName) {
    return {
      canAutoMatch: false,
      confidence: 0,
      historicalAccuracy: 0,
      matchCount: 0,
      reason: "insufficient_name_context",
    };
  }

  const historicalMatches = lookupPairHistory(
    historyMap,
    normalizedInboxName,
    normalizedTransactionName,
  );

  if (historicalMatches.length < 3) {
    return {
      canAutoMatch: false,
      confidence: 0,
      historicalAccuracy: 0,
      matchCount: 0,
      reason: `insufficient_history_${historicalMatches.length}`,
    };
  }

  const confirmed = historicalMatches.filter((row) => row.status === "confirmed");
  const negative = historicalMatches.filter(
    (row) => row.status === "declined" || row.status === "unmatched",
  );
  const accuracy = confirmed.length / historicalMatches.length;
  const avgConfidence =
    confirmed.length > 0
      ? confirmed.reduce((sum, row) => sum + Number(row.confidenceScore), 0) /
        confirmed.length
      : 0;
  const canAutoMatch =
    confirmed.length >= 3 &&
    accuracy >= 0.9 &&
    negative.length <= 1 &&
    avgConfidence >= 0.85;

  return {
    canAutoMatch,
    confidence: avgConfidence,
    historicalAccuracy: accuracy,
    matchCount: confirmed.length,
    reason: canAutoMatch
      ? `eligible_${confirmed.length}_matches_${(accuracy * 100).toFixed(0)}pct_accuracy`
      : `ineligible_${confirmed.length}_matches_${(accuracy * 100).toFixed(0)}pct_accuracy_${negative.length}_negative`,
  };
}

export function computeAliasScore(
  historyMap: TeamPairHistory,
  normalizedInboxName: string,
  normalizedTransactionName: string,
): number {
  const historicalMatches = lookupPairHistory(
    historyMap,
    normalizedInboxName,
    normalizedTransactionName,
  );

  return historicalMatches.filter((row) => row.status === "confirmed").length >= 2
    ? 0.9
    : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function computeDeclinePenalty(
  historyMap: TeamPairHistory,
  normalizedInboxName: string,
  normalizedTransactionName: string,
): number {
  const historicalMatches = lookupPairHistory(
    historyMap,
    normalizedInboxName,
    normalizedTransactionName,
    90,
  );

  if (historicalMatches.length === 0) {
    return 0;
  }

  const now = Date.now();
  let declinedWeight = 0;
  let unmatchedWeight = 0;
  let confirmedWeight = 0;
  let recentConfirmedCount = 0;

  for (const row of historicalMatches) {
    const ageDays = Math.max(
      0,
      (now - new Date(row.createdAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    const decay = Math.exp(-ageDays / 45);

    if (row.status === "declined") declinedWeight += decay;
    if (row.status === "unmatched") unmatchedWeight += decay * 0.6;
    if (row.status === "confirmed") {
      confirmedWeight += decay;

      if (ageDays <= 45) {
        recentConfirmedCount++;
      }
    }
  }

  const negativeSignal = declinedWeight + unmatchedWeight;

  if (negativeSignal < 1.5) {
    return 0;
  }

  if (recentConfirmedCount >= 2 && confirmedWeight >= negativeSignal) {
    return 0;
  }

  const netSignal = Math.max(0, negativeSignal - confirmedWeight * 0.7);

  if (netSignal <= 0.3) {
    return 0;
  }

  return clamp(0.08 + netSignal * 0.08, 0, 0.35);
}
