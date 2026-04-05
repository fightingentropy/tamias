import {
  deleteTransactionAttachmentInConvex,
  getInboxItemsFromConvex,
  getTransactionInfoFromConvex,
  getTransactionMatchSuggestionsFromConvex,
  upsertInboxItemsInConvex,
  upsertTransactionMatchSuggestionsInConvex,
  upsertTransactionsInConvex,
} from "../../convex";
import type { Database } from "../../client";
import { deleteAccountingSyncRecordsForTransactions } from "../accounting-sync";
import { getTransactionAttachmentsByIds } from "./reads";

type DeleteAttachmentParams = {
  id: string;
  teamId: string;
};

export async function deleteAttachment(
  db: Database,
  params: DeleteAttachmentParams,
) {
  const [result] = await getTransactionAttachmentsByIds({
    teamId: params.teamId,
    attachmentIds: [params.id],
  });

  if (!result) {
    throw new Error("Attachment not found");
  }

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

    for (const row of rows) {
      affectedInboxIds.push(row.id);
    }
  }

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

    await deleteAccountingSyncRecordsForTransactions(db, {
      teamId: params.teamId,
      transactionIds: [result.transactionId],
    });
  }

  return deleteTransactionAttachmentInConvex({
    teamId: params.teamId,
    attachmentId: params.id,
  });
}
