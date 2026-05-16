import type { Database, DatabaseOrTransaction } from "../../client";
import {
  deleteAccountingSyncRecordsInD1,
  getAccountingSyncD1,
  getAccountingSyncStatusFromD1,
  type AccountingSyncProvider,
  type AccountingSyncRecord,
  type AccountingSyncStatus,
  upsertAccountingSyncRecordInD1,
  updateSyncedAttachmentMappingInD1,
} from "./d1";

export type { AccountingSyncProvider, AccountingSyncRecord, AccountingSyncStatus } from "./d1";

function requireAccountingSyncD1(db: Database) {
  const d1 = getAccountingSyncD1(db);

  if (!d1) {
    throw new Error("Accounting sync records require Cloudflare D1");
  }

  return d1;
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
  db: Database,
  params: CreateAccountingSyncRecordParams,
) => {
  return upsertAccountingSyncRecordInD1(requireAccountingSyncD1(db), {
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
  db: Database,
  params: GetSyncedTransactionIdsParams,
): Promise<string[]> => {
  const records = await getAccountingSyncStatusFromD1(requireAccountingSyncD1(db), {
    teamId: params.teamId,
    provider: params.provider,
  });

  return [
    ...new Set(
      records.filter((record) => record.status === "synced").map((record) => record.transactionId),
    ),
  ];
};

export type GetSyncStatusParams = {
  teamId: string;
  transactionIds?: string[];
  provider?: AccountingSyncProvider;
};

export const getAccountingSyncStatus = async (
  db: Database,
  params: GetSyncStatusParams,
): Promise<AccountingSyncRecord[]> => {
  return getAccountingSyncStatusFromD1(requireAccountingSyncD1(db), {
    teamId: params.teamId,
    transactionIds: params.transactionIds,
    provider: params.provider,
  });
};

export async function deleteAccountingSyncRecordsForTransactions(
  db: DatabaseOrTransaction,
  params: {
    teamId: string;
    transactionIds: string[];
    provider?: AccountingSyncProvider;
  },
) {
  return deleteAccountingSyncRecordsInD1(requireAccountingSyncD1(db), {
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
  db: Database,
  params: UpdateSyncedAttachmentMappingParams,
) => {
  return updateSyncedAttachmentMappingInD1(requireAccountingSyncD1(db), {
    syncRecordId: params.syncRecordId,
    syncedAttachmentMapping: params.syncedAttachmentMapping,
    status: params.status,
    errorMessage: params.errorMessage,
    errorCode: params.errorCode,
  });
};
