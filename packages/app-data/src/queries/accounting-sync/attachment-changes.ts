import {
  getAccountingSyncStatusFromConvex,
  getTransactionsByIdsFromConvex,
  type AccountingSyncProvider,
} from "@tamias/app-data-convex";
import type { Database } from "../../client";
import {
  ACCOUNTING_SYNC_EXCLUDED_STATUS_SET,
  getAttachmentsByTransactionId,
  type AccountingSyncAttachment,
  compareTransactionsByDateDesc,
} from "./shared";

export type TransactionWithAttachmentChanges = {
  transactionId: string;
  providerTransactionId: string;
  syncRecordId: string;
  syncedAttachmentMapping: Record<string, string | null>;
  currentAttachments: AccountingSyncAttachment[];
  newAttachmentIds: string[];
  removedAttachments: Array<{ tamiasId: string; providerId: string | null }>;
};

export type GetSyncedTransactionsWithAttachmentChangesParams = {
  teamId: string;
  provider: AccountingSyncProvider;
  sinceDaysAgo?: number;
  limit?: number;
};

export const getSyncedTransactionsWithAttachmentChanges = async (
  _db: Database,
  params: GetSyncedTransactionsWithAttachmentChangesParams,
): Promise<TransactionWithAttachmentChanges[]> => {
  const { teamId, provider, sinceDaysAgo = 30, limit = 100 } = params;

  const syncRecords = (await getAccountingSyncStatusFromConvex({
    teamId,
    provider,
  }))
    .filter(
      (record) =>
        record.status === "synced" && record.providerTransactionId !== null,
    )
    .sort((left, right) => right.syncedAt.localeCompare(left.syncedAt));

  if (syncRecords.length === 0) {
    return [];
  }

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - sinceDaysAgo);
  const sinceDateStr = sinceDate.toISOString().split("T")[0]!;

  const transactionIds = [
    ...new Set(syncRecords.map((record) => record.transactionId)),
  ];
  const currentTransactions = (
    await getTransactionsByIdsFromConvex({
      teamId,
      transactionIds,
    })
  )
    .filter((transaction) => transaction.date >= sinceDateStr)
    .filter(
      (transaction) =>
        !ACCOUNTING_SYNC_EXCLUDED_STATUS_SET.has(transaction.status),
    )
    .sort(compareTransactionsByDateDesc)
    .map((transaction) => ({
      transactionId: transaction.id,
      date: transaction.date,
    }));

  const attachmentsByTransactionId = await getAttachmentsByTransactionId({
    teamId,
    transactionIds: currentTransactions.map((row) => row.transactionId),
  });

  const results: TransactionWithAttachmentChanges[] = [];

  for (const syncRecord of syncRecords) {
    if (!syncRecord.providerTransactionId) {
      continue;
    }

    const currentTransactionAttachments =
      attachmentsByTransactionId.get(syncRecord.transactionId) ?? [];
    const syncedMapping = syncRecord.syncedAttachmentMapping ?? {};
    const syncedIds = new Set(Object.keys(syncedMapping));
    const currentIds = new Set(currentTransactionAttachments.map((item) => item.id));

    const newAttachmentIds = [...currentIds].filter((id) => !syncedIds.has(id));
    const removedAttachments = [...syncedIds]
      .filter((id) => !currentIds.has(id))
      .map((tamiasId) => ({
        tamiasId,
        providerId: syncedMapping[tamiasId] ?? null,
      }));

    if (newAttachmentIds.length === 0 && removedAttachments.length === 0) {
      continue;
    }

    results.push({
      transactionId: syncRecord.transactionId,
      providerTransactionId: syncRecord.providerTransactionId,
      syncRecordId: syncRecord.id,
      syncedAttachmentMapping: syncedMapping,
      currentAttachments: currentTransactionAttachments,
      newAttachmentIds,
      removedAttachments,
    });

    if (results.length >= limit) {
      break;
    }
  }

  return results;
};
