import type { Database } from "../../client";
import { deleteAccountingSyncRecordsForTransactions } from "../accounting-sync";
import {
  getInboxItemsFromD1,
  getTransactionMatchSuggestionsFromD1,
  requireInboxItemsD1,
  upsertInboxItemsInD1,
  upsertTransactionMatchSuggestionsInD1,
} from "../inbox/d1";
import { deleteTransactionAttachmentsByIdsFromD1, requireTransactionAttachmentsD1 } from "./d1";
import { getTransactionAttachmentsByIds } from "./reads";
import { syncTransactionHasAttachmentFlags } from "./sync";

type DeleteAttachmentParams = {
  id: string;
  teamId: string;
};

export async function deleteAttachment(db: Database, params: DeleteAttachmentParams) {
  const [result] = await getTransactionAttachmentsByIds(db, {
    teamId: params.teamId,
    attachmentIds: [params.id],
  });

  if (!result) {
    throw new Error("Attachment not found");
  }

  const affectedInboxIds: string[] = [];
  const teamInboxItems = result.transactionId
    ? await getInboxItemsFromD1(requireInboxItemsD1(db), {
        teamId: params.teamId,
        transactionIds: [result.transactionId],
      })
    : [];

  if (result.transactionId) {
    const rows = teamInboxItems.filter(
      (item) => item.attachmentId === result.id || item.transactionId === result.transactionId,
    );

    for (const row of rows) {
      affectedInboxIds.push(row.id);
    }
  }

  const itemsByAttachment = (
    await getInboxItemsFromD1(requireInboxItemsD1(db), {
      teamId: params.teamId,
    })
  ).filter((item) => item.attachmentId === result.id);

  if (itemsByAttachment.length > 0) {
    await upsertInboxItemsInD1(requireInboxItemsD1(db), {
      items: itemsByAttachment.map((item) => ({
        ...item,
        teamId: item.teamId,
        attachmentId: null,
        transactionId: null,
        status: "pending",
        updatedAt: new Date().toISOString(),
      })),
    });
  }

  if (result.transactionId) {
    const relatedItems = teamInboxItems.filter(
      (item) =>
        item.transactionId === result.transactionId &&
        (item.attachmentId == null || item.attachmentId !== result.id),
    );

    if (relatedItems.length > 0) {
      await upsertInboxItemsInD1(requireInboxItemsD1(db), {
        items: relatedItems.map((item) => ({
          ...item,
          teamId: item.teamId,
          transactionId: null,
          status: "pending",
          updatedAt: new Date().toISOString(),
        })),
      });
    }
  }

  if (result.transactionId && affectedInboxIds.length > 0) {
    const suggestions = await getTransactionMatchSuggestionsFromD1(requireInboxItemsD1(db), {
      teamId: params.teamId,
      transactionId: result.transactionId,
    });

    const latestSuggestionByInboxId = new Map<string, (typeof suggestions)[number]>();

    for (const suggestion of suggestions) {
      const current = latestSuggestionByInboxId.get(suggestion.inboxId);
      if (!current || suggestion.createdAt > current.createdAt) {
        latestSuggestionByInboxId.set(suggestion.inboxId, suggestion);
      }
    }

    const now = new Date().toISOString();
    const unmatchedSuggestions = affectedInboxIds
      .map((inboxId) => {
        const originalSuggestion = latestSuggestionByInboxId.get(inboxId);
        if (!originalSuggestion) {
          return null;
        }

        return {
          ...originalSuggestion,
          status: "unmatched" as const,
          userActionAt: now,
          updatedAt: now,
        };
      })
      .filter((suggestion) => suggestion !== null);

    if (unmatchedSuggestions.length > 0) {
      await upsertTransactionMatchSuggestionsInD1(requireInboxItemsD1(db), {
        suggestions: unmatchedSuggestions,
      });
    }
  }

  const d1 = requireTransactionAttachmentsD1(db);
  const deleteResult = await deleteTransactionAttachmentsByIdsFromD1(d1, {
    teamId: params.teamId,
    attachmentIds: [params.id],
  });

  if (deleteResult.affectedTransactionIds.length > 0) {
    await syncTransactionHasAttachmentFlags({
      d1,
      teamId: params.teamId,
      transactionIds: deleteResult.affectedTransactionIds,
    });

    await deleteAccountingSyncRecordsForTransactions(db, {
      teamId: params.teamId,
      transactionIds: deleteResult.affectedTransactionIds,
    });
  }

  return result;
}
