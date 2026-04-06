import {
  getTransactionAttachmentsForTransactionIdsFromConvex,
  getTransactionsPageFromConvex,
  type TransactionRecord,
  type TransactionStatus,
} from "@tamias/app-data-convex";

export type AccountingSyncAttachment = {
  id: string;
  name: string | null;
  path: string[] | null;
  type: string | null;
  size: number | null;
};

const ACCOUNTING_SYNC_EXCLUDED_STATUSES: TransactionStatus[] = ["excluded", "archived"];

export const ACCOUNTING_SYNC_EXCLUDED_STATUS_SET = new Set<TransactionStatus>(
  ACCOUNTING_SYNC_EXCLUDED_STATUSES,
);

export function compareTransactionsByDateDesc(
  left: Pick<TransactionRecord, "id" | "date" | "createdAt">,
  right: Pick<TransactionRecord, "id" | "date" | "createdAt">,
) {
  const dateComparison = right.date.localeCompare(left.date);

  if (dateComparison !== 0) {
    return dateComparison;
  }

  const createdAtComparison = right.createdAt.localeCompare(left.createdAt);

  if (createdAtComparison !== 0) {
    return createdAtComparison;
  }

  return right.id.localeCompare(left.id);
}

export async function getRecentUnsyncedTransactions(args: {
  teamId: string;
  dateGte: string;
  limit: number;
  syncedIdSet: Set<string>;
}) {
  const records: TransactionRecord[] = [];
  let cursor: string | null = null;

  while (records.length < args.limit) {
    const result = await getTransactionsPageFromConvex({
      teamId: args.teamId,
      cursor,
      pageSize: Math.min(Math.max(args.limit, 100), 500),
      order: "desc",
      dateGte: args.dateGte,
      statusesNotIn: [...ACCOUNTING_SYNC_EXCLUDED_STATUS_SET],
    });

    for (const record of result.page) {
      if (args.syncedIdSet.has(record.id)) {
        continue;
      }

      records.push(record);

      if (records.length >= args.limit) {
        break;
      }
    }

    if (result.isDone || records.length >= args.limit) {
      return records;
    }

    cursor = result.continueCursor;
  }

  return records;
}

export async function getAttachmentsByTransactionId(args: {
  teamId: string;
  transactionIds: string[];
}) {
  const attachments = await getTransactionAttachmentsForTransactionIdsFromConvex({
    teamId: args.teamId,
    transactionIds: args.transactionIds,
  });
  const attachmentsByTransactionId = new Map<string, AccountingSyncAttachment[]>();

  for (const attachment of attachments) {
    if (!attachment.transactionId) {
      continue;
    }

    const current = attachmentsByTransactionId.get(attachment.transactionId) ?? [];
    current.push({
      id: attachment.id,
      name: attachment.name,
      path: attachment.path,
      type: attachment.type,
      size: attachment.size,
    });
    attachmentsByTransactionId.set(attachment.transactionId, current);
  }

  return attachmentsByTransactionId;
}
