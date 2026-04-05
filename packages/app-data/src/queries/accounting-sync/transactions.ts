import {
  getTransactionAttachmentsByIdsFromConvex,
  getTransactionsByIdsFromConvex,
  type AccountingSyncProvider,
} from "../../convex";
import type { Database } from "../../client";
import { getTransactionCategoryContext } from "../transaction-categories";
import { getSyncedTransactionIds } from "./records";
import {
  ACCOUNTING_SYNC_EXCLUDED_STATUS_SET,
  getAttachmentsByTransactionId,
  getRecentUnsyncedTransactions,
  type AccountingSyncAttachment,
  compareTransactionsByDateDesc,
} from "./shared";

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
  if (allTransactionIds.length === 0) {
    return [];
  }

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
  attachments: AccountingSyncAttachment[];
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
  const attachmentsByTransactionId = await getAttachmentsByTransactionId({
    teamId,
    transactionIds: results.map((result) => result.id),
  });

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

  if (attachmentIds.length === 0) {
    return [];
  }

  return getTransactionAttachmentsByIdsFromConvex({
    teamId,
    attachmentIds,
  });
};
