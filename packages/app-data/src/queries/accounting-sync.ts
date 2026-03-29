import {
  deleteAccountingSyncRecordsInConvex,
  getAccountingSyncStatusFromConvex,
  getTransactionAttachmentsByIdsFromConvex,
  getTransactionAttachmentsForTransactionIdsFromConvex,
  getTransactionsByIdsFromConvex,
  getTransactionsPageFromConvex,
  type AccountingSyncProvider,
  type AccountingSyncRecord,
  type AccountingSyncStatus,
  type TransactionRecord,
  type TransactionStatus,
  upsertAccountingSyncRecordInConvex,
  updateSyncedAttachmentMappingInConvex,
} from "@tamias/app-data-convex";
import type { Database, DatabaseOrTransaction } from "../client";
import { getTransactionCategoryContext } from "./index";

export type { AccountingSyncRecord };

const ACCOUNTING_SYNC_EXCLUDED_STATUSES: TransactionStatus[] = [
  "excluded",
  "archived",
];
const ACCOUNTING_SYNC_EXCLUDED_STATUS_SET = new Set<TransactionStatus>(
  ACCOUNTING_SYNC_EXCLUDED_STATUSES,
);

function compareTransactionsByDateDesc(
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

async function getRecentUnsyncedTransactions(args: {
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
      statusesNotIn: [...ACCOUNTING_SYNC_EXCLUDED_STATUSES],
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

export type CreateAccountingSyncRecordParams = {
  transactionId: string;
  teamId: string;
  provider: AccountingSyncProvider;
  providerTenantId: string;
  providerTransactionId?: string;
  syncedAttachmentMapping?: Record<string, string | null>;
  syncType?: "manual";
  status?: AccountingSyncStatus;
  errorMessage?: string;
  errorCode?: string;
  providerEntityType?: string;
};

export const upsertAccountingSyncRecord = async (
  _db: Database,
  params: CreateAccountingSyncRecordParams,
) => {
  return upsertAccountingSyncRecordInConvex({
    teamId: params.teamId,
    transactionId: params.transactionId,
    provider: params.provider,
    providerTenantId: params.providerTenantId,
    providerTransactionId: params.providerTransactionId,
    syncedAttachmentMapping: params.syncedAttachmentMapping,
    syncType: params.syncType,
    status: params.status,
    errorMessage: params.errorMessage,
    errorCode: params.errorCode,
    providerEntityType: params.providerEntityType,
  });
};

export type GetSyncedTransactionIdsParams = {
  teamId: string;
  provider: AccountingSyncProvider;
};

export const getSyncedTransactionIds = async (
  _db: Database,
  params: GetSyncedTransactionIdsParams,
): Promise<string[]> => {
  const records = await getAccountingSyncStatusFromConvex({
    teamId: params.teamId,
    provider: params.provider,
  });

  return [...new Set(
    records
      .filter((record) => record.status === "synced")
      .map((record) => record.transactionId),
  )];
};

export type GetSyncStatusParams = {
  teamId: string;
  transactionIds?: string[];
  provider?: AccountingSyncProvider;
};

export const getAccountingSyncStatus = async (
  _db: Database,
  params: GetSyncStatusParams,
) => {
  return getAccountingSyncStatusFromConvex({
    teamId: params.teamId,
    transactionIds: params.transactionIds,
    provider: params.provider,
  });
};

export async function deleteAccountingSyncRecordsForTransactions(
  _db: DatabaseOrTransaction,
  params: {
    teamId: string;
    transactionIds: string[];
    provider?: AccountingSyncProvider;
  },
) {
  return deleteAccountingSyncRecordsInConvex({
    teamId: params.teamId,
    transactionIds: params.transactionIds,
    provider: params.provider,
  });
}

export type GetUnsyncedTransactionsParams = {
  teamId: string;
  provider: AccountingSyncProvider;
  transactionIds?: string[];
  limit?: number;
};

export const getUnsyncedTransactionIds = async (
  db: Database,
  params: GetUnsyncedTransactionsParams,
  allTransactionIds: string[],
): Promise<string[]> => {
  if (allTransactionIds.length === 0) return [];

  const syncedIds = await getSyncedTransactionIds(db, {
    teamId: params.teamId,
    provider: params.provider,
  });

  const syncedSet = new Set(syncedIds);
  return allTransactionIds.filter((id) => !syncedSet.has(id));
};

export type TransactionForSync = {
  id: string;
  date: string;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  categorySlug: string | null;
  categoryReportingCode: string | null;
  counterpartyName: string | null;
  status: string | null;
  taxAmount: number | null;
  taxRate: number | null;
  taxType: string | null;
  categoryTaxRate: number | null;
  categoryTaxType: string | null;
  note: string | null;
  attachments: Array<{
    id: string;
    name: string | null;
    path: string[] | null;
    type: string | null;
    size: number | null;
  }>;
};

export type GetTransactionsForAccountingSyncParams = {
  teamId: string;
  provider: AccountingSyncProvider;
  transactionIds?: string[];
  sinceDaysAgo?: number;
  limit?: number;
};

export const getTransactionsForAccountingSync = async (
  db: Database,
  params: GetTransactionsForAccountingSyncParams,
): Promise<TransactionForSync[]> => {
  const {
    teamId,
    provider,
    transactionIds,
    sinceDaysAgo = 30,
    limit = 500,
  } = params;
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - sinceDaysAgo);
  const sinceDateStr = sinceDate.toISOString().split("T")[0]!;
  const syncedIds =
    transactionIds && transactionIds.length > 0
      ? []
      : await getSyncedTransactionIds(db, { teamId, provider });
  const syncedIdSet = new Set(syncedIds);
  const results =
    transactionIds && transactionIds.length > 0
      ? (
          await getTransactionsByIdsFromConvex({
            teamId,
            transactionIds,
          })
        )
          .filter(
            (transaction) =>
              !ACCOUNTING_SYNC_EXCLUDED_STATUS_SET.has(transaction.status),
          )
          .sort(compareTransactionsByDateDesc)
          .slice(0, limit)
      : await getRecentUnsyncedTransactions({
          teamId,
          dateGte: sinceDateStr,
          limit,
          syncedIdSet,
        });

  const categoryContext = await getTransactionCategoryContext(db, teamId);

  const attachments = await getTransactionAttachmentsForTransactionIdsFromConvex({
    teamId,
    transactionIds: results.map((result) => result.id),
  });
  const attachmentsByTransactionId = new Map<
    string,
    TransactionForSync["attachments"]
  >();

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

  return results
    .map((result) => ({
      ...result,
      categoryReportingCode:
        result.categorySlug
          ? categoryContext.bySlug.get(result.categorySlug)?.taxReportingCode ??
            null
          : null,
      categoryTaxRate:
        result.categorySlug
          ? categoryContext.bySlug.get(result.categorySlug)?.taxRate ?? null
          : null,
      categoryTaxType:
        result.categorySlug
          ? categoryContext.bySlug.get(result.categorySlug)?.taxType ?? null
          : null,
      attachments: attachmentsByTransactionId.get(result.id) ?? [],
    }))
    .filter(
      (result) =>
        result.attachments.length > 0 || result.status === "completed",
    );
};

export type GetTransactionAttachmentsParams = {
  teamId: string;
  attachmentIds: string[];
};

export const getTransactionAttachmentsForSync = async (
  _db: Database,
  params: GetTransactionAttachmentsParams,
) => {
  const { teamId, attachmentIds } = params;

  if (attachmentIds.length === 0) return [];

  return getTransactionAttachmentsByIdsFromConvex({
    teamId,
    attachmentIds,
  });
};

export type TransactionWithAttachmentChanges = {
  transactionId: string;
  providerTransactionId: string;
  syncRecordId: string;
  syncedAttachmentMapping: Record<string, string | null>;
  currentAttachments: Array<{
    id: string;
    name: string | null;
    path: string[] | null;
    type: string | null;
    size: number | null;
  }>;
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
  db: Database,
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

  const transactionIds = [...new Set(syncRecords.map((record) => record.transactionId))];
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

  const currentAttachmentRecords =
    await getTransactionAttachmentsForTransactionIdsFromConvex({
      teamId,
      transactionIds: currentTransactions.map((row) => row.transactionId),
    });
  const attachmentsByTransactionId = new Map<
    string,
    Array<{
      id: string;
      name: string | null;
      path: string[] | null;
      type: string | null;
      size: number | null;
    }>
  >();

  for (const attachment of currentAttachmentRecords) {
    if (!attachment.transactionId) {
      continue;
    }

    const current =
      attachmentsByTransactionId.get(attachment.transactionId) ?? [];
    current.push({
      id: attachment.id,
      name: attachment.name,
      path: attachment.path,
      type: attachment.type,
      size: attachment.size,
    });
    attachmentsByTransactionId.set(attachment.transactionId, current);
  }

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

export type UpdateSyncedAttachmentMappingParams = {
  syncRecordId: string;
  syncedAttachmentMapping: Record<string, string | null>;
  status?: "synced" | "partial" | "failed";
  errorMessage?: string | null;
  errorCode?: string | null;
};

export const updateSyncedAttachmentMapping = async (
  _db: Database,
  params: UpdateSyncedAttachmentMappingParams,
) => {
  return updateSyncedAttachmentMappingInConvex({
    syncRecordId: params.syncRecordId,
    syncedAttachmentMapping: params.syncedAttachmentMapping,
    status: params.status,
    errorMessage: params.errorMessage,
    errorCode: params.errorCode,
  });
};
