import { createLoggerWithContext } from "@tamias/logger";
import {
  getInboxItemByIdFromConvex,
  getInboxItemsPageFromConvex,
  getTransactionMatchSuggestionsFromConvex,
  type CurrentUserIdentityRecord,
  upsertTransactionMatchSuggestionsInConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../client";
import { createActivity } from "./activities";
import { matchTransaction, updateInbox } from "./inbox";
import {
  createMatchSuggestion,
  findMatches,
  type MatchResult,
} from "./transaction-matching";

const logger = createLoggerWithContext("inbox-matching");
type ConvexUserId = CurrentUserIdentityRecord["convexId"];

export function hasSuggestion(result: {
  action: "auto_matched" | "suggestion_created" | "no_match_yet";
  suggestion?: MatchResult;
}): result is {
  action: "auto_matched" | "suggestion_created";
  suggestion: MatchResult;
} {
  return result.action !== "no_match_yet" && result.suggestion !== undefined;
}

type PersistInboxSuggestionCandidate = Pick<
  MatchResult,
  | "transactionId"
  | "confidenceScore"
  | "amountScore"
  | "currencyScore"
  | "dateScore"
  | "nameScore"
  | "matchType"
>;

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
}> {
  const { teamId, inboxId, candidate, source } = params;
  const shouldAutoMatch = candidate.matchType === "auto_matched";

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

    return { action: "auto_matched" };
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
    matchType: candidate.matchType,
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
    return { action: "suggestion_created" };
  }

  await updateInbox(db, {
    id: inboxId,
    teamId,
    status: "suggested_match",
  });

  return { action: "suggestion_created" };
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

    const { action } = await persistInboxSuggestionWorkflow(db, {
      teamId,
      inboxId,
      candidate: bestMatch,
    });

    return {
      action,
      suggestion: bestMatch,
    };
  } catch (error) {
    try {
      const currentInbox = await getInboxItemByIdFromConvex({
        teamId,
        inboxId,
      });

      if (
        shouldResetInboxToPendingAfterSuggestionFailure(currentInbox ?? null)
      ) {
        await updateInbox(db, {
          id: inboxId,
          teamId,
          status: "pending",
        });
      }
    } catch (rollbackError) {
      logger.error(
        "Failed to reset inbox after suggestion calculation failure",
        {
          teamId,
          inboxId,
          error:
            rollbackError instanceof Error
              ? rollbackError.message
              : "Unknown error",
        },
      );
    }

    throw error;
  }
}

export async function confirmSuggestedMatch(
  db: Database,
  params: {
    teamId: string;
    suggestionId: string;
    inboxId: string;
    transactionId: string;
    userId?: ConvexUserId | null;
  },
) {
  const { teamId, suggestionId, inboxId, transactionId, userId } = params;
  const [suggestion] = (
    await upsertTransactionMatchSuggestionsInConvex({
      suggestions: (
        await getTransactionMatchSuggestionsFromConvex({
          teamId,
          inboxId,
        })
      )
        .filter((row) => row.id === suggestionId)
        .map((row) => ({
          ...row,
          status: "confirmed" as const,
          userActionAt: new Date().toISOString(),
          userId: userId ?? null,
          updatedAt: new Date().toISOString(),
        })),
    })
  );

  const result = await matchTransaction(db, {
    id: inboxId,
    transactionId,
    teamId,
  });

  await createActivity(db, {
    teamId,
    userId: userId ?? undefined,
    type: "inbox_match_confirmed",
    source: "user",
    priority: 7,
    metadata: {
      inboxId,
      transactionId: result?.transactionId,
      documentName: result?.displayName,
      amount: result?.amount,
      currency: result?.currency,
      confidenceScore: Number(suggestion?.confidenceScore),
    },
  });

  return result;
}

export async function declineSuggestedMatch(
  db: Database,
  params: {
    suggestionId: string;
    inboxId: string;
    userId?: ConvexUserId | null;
    teamId: string;
  },
) {
  const { suggestionId, inboxId, userId, teamId } = params;
  const suggestions = await getTransactionMatchSuggestionsFromConvex({
    teamId,
    inboxId,
  });
  const suggestion = suggestions.find((row) => row.id === suggestionId);

  if (suggestion) {
    await upsertTransactionMatchSuggestionsInConvex({
      suggestions: [
        {
          ...suggestion,
          status: "declined",
          userActionAt: new Date().toISOString(),
          userId: userId ?? null,
          updatedAt: new Date().toISOString(),
        },
      ],
    });
  }

  await updateInbox(db, {
    id: inboxId,
    teamId,
    status: "pending",
  });
}

export type PendingInboxItem = {
  id: string;
  amount: number | null;
  date: string | null;
  currency: string | null;
  createdAt: string;
};

export async function getPendingInboxForMatching(
  _db: Database,
  params: {
    teamId: string;
    limit?: number;
  },
): Promise<PendingInboxItem[]> {
  const { teamId, limit = 100 } = params;
  const pendingItems = [];
  let cursor: string | null = null;

  while (pendingItems.length < limit) {
    const page = await getInboxItemsPageFromConvex({
      teamId,
      cursor,
      pageSize: Math.min(limit * 2, 200),
      status: "pending",
      order: "desc",
    });

    pendingItems.push(
      ...page.page.filter((item) => item.transactionId == null),
    );

    if (page.isDone) {
      break;
    }

    cursor = page.continueCursor;
  }

  return pendingItems.slice(0, limit).map((item) => ({
      id: item.id,
      amount: item.amount,
      date: item.date,
      currency: item.currency,
      createdAt: item.createdAt,
    }));
}

export async function getSuggestionByInboxAndTransaction(
  _db: Database,
  params: {
    inboxId: string;
    transactionId: string;
    teamId: string;
  },
) {
  const { inboxId, transactionId, teamId } = params;

  const result = (
    await getTransactionMatchSuggestionsFromConvex({
      teamId,
      inboxId,
      statuses: ["pending"],
    })
  ).find((suggestion) => suggestion.transactionId === transactionId);

  return result
    ? {
        id: result.id,
        inboxId: result.inboxId,
        transactionId: result.transactionId,
        status: result.status,
        confidenceScore: result.confidenceScore,
        matchType: result.matchType,
      }
    : null;
}
