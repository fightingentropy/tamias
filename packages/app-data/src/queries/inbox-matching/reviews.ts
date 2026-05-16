import type { Database } from "../../client";
import {
  getTransactionMatchSuggestionsFromD1,
  requireInboxItemsD1,
  upsertTransactionMatchSuggestionsInD1,
} from "../inbox/d1";
import { createActivity } from "../activities";
import { matchTransaction } from "../inbox";
import { updateInbox } from "../inbox";

type InboxUserId = string;

export async function confirmSuggestedMatch(
  db: Database,
  params: {
    teamId: string;
    suggestionId: string;
    inboxId: string;
    transactionId: string;
    userId?: InboxUserId | null;
  },
) {
  const { teamId, suggestionId, inboxId, transactionId, userId } = params;
  const [suggestion] = await upsertTransactionMatchSuggestionsInD1(requireInboxItemsD1(db), {
    suggestions: (
      await getTransactionMatchSuggestionsFromD1(requireInboxItemsD1(db), {
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
    userId?: InboxUserId | null;
    teamId: string;
  },
) {
  const { suggestionId, inboxId, userId, teamId } = params;
  const suggestions = await getTransactionMatchSuggestionsFromD1(requireInboxItemsD1(db), {
    teamId,
    inboxId,
  });
  const suggestion = suggestions.find((row) => row.id === suggestionId);

  if (suggestion) {
    await upsertTransactionMatchSuggestionsInD1(requireInboxItemsD1(db), {
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
