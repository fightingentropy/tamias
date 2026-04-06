import {
  deleteAccountingSyncRecordsInConvex,
  getAccountingSyncStatusFromConvex,
  type AccountingSyncProvider,
  type AccountingSyncStatus,
  upsertAccountingSyncRecordInConvex,
  updateSyncedAttachmentMappingInConvex,
} from "@tamias/app-data-convex";
import type { Database, DatabaseOrTransaction } from "../../client";

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

  return [
    ...new Set(
      records
        .filter((record) => record.status === "synced")
        .map((record) => record.transactionId),
    ),
  ];
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
