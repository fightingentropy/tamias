import type { Database, DatabaseOrTransaction } from "../../../client";
import {
  getInboxItemByIdFromD1,
  getInboxItemsFromD1,
  getTransactionMatchSuggestionsFromD1,
  requireInboxItemsD1,
} from "../d1";
import {
  createAttachments,
  deleteTransactionAttachmentsByIds,
} from "../../transaction-attachments";
import { getTransactionByIdFromD1, requireTransactionsD1 } from "../../transactions/d1";
import type { TransactionRecord } from "../../transactions/shared";
import {
  clearInboxSuggestions,
  getRelatedInboxItems,
  markInboxItems,
  type InboxUserId,
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
    getInboxItemByIdFromD1(requireInboxItemsD1(db), { teamId, inboxId: id }),
    getTransactionByIdFromD1(requireTransactionsD1(db), { teamId, transactionId }),
  ]);

  if (!result) {
    return null;
  }

  if (result.transactionId) {
    throw new Error("Inbox item is already matched to a transaction");
  }

  const primaryItemId = result.groupedInboxId || result.id;
  const relatedItems = await getRelatedInboxItems(db, teamId, result);
  const alreadyMatched = relatedItems.find((item) => item.transactionId);

  if (alreadyMatched) {
    throw new Error("A related inbox item is already matched to a transaction");
  }

  if (!targetTransaction) {
    throw new Error("Transaction not found or belongs to another team");
  }

  const existingMatches = await getInboxItemsFromD1(requireInboxItemsD1(db), {
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
    await patchTransactionFields(db, teamId, transactionId, taxUpdates);
  }

  await markInboxItems(
    db,
    relatedItems.map((item) => ({
      ...item,
      attachmentId: attachmentIds.get(item.id) ?? item.attachmentId,
      transactionId,
      status: "done",
    })),
    {},
  );

  return getInboxItemWithTransaction(db, teamId, id);
}

export type UnmatchTransactionParams = {
  id: string;
  teamId: string;
};

export async function unmatchTransaction(
  db: Database,
  params: UnmatchTransactionParams & { userId?: InboxUserId },
) {
  const { id, teamId, userId } = params;
  const result = await getInboxItemByIdFromD1(requireInboxItemsD1(db), { teamId, inboxId: id });

  if (!result) {
    return null;
  }

  const relatedItems = await getRelatedInboxItems(db, teamId, result);
  const transactionId = relatedItems.find((item) => item.transactionId)?.transactionId;

  if (transactionId) {
    const transactionSuggestions = await getTransactionMatchSuggestionsFromD1(
      requireInboxItemsD1(db),
      {
        teamId,
        transactionId,
        statuses: ["confirmed"],
      },
    );
    const originalSuggestions = relatedItems.flatMap((item) =>
      transactionSuggestions.filter(
        (suggestion) =>
          suggestion.inboxId === item.id &&
          suggestion.transactionId === transactionId &&
          suggestion.status === "confirmed",
      ),
    );

    await clearInboxSuggestions(db, teamId, originalSuggestions, {
      status: "unmatched",
      userId,
    });
  }

  await markInboxItems(db, relatedItems, {
    transactionId: null,
    attachmentId: null,
    status: "pending",
  });

  const attachmentIds = relatedItems
    .map((item) => item.attachmentId)
    .filter((attachmentId): attachmentId is string => attachmentId !== null);

  if (attachmentIds.length > 0) {
    await deleteTransactionAttachmentsByIds(db, {
      teamId,
      attachmentIds,
    });
  }

  if (transactionId) {
    await clearTransactionTaxFieldsIfAttachmentless(db, teamId, transactionId);
  }

  const resultData = await getInboxItemByIdFromD1(requireInboxItemsD1(db), {
    teamId,
    inboxId: id,
  });

  if (!resultData) {
    return null;
  }

  return buildInboxItemWithTransaction(db, teamId, resultData);
}
