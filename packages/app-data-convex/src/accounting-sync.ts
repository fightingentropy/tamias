import { api, createClient, serviceArgs } from "./base";

const apiWithAccountingSync = api as typeof api & {
  accountingSync: {
    serviceGetAccountingSyncStatus: any;
    serviceUpsertAccountingSyncRecord: any;
    serviceDeleteAccountingSyncRecords: any;
    serviceUpdateSyncedAttachmentMapping: any;
  };
};

export type AccountingSyncProvider = "xero" | "quickbooks" | "fortnox";
export type AccountingSyncStatus = "synced" | "partial" | "failed" | "pending";

export type AccountingSyncRecord = {
  id: string;
  transactionId: string;
  teamId: string;
  provider: AccountingSyncProvider;
  providerTenantId: string;
  providerTransactionId: string | null;
  syncedAttachmentMapping: Record<string, string | null>;
  syncedAt: string;
  syncType: "manual" | null;
  status: AccountingSyncStatus;
  errorMessage: string | null;
  errorCode: string | null;
  providerEntityType: string | null;
  createdAt: string;
};

export async function getAccountingSyncStatusFromConvex(args: {
  teamId: string;
  transactionIds?: string[];
  provider?: AccountingSyncProvider;
}) {
  return createClient().query(
    apiWithAccountingSync.accountingSync.serviceGetAccountingSyncStatus,
    serviceArgs({
      publicTeamId: args.teamId,
      transactionIds: args.transactionIds,
      provider: args.provider,
    }),
  ) as Promise<AccountingSyncRecord[]>;
}

export async function upsertAccountingSyncRecordInConvex(args: {
  id?: string;
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
  createdAt?: string;
  syncedAt?: string;
}) {
  return createClient().mutation(
    apiWithAccountingSync.accountingSync.serviceUpsertAccountingSyncRecord,
    serviceArgs({
      publicSyncRecordId: args.id,
      publicTeamId: args.teamId,
      transactionId: args.transactionId,
      provider: args.provider,
      providerTenantId: args.providerTenantId,
      providerTransactionId: args.providerTransactionId,
      syncedAttachmentMapping: args.syncedAttachmentMapping,
      syncType: args.syncType,
      status: args.status,
      errorMessage: args.errorMessage,
      errorCode: args.errorCode,
      providerEntityType: args.providerEntityType,
      createdAt: args.createdAt,
      syncedAt: args.syncedAt,
    }),
  ) as Promise<AccountingSyncRecord>;
}

export async function deleteAccountingSyncRecordsInConvex(args: {
  teamId: string;
  transactionIds: string[];
  provider?: AccountingSyncProvider;
}) {
  return createClient().mutation(
    apiWithAccountingSync.accountingSync.serviceDeleteAccountingSyncRecords,
    serviceArgs({
      publicTeamId: args.teamId,
      transactionIds: args.transactionIds,
      provider: args.provider,
    }),
  ) as Promise<{ count: number }>;
}

export async function updateSyncedAttachmentMappingInConvex(args: {
  syncRecordId: string;
  syncedAttachmentMapping: Record<string, string | null>;
  status?: Exclude<AccountingSyncStatus, "pending">;
  errorMessage?: string | null;
  errorCode?: string | null;
}) {
  return createClient().mutation(
    apiWithAccountingSync.accountingSync.serviceUpdateSyncedAttachmentMapping,
    serviceArgs({
      syncRecordId: args.syncRecordId,
      syncedAttachmentMapping: args.syncedAttachmentMapping,
      status: args.status,
      errorMessage: args.errorMessage,
      errorCode: args.errorCode,
    }),
  ) as Promise<AccountingSyncRecord | null>;
}
