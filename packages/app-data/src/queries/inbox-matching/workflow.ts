import { createLoggerWithContext } from "@tamias/logger";
import type { Database } from "../../client";
import { getInboxItemByIdFromD1, requireInboxItemsD1 } from "../inbox/d1";
import { updateInbox } from "../inbox";
import { createMatchSuggestion, findMatches, type MatchResult } from "../transaction-matching";
import { matchTransaction } from "../inbox";

const logger = createLoggerWithContext("inbox-matching");

export function hasSuggestion(result: {
  action: "auto_matched" | "suggestion_created" | "no_match_yet";
  suggestion?: MatchResult;
}): result is {
  action: "auto_matched" | "suggestion_created";
  suggestion: MatchResult;
} {
  return result.action !== "no_match_yet" && result.suggestion !== undefined;
}

export type PersistInboxSuggestionCandidate = Pick<
  MatchResult,
  | "transactionId"
  | "confidenceScore"
  | "amountScore"
  | "currencyScore"
  | "dateScore"
  | "nameScore"
  | "matchType"
>;

export function resolveInboxSuggestionMatchType(
  matchType: PersistInboxSuggestionCandidate["matchType"],
  meta: Record<string, unknown> | null | undefined,
) {
  // Native receipts are human-reviewed captures: a good candidate is still a proposal.
  return meta?.source === "native" && matchType === "auto_matched" ? "high_confidence" : matchType;
}

export async function persistInboxSuggestionWorkflow(
  db: Database,
  params: {
    teamId: string;
    inboxId: string;
    candidate: PersistInboxSuggestionCandidate;
    source?: string;
  },
): Promise<{
  action: "auto_matched" | "suggestion_created";
  matchType: PersistInboxSuggestionCandidate["matchType"];
}> {
  const { teamId, inboxId, candidate, source } = params;
  const item = await getInboxItemByIdFromD1(requireInboxItemsD1(db), { teamId, inboxId });
  if (!item || item.status === "deleted" || item.transactionId) {
    throw new Error("Receipt is no longer available for transaction suggestions");
  }
  const matchType = resolveInboxSuggestionMatchType(candidate.matchType, item.meta);
  const shouldAutoMatch = matchType === "auto_matched";

  if (shouldAutoMatch) {
    await createMatchSuggestion(db, {
      teamId,
      inboxId,
      transactionId: candidate.transactionId,
      confidenceScore: candidate.confidenceScore,
      amountScore: candidate.amountScore,
      currencyScore: candidate.currencyScore,
      dateScore: candidate.dateScore,
      nameScore: candidate.nameScore,
      matchType: "auto_matched",
      status: "confirmed",
      matchDetails: {
        autoMatched: true,
        calculatedAt: new Date().toISOString(),
        ...(source ? { source } : {}),
        criteria: {
          confidence: candidate.confidenceScore,
          amount: candidate.amountScore,
          currency: candidate.currencyScore,
          date: candidate.dateScore,
        },
      },
    });

    await matchTransaction(db, {
      id: inboxId,
      transactionId: candidate.transactionId,
      teamId,
    });

    return { action: "auto_matched", matchType };
  }

  const suggestionRow = await createMatchSuggestion(db, {
    teamId,
    inboxId,
    transactionId: candidate.transactionId,
    confidenceScore: candidate.confidenceScore,
    amountScore: candidate.amountScore,
    currencyScore: candidate.currencyScore,
    dateScore: candidate.dateScore,
    nameScore: candidate.nameScore,
    matchType,
    status: "pending",
    matchDetails: {
      calculatedAt: new Date().toISOString(),
      ...(source ? { source } : {}),
      scores: {
        amount: candidate.amountScore,
        currency: candidate.currencyScore,
        date: candidate.dateScore,
        name: candidate.nameScore,
      },
    },
  });

  if (!suggestionRow) {
    logger.warn(
      "createMatchSuggestion no-op: existing row blocked upsert, resetting inbox to pending",
      { teamId, inboxId, transactionId: candidate.transactionId },
    );
    await updateInbox(db, {
      id: inboxId,
      teamId,
      status: "pending",
    });
    return { action: "suggestion_created", matchType };
  }

  await updateInbox(db, {
    id: inboxId,
    teamId,
    status: "suggested_match",
  });

  return { action: "suggestion_created", matchType };
}

export function shouldResetInboxToPendingAfterSuggestionFailure(
  state: {
    status: string | null;
    transactionId: string | null;
  } | null,
): boolean {
  return state?.status === "analyzing" && !state.transactionId;
}

export async function calculateInboxSuggestions(
  db: Database,
  params: {
    teamId: string;
    inboxId: string;
    excludeTransactionIds?: Set<string>;
  },
): Promise<{
  action: "auto_matched" | "suggestion_created" | "no_match_yet";
  suggestion?: MatchResult;
}> {
  const { teamId, inboxId, excludeTransactionIds } = params;

  try {
    const current = await getInboxItemByIdFromD1(requireInboxItemsD1(db), { teamId, inboxId });
    if (!current || current.status === "deleted" || current.transactionId)
      return { action: "no_match_yet" };
    await updateInbox(db, {
      id: inboxId,
      teamId,
      status: "analyzing",
    });

    const bestMatch = await findMatches(db, {
      teamId,
      inboxId,
      excludeTransactionIds,
    });

    if (!bestMatch) {
      await updateInbox(db, {
        id: inboxId,
        teamId,
        status: "pending",
      });

      return { action: "no_match_yet" };
    }

    const { action, matchType } = await persistInboxSuggestionWorkflow(db, {
      teamId,
      inboxId,
      candidate: bestMatch,
    });

    return {
      action,
      suggestion: { ...bestMatch, matchType },
    };
  } catch (error) {
    try {
      const currentInbox = await getInboxItemByIdFromD1(requireInboxItemsD1(db), {
        teamId,
        inboxId,
      });

      if (shouldResetInboxToPendingAfterSuggestionFailure(currentInbox ?? null)) {
        await updateInbox(db, {
          id: inboxId,
          teamId,
          status: "pending",
        });
      }
    } catch (rollbackError) {
      logger.error("Failed to reset inbox after suggestion calculation failure", {
        teamId,
        inboxId,
        error: rollbackError instanceof Error ? rollbackError.message : "Unknown error",
      });
    }

    throw error;
  }
}
