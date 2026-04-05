import { getTransactionMatchSuggestionsFromConvex } from "../../convex";
import { createLoggerWithContext } from "@tamias/logger";
import type { Database } from "../../client";
import type { MatchType } from "../../utils/transaction-matching";
import { getTeamCalibration } from "../transaction-matching-calibration";

export const logger = createLoggerWithContext("matching");

const AUTO_MATCH_ENABLED = process.env.MATCH_AUTO_ENABLED === "true";

export async function getMatchThresholds(db: Database, teamId: string) {
  const calibration = await getTeamCalibration(db, teamId);

  return {
    suggestedThreshold: Math.max(
      0.6,
      calibration.calibratedSuggestedThreshold,
    ),
    autoThreshold: calibration.calibratedAutoThreshold,
  };
}

export function roundMatchMetric(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function resolveMatchType(
  confidence: number,
  canAutoMatch: boolean,
  nameScore: number,
  autoThreshold: number,
): MatchType {
  if (
    AUTO_MATCH_ENABLED &&
    confidence >= autoThreshold &&
    canAutoMatch &&
    nameScore >= 0.4
  ) {
    return "auto_matched";
  }

  if (confidence >= 0.72) {
    return "high_confidence";
  }

  return "suggested";
}

export async function getDismissedTransactionIds(args: {
  teamId: string;
  inboxId: string;
  transactionIds: string[];
}): Promise<Set<string>> {
  if (args.transactionIds.length === 0) {
    return new Set();
  }

  const dismissed = (
    await getTransactionMatchSuggestionsFromConvex({
      teamId: args.teamId,
      inboxId: args.inboxId,
      statuses: ["declined", "unmatched"],
    })
  ).filter((suggestion) =>
    args.transactionIds.includes(suggestion.transactionId),
  );

  return new Set(dismissed.map((suggestion) => suggestion.transactionId));
}

export async function getDismissedInboxIds(args: {
  teamId: string;
  transactionId: string;
  inboxIds: string[];
}): Promise<Set<string>> {
  if (args.inboxIds.length === 0) {
    return new Set();
  }

  const dismissed = (
    await getTransactionMatchSuggestionsFromConvex({
      teamId: args.teamId,
      transactionId: args.transactionId,
      statuses: ["declined", "unmatched"],
    })
  ).filter((suggestion) => args.inboxIds.includes(suggestion.inboxId));

  return new Set(dismissed.map((suggestion) => suggestion.inboxId));
}
