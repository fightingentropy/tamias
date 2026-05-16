import { type Database } from "../../../client";
import { getTransactionsByIdsFromD1, requireTransactionsD1 } from "../../transactions/d1";
import {
  getTransactionMatchSuggestionsFromD1,
  requireInboxItemsD1,
  upsertTransactionMatchSuggestionsInD1,
  type MatchSuggestionStatus,
  type TransactionMatchSuggestionRecord,
} from "../d1";
import { buildInboxTransactionSummary, type InboxTransactionSummary } from "./transactions";
import { toUpsertSuggestion } from "./serialization";

export type InboxUserId = string;

export async function loadSuggestionMaps(
  db: Database,
  teamId: string,
  suggestions: TransactionMatchSuggestionRecord[],
) {
  const transactionMap = new Map<string, InboxTransactionSummary>();
  const suggestionIds = suggestions.map((suggestion) => suggestion.transactionId).filter(Boolean);

  if (suggestionIds.length === 0) {
    return transactionMap;
  }

  const transactions = await getTransactionsByIdsFromD1(requireTransactionsD1(db), {
    teamId,
    transactionIds: suggestionIds,
  });

  for (const transaction of transactions) {
    transactionMap.set(transaction.id, buildInboxTransactionSummary(transaction)!);
  }

  return transactionMap;
}

export async function getTeamMatchSuggestions(
  db: Database,
  teamId: string,
  statuses?: MatchSuggestionStatus[],
) {
  return getTransactionMatchSuggestionsFromD1(requireInboxItemsD1(db), { teamId, statuses });
}

export async function getPendingSuggestionForInbox(db: Database, teamId: string, inboxId: string) {
  const suggestions = await getTransactionMatchSuggestionsFromD1(requireInboxItemsD1(db), {
    teamId,
    inboxId,
    statuses: ["pending"],
  });

  return (
    suggestions.sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
  );
}

export async function clearInboxSuggestions(
  db: Database,
  teamId: string,
  suggestions: TransactionMatchSuggestionRecord[],
  params: {
    status: MatchSuggestionStatus;
    userId?: InboxUserId | null;
  },
) {
  if (suggestions.length === 0) {
    return;
  }

  await upsertTransactionMatchSuggestionsInD1(requireInboxItemsD1(db), {
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
