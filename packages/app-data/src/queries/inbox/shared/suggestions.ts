import {
  getTransactionMatchSuggestionsFromConvex,
  getTransactionsByIdsFromConvex,
  upsertTransactionMatchSuggestionsInConvex,
  type CurrentUserIdentityRecord,
  type MatchSuggestionStatus,
  type TransactionMatchSuggestionRecord,
} from "@tamias/app-data-convex";
import {
  buildInboxTransactionSummary,
  type InboxTransactionSummary,
} from "./transactions";
import { toUpsertSuggestion } from "./serialization";

export type InboxConvexUserId = CurrentUserIdentityRecord["convexId"];

export async function loadSuggestionMaps(
  teamId: string,
  suggestions: TransactionMatchSuggestionRecord[],
) {
  const transactionMap = new Map<string, InboxTransactionSummary>();
  const suggestionIds = suggestions
    .map((suggestion) => suggestion.transactionId)
    .filter(Boolean);

  if (suggestionIds.length === 0) {
    return transactionMap;
  }

  const transactions = await getTransactionsByIdsFromConvex({
    teamId,
    transactionIds: suggestionIds,
  });

  for (const transaction of transactions) {
    transactionMap.set(
      transaction.id,
      buildInboxTransactionSummary(transaction)!,
    );
  }

  return transactionMap;
}

export async function getTeamMatchSuggestions(
  teamId: string,
  statuses?: MatchSuggestionStatus[],
) {
  return getTransactionMatchSuggestionsFromConvex({ teamId, statuses });
}

export async function getPendingSuggestionForInbox(
  teamId: string,
  inboxId: string,
) {
  const suggestions = await getTransactionMatchSuggestionsFromConvex({
    teamId,
    inboxId,
    statuses: ["pending"],
  });

  return (
    suggestions.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    )[0] ?? null
  );
}

export async function clearInboxSuggestions(
  teamId: string,
  suggestions: TransactionMatchSuggestionRecord[],
  params: {
    status: MatchSuggestionStatus;
    userId?: InboxConvexUserId | null;
  },
) {
  if (suggestions.length === 0) {
    return;
  }

  await upsertTransactionMatchSuggestionsInConvex({
    suggestions: suggestions.map((suggestion) =>
      toUpsertSuggestion(suggestion, {
        status: params.status,
        userActionAt: new Date().toISOString(),
        userId: params.userId ?? null,
        updatedAt: new Date().toISOString(),
      }),
    ),
  });
}
