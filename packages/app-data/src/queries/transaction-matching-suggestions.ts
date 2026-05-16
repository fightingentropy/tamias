import type { DatabaseOrTransaction } from "../client";
import {
  getTransactionMatchSuggestionsFromD1,
  requireInboxItemsD1,
  upsertTransactionMatchSuggestionsInD1,
} from "./inbox/d1";
import type { CreateMatchSuggestionParams } from "./transaction-matching-types";

export async function createMatchSuggestion(
  db: DatabaseOrTransaction,
  params: CreateMatchSuggestionParams,
) {
  const existing = (
    await getTransactionMatchSuggestionsFromD1(requireInboxItemsD1(db), {
      teamId: params.teamId,
      inboxId: params.inboxId,
    })
  ).find((suggestion) => suggestion.transactionId === params.transactionId);

  if (existing && (existing.status === "confirmed" || existing.status === "declined")) {
    return null;
  }

  const [result] = await upsertTransactionMatchSuggestionsInD1(requireInboxItemsD1(db), {
    suggestions: [
      existing
        ? {
            ...existing,
            confidenceScore: params.confidenceScore,
            amountScore: params.amountScore ?? null,
            currencyScore: params.currencyScore ?? null,
            dateScore: params.dateScore ?? null,
            nameScore: params.nameScore ?? null,
            matchType: params.matchType,
            matchDetails: params.matchDetails,
            status: params.status || "pending",
            userId: params.userId ?? null,
            updatedAt: new Date().toISOString(),
          }
        : {
            teamId: params.teamId,
            inboxId: params.inboxId,
            transactionId: params.transactionId,
            confidenceScore: params.confidenceScore,
            amountScore: params.amountScore ?? null,
            currencyScore: params.currencyScore ?? null,
            dateScore: params.dateScore ?? null,
            nameScore: params.nameScore ?? null,
            matchType: params.matchType,
            matchDetails: params.matchDetails,
            status: params.status || "pending",
            userId: params.userId ?? null,
            userActionAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
    ],
  });

  return result ?? null;
}
