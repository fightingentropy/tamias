import {
  getInboxItemsPageFromConvex,
  getTransactionMatchSuggestionsFromConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../../client";

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
