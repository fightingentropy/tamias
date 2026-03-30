import {
  type CurrentUserIdentityRecord,
  createTransactionAttachmentsInConvex,
  deleteTransactionAttachmentInConvex,
  deleteTransactionAttachmentsByIdsInConvex,
  deleteTransactionAttachmentsByPathKeysInConvex,
  getInboxItemsFromConvex,
  getTransactionAttachmentFromConvex,
  getTransactionAttachmentsByIdsFromConvex,
  getTransactionAttachmentsByPathKeysFromConvex,
  getTransactionAttachmentsForTransactionIdsFromConvex,
  getTransactionInfoFromConvex,
  getTransactionMatchSuggestionsFromConvex,
  type TransactionAttachmentRecord,
  upsertInboxItemsInConvex,
  upsertTransactionMatchSuggestionsInConvex,
  upsertTransactionsInConvex,
} from "@tamias/app-data-convex";
import type { Database, DatabaseOrTransaction } from "../client";
import { deleteAccountingSyncRecordsForTransactions } from "./accounting-sync";
import { createActivity } from "./activities";

type ConvexUserId = CurrentUserIdentityRecord["convexId"];

export type Attachment = {
  type: string;
  name: string;
  size: number;
  path: string[];
  transactionId?: string;
};

type CreateAttachmentsParams = {
  attachments: Attachment[];
  teamId: string;
  userId?: ConvexUserId;
};

export type StoredTransactionAttachment = TransactionAttachmentRecord;

export async function getTransactionAttachmentsByIds(params: {
  teamId: string;
  attachmentIds: string[];
}) {
  return getTransactionAttachmentsByIdsFromConvex(params);
}

export async function getTransactionAttachmentsForTransactionIds(params: {
  teamId: string;
  transactionIds: string[];
}) {
  return getTransactionAttachmentsForTransactionIdsFromConvex(params);
}

export async function getTransactionAttachmentsByPathKeys(params: {
  teamId: string;
  pathKeys: string[][];
}) {
  return getTransactionAttachmentsByPathKeysFromConvex(params);
}

export async function deleteTransactionAttachmentsByIds(params: {
  teamId: string;
  attachmentIds: string[];
}) {
  return deleteTransactionAttachmentsByIdsInConvex(params);
}

export async function deleteTransactionAttachmentsByPathKeys(params: {
  teamId: string;
  pathKeys: string[][];
}) {
  return deleteTransactionAttachmentsByPathKeysInConvex(params);
}

export async function createAttachments(
  db: DatabaseOrTransaction,
  params: CreateAttachmentsParams,
) {
  const { attachments, teamId, userId } = params;
  const result = await createTransactionAttachmentsInConvex({
    teamId,
    attachments,
  });

  // Reset export status for affected transactions so they reappear in review
  const transactionIds = [
    ...new Set(
      result
        .map((a) => a.transactionId)
        .filter((id): id is string => id !== null),
    ),
  ];

  if (transactionIds.length > 0) {
    await deleteAccountingSyncRecordsForTransactions(db, {
      teamId,
      transactionIds,
    });
  }

  // Create activity for each attachment created
  for (const attachment of result) {
    createActivity(db, {
      teamId,
      userId,
      type: "transaction_attachment_created",
      source: "user",
      priority: 7,
      metadata: {
        attachmentId: attachment.id,
        transactionId: attachment.transactionId,
        fileName: attachment.name,
        fileSize: attachment.size,
        fileType: attachment.type,
      },
    });
  }

  return result;
}

type DeleteAttachmentParams = {
  id: string;
  teamId: string;
};

type GetTransactionAttachmentParams = {
  transactionId: string;
  attachmentId: string;
  teamId: string;
};

export async function getTransactionAttachment(
  _db: Database,
  params: GetTransactionAttachmentParams,
) {
  const { transactionId, attachmentId, teamId } = params;
  return getTransactionAttachmentFromConvex({
    teamId,
    transactionId,
    attachmentId,
  });
}

export async function deleteAttachment(
  db: Database,
  params: DeleteAttachmentParams,
) {
  // First get the attachment to delete
  const [result] = await getTransactionAttachmentsByIds({
    teamId: params.teamId,
    attachmentIds: [params.id],
  });

  if (!result) {
    throw new Error("Attachment not found");
  }

  // Collect affected inbox IDs BEFORE clearing their foreign keys, so we can
  // update the corresponding match suggestions afterwards.
  const affectedInboxIds: string[] = [];
  const teamInboxItems = result.transactionId
    ? await getInboxItemsFromConvex({
        teamId: params.teamId,
        transactionIds: [result.transactionId],
      })
    : [];
  if (result.transactionId) {
    const rows = teamInboxItems.filter(
      (item) =>
        item.attachmentId === result.id ||
        item.transactionId === result.transactionId,
    );
    for (const r of rows) affectedInboxIds.push(r.id);
  }

  // Update inbox items connected to this attachment
  const itemsByAttachment = (
    await getInboxItemsFromConvex({
      teamId: params.teamId,
    })
  ).filter((item) => item.attachmentId === result.id);

  if (itemsByAttachment.length > 0) {
    await upsertInboxItemsInConvex({
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
      await upsertInboxItemsInConvex({
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

  // Mark match suggestions as "unmatched" so retry matching can create fresh ones.
  // Without this, createMatchSuggestion's onConflictDoUpdate silently skips rows
  // with status "confirmed", leaving the inbox stuck in "suggested_match" with no
  // pending suggestion the user can act on.
  if (result.transactionId && affectedInboxIds.length > 0) {
    const suggestions = await getTransactionMatchSuggestionsFromConvex({
      teamId: params.teamId,
      transactionId: result.transactionId,
    });

    const latestSuggestionByInboxId = new Map<
      string,
      (typeof suggestions)[number]
    >();
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
      await upsertTransactionMatchSuggestionsInConvex({
        suggestions: unmatchedSuggestions,
      });
    }
  }

  // Delete tax_rate and tax_type from the transaction
  if (result.transactionId) {
    const transaction = await getTransactionInfoFromConvex({
      transactionId: result.transactionId,
    });

    if (transaction) {
      await upsertTransactionsInConvex({
        teamId: transaction.teamId,
        transactions: [
          {
            id: transaction.id,
            createdAt: transaction.createdAt,
            date: transaction.date,
            name: transaction.name,
            method: transaction.method,
            amount: transaction.amount,
            currency: transaction.currency,
            assignedId: transaction.assignedId,
            note: transaction.note,
            bankAccountId: transaction.bankAccountId,
            internalId: transaction.internalId,
            status: transaction.status,
            balance: transaction.balance,
            manual: transaction.manual,
            internal: transaction.internal,
            description: transaction.description,
            categorySlug: transaction.categorySlug,
            baseAmount: transaction.baseAmount,
            counterpartyName: transaction.counterpartyName,
            baseCurrency: transaction.baseCurrency,
            taxAmount: transaction.taxAmount,
            taxRate: null,
            taxType: null,
            recurring: transaction.recurring,
            frequency: transaction.frequency,
            merchantName: transaction.merchantName,
            enrichmentCompleted: transaction.enrichmentCompleted,
          },
        ],
      });
    }

    // Reset export status so transaction reappears in review
    await deleteAccountingSyncRecordsForTransactions(db, {
      teamId: params.teamId,
      transactionIds: [result.transactionId],
    });
  }

  // Delete the attachment
  return deleteTransactionAttachmentInConvex({
    teamId: params.teamId,
    attachmentId: params.id,
  });
}
