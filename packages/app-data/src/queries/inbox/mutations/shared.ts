import {
  deleteTransactionMatchSuggestionsInConvex,
  getInboxItemByIdFromConvex,
  getTransactionByIdFromConvex,
  type InboxItemRecord,
} from "@tamias/app-data-convex";
import { createLoggerWithContext } from "@tamias/logger";
import { deleteTransactionAttachmentsByIds } from "../../transaction-attachments";
import { buildInboxTransactionSummary, patchTransactionFields } from "../shared";

export const logger = createLoggerWithContext("inbox");

export async function clearTransactionTaxFieldsIfAttachmentless(
  teamId: string,
  transactionId: string,
) {
  const transaction = await getTransactionByIdFromConvex({
    teamId,
    transactionId,
  });

  if (transaction && !transaction.hasAttachment) {
    await patchTransactionFields(teamId, transactionId, {
      taxRate: null,
      taxType: null,
    });
  }
}

export async function cleanupDeletedInboxArtifacts(
  teamId: string,
  item: Pick<InboxItemRecord, "attachmentId" | "transactionId" | "id">,
) {
  if (item.attachmentId && item.transactionId) {
    await deleteTransactionAttachmentsByIds({
      teamId,
      attachmentIds: [item.attachmentId],
    });
    await clearTransactionTaxFieldsIfAttachmentless(teamId, item.transactionId);
  }

  await deleteTransactionMatchSuggestionsInConvex({
    teamId,
    inboxIds: [item.id],
  });
}

export async function buildInboxItemWithTransaction(teamId: string, item: InboxItemRecord) {
  return {
    ...item,
    transaction: item.transactionId
      ? buildInboxTransactionSummary(
          await getTransactionByIdFromConvex({
            teamId,
            transactionId: item.transactionId,
          }),
        )
      : null,
  };
}

export async function getInboxItemWithTransaction(teamId: string, inboxId: string) {
  const item = await getInboxItemByIdFromConvex({
    teamId,
    inboxId,
  });

  if (!item) {
    return null;
  }

  return buildInboxItemWithTransaction(teamId, item);
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
