import {
  getTransactionMatchSuggestionsFromConvex,
  upsertTransactionMatchSuggestionsInConvex,
} from "@tamias/app-data-convex";
import type { DatabaseOrTransaction } from "../client";
import type { CreateMatchSuggestionParams } from "./transaction-matching-types";

export async function createMatchSuggestion(
  _db: DatabaseOrTransaction,
  params: CreateMatchSuggestionParams,
) {
  const existing = (
    await getTransactionMatchSuggestionsFromConvex({
      teamId: params.teamId,
      inboxId: params.inboxId,
    })
  ).find((suggestion) => suggestion.transactionId === params.transactionId);

  if (existing && (existing.status === "confirmed" || existing.status === "declined")) {
    return null;
  }

  const [result] = await upsertTransactionMatchSuggestionsInConvex({
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
