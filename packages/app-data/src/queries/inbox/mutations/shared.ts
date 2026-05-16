import { createLoggerWithContext } from "@tamias/logger";
import type { Database } from "../../../client";
import { deleteTransactionAttachmentsByIds } from "../../transaction-attachments";
import { getTransactionByIdFromD1, requireTransactionsD1 } from "../../transactions/d1";
import {
  deleteTransactionMatchSuggestionsFromD1,
  getInboxItemByIdFromD1,
  requireInboxItemsD1,
  type InboxItemRecord,
} from "../d1";
import { buildInboxTransactionSummary, patchTransactionFields } from "../shared";

export const logger = createLoggerWithContext("inbox");

export async function clearTransactionTaxFieldsIfAttachmentless(
  db: Database,
  teamId: string,
  transactionId: string,
) {
  const transaction = await getTransactionByIdFromD1(requireTransactionsD1(db), {
    teamId,
    transactionId,
  });

  if (transaction && !transaction.hasAttachment) {
    await patchTransactionFields(db, teamId, transactionId, {
      taxRate: null,
      taxType: null,
    });
  }
}

export async function cleanupDeletedInboxArtifacts(
  db: Database,
  teamId: string,
  item: Pick<InboxItemRecord, "attachmentId" | "transactionId" | "id">,
) {
  if (item.attachmentId && item.transactionId) {
    await deleteTransactionAttachmentsByIds(db, {
      teamId,
      attachmentIds: [item.attachmentId],
    });
    await clearTransactionTaxFieldsIfAttachmentless(db, teamId, item.transactionId);
  }

  await deleteTransactionMatchSuggestionsFromD1(requireInboxItemsD1(db), {
    teamId,
    inboxIds: [item.id],
  });
}

export async function buildInboxItemWithTransaction(
  db: Database,
  teamId: string,
  item: InboxItemRecord,
) {
  return {
    ...item,
    transaction: item.transactionId
      ? buildInboxTransactionSummary(
          await getTransactionByIdFromD1(requireTransactionsD1(db), {
            teamId,
            transactionId: item.transactionId,
          }),
        )
      : null,
  };
}

export async function getInboxItemWithTransaction(db: Database, teamId: string, inboxId: string) {
  const item = await getInboxItemByIdFromD1(requireInboxItemsD1(db), {
    teamId,
    inboxId,
  });

  if (!item) {
    return null;
  }

  return buildInboxItemWithTransaction(db, teamId, item);
}

export function toInboxFileResponse(
  result: Pick<
    InboxItemRecord,
    | "id"
    | "fileName"
    | "filePath"
    | "displayName"
    | "transactionId"
    | "amount"
    | "currency"
    | "contentType"
    | "date"
    | "status"
    | "createdAt"
    | "website"
    | "senderEmail"
    | "description"
    | "referenceId"
    | "size"
    | "inboxAccountId"
  >,
) {
  return {
    id: result.id,
    fileName: result.fileName,
    filePath: result.filePath,
    displayName: result.displayName,
    transactionId: result.transactionId,
    amount: result.amount,
    currency: result.currency,
    contentType: result.contentType,
    date: result.date,
    status: result.status,
    createdAt: result.createdAt,
    website: result.website,
    senderEmail: result.senderEmail,
    description: result.description,
    referenceId: result.referenceId,
    size: result.size,
    inboxAccountId: result.inboxAccountId,
  };
}

export function toProcessedInboxResponse(
  result: Pick<
    InboxItemRecord,
    | "id"
    | "fileName"
    | "filePath"
    | "displayName"
    | "transactionId"
    | "amount"
    | "currency"
    | "contentType"
    | "date"
    | "status"
    | "createdAt"
    | "website"
    | "description"
    | "referenceId"
    | "size"
    | "taxAmount"
    | "taxRate"
    | "taxType"
    | "type"
    | "invoiceNumber"
  >,
) {
  return {
    id: result.id,
    fileName: result.fileName,
    filePath: result.filePath,
    displayName: result.displayName,
    transactionId: result.transactionId,
    amount: result.amount,
    currency: result.currency,
    contentType: result.contentType,
    date: result.date,
    status: result.status,
    createdAt: result.createdAt,
    website: result.website,
    description: result.description,
    referenceId: result.referenceId,
    size: result.size,
    taxAmount: result.taxAmount,
    taxRate: result.taxRate,
    taxType: result.taxType,
    type: result.type,
    invoiceNumber: result.invoiceNumber,
  };
}
