import {
  getTransactionMatchSuggestionsFromConvex,
  upsertTransactionMatchSuggestionsInConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../../client";
import { createActivity } from "../activities";
import { matchTransaction } from "../inbox";
import { updateInbox } from "../inbox";

type ConvexUserId = import("@tamias/app-data-convex").CurrentUserIdentityRecord["convexId"];

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
  const [suggestion] = await upsertTransactionMatchSuggestionsInConvex({
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
  });

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
