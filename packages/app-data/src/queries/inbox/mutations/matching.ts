import {
  getInboxItemByIdFromConvex,
  getInboxItemsFromConvex,
  getTransactionByIdFromConvex,
  getTransactionMatchSuggestionsFromConvex,
  type TransactionRecord,
} from "@tamias/app-data-convex";
import type { Database, DatabaseOrTransaction } from "../../../client";
import {
  createAttachments,
  deleteTransactionAttachmentsByIds,
} from "../../transaction-attachments";
import {
  clearInboxSuggestions,
  getRelatedInboxItems,
  markInboxItems,
  type InboxConvexUserId,
  patchTransactionFields,
} from "../shared";
import {
  buildInboxItemWithTransaction,
  clearTransactionTaxFieldsIfAttachmentless,
  getInboxItemWithTransaction,
} from "./shared";

export type MatchTransactionParams = {
  id: string;
  transactionId: string;
  teamId: string;
};

export async function matchTransaction(db: DatabaseOrTransaction, params: MatchTransactionParams) {
  const { id, transactionId, teamId } = params;
  const [result, targetTransaction] = await Promise.all([
    getInboxItemByIdFromConvex({ teamId, inboxId: id }),
    getTransactionByIdFromConvex({ teamId, transactionId }),
  ]);

  if (!result) {
    return null;
  }

  if (result.transactionId) {
    throw new Error("Inbox item is already matched to a transaction");
  }

  const primaryItemId = result.groupedInboxId || result.id;
  const relatedItems = await getRelatedInboxItems(teamId, result);
  const alreadyMatched = relatedItems.find((item) => item.transactionId);

  if (alreadyMatched) {
    throw new Error("A related inbox item is already matched to a transaction");
  }

  if (!targetTransaction) {
    throw new Error("Transaction not found or belongs to another team");
  }

  const existingMatches = await getInboxItemsFromConvex({
    teamId,
    transactionIds: [transactionId],
  });
  const conflictingMatch = existingMatches.find(
    (item) => !relatedItems.some((relatedItem) => relatedItem.id === item.id),
  );

  if (conflictingMatch) {
    throw new Error("Transaction is already matched to another inbox item");
  }

  const attachmentIds = new Map<string, string>();
  const createdAttachments = await createAttachments(db, {
    teamId,
    attachments: relatedItems.map((item) => ({
      type: item.contentType ?? "",
      path: item.filePath ?? [],
      transactionId,
      size: item.size ?? 0,
      name: item.fileName ?? "",
    })),
  });

  for (const [index, item] of relatedItems.entries()) {
    const attachmentData = createdAttachments[index];

    if (attachmentData) {
      attachmentIds.set(item.id, attachmentData.id);
    }
  }

  const primaryItem = relatedItems.find((item) => item.id === primaryItemId) || result;
  const taxUpdates: Partial<TransactionRecord> = {};

  if (primaryItem.taxAmount !== null && primaryItem.taxAmount !== undefined) {
    taxUpdates.taxAmount = primaryItem.taxAmount;
  }

  if (primaryItem.taxRate !== null && primaryItem.taxRate !== undefined && primaryItem.taxType) {
    taxUpdates.taxRate = primaryItem.taxRate;
    taxUpdates.taxType = primaryItem.taxType;
  }

  if (Object.keys(taxUpdates).length > 0) {
    await patchTransactionFields(teamId, transactionId, taxUpdates);
  }

  await markInboxItems(
    relatedItems.map((item) => ({
      ...item,
      attachmentId: attachmentIds.get(item.id) ?? item.attachmentId,
      transactionId,
      status: "done",
    })),
    {},
  );

  return getInboxItemWithTransaction(teamId, id);
}

export type UnmatchTransactionParams = {
  id: string;
  teamId: string;
};

export async function unmatchTransaction(
  _db: Database,
  params: UnmatchTransactionParams & { userId?: InboxConvexUserId },
) {
  const { id, teamId, userId } = params;
  const result = await getInboxItemByIdFromConvex({ teamId, inboxId: id });

  if (!result) {
    return null;
  }

  const relatedItems = await getRelatedInboxItems(teamId, result);
  const transactionId = relatedItems.find((item) => item.transactionId)?.transactionId;

  if (transactionId) {
    const transactionSuggestions = await getTransactionMatchSuggestionsFromConvex({
      teamId,
      transactionId,
      statuses: ["confirmed"],
    });
    const originalSuggestions = relatedItems.flatMap((item) =>
      transactionSuggestions.filter(
        (suggestion) =>
          suggestion.inboxId === item.id &&
          suggestion.transactionId === transactionId &&
          suggestion.status === "confirmed",
      ),
    );

    await clearInboxSuggestions(teamId, originalSuggestions, {
      status: "unmatched",
      userId,
    });
  }

  await markInboxItems(relatedItems, {
    transactionId: null,
    attachmentId: null,
    status: "pending",
  });

  const attachmentIds = relatedItems
    .map((item) => item.attachmentId)
    .filter((attachmentId): attachmentId is string => attachmentId !== null);

  if (attachmentIds.length > 0) {
    await deleteTransactionAttachmentsByIds({
      teamId,
      attachmentIds,
    });
  }

  if (transactionId) {
    await clearTransactionTaxFieldsIfAttachmentless(teamId, transactionId);
  }

  const resultData = await getInboxItemByIdFromConvex({
    teamId,
    inboxId: id,
  });

  if (!resultData) {
    return null;
  }

  return buildInboxItemWithTransaction(teamId, resultData);
}
