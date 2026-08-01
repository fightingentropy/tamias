import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../client";

export type AccountingSyncProvider = "quickbooks" | "fortnox";
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

type AccountingSyncRecordRow = {
  id: string;
  transaction_id: string;
  team_id: string;
  provider: AccountingSyncProvider;
  provider_tenant_id: string;
  provider_transaction_id: string | null;
  synced_attachment_mapping_json: string | null;
  synced_at: string;
  sync_type: "manual" | null;
  status: AccountingSyncStatus;
  error_message: string | null;
  error_code: string | null;
  provider_entity_type: string | null;
  created_at: string;
};

export type UpsertAccountingSyncRecordInD1Params = {
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
};

export type GetAccountingSyncStatusFromD1Params = {
  teamId: string;
  transactionIds?: string[];
  provider?: AccountingSyncProvider;
};

export type DeleteAccountingSyncRecordsInD1Params = {
  teamId: string;
  transactionIds: string[];
  provider?: AccountingSyncProvider;
};

export type UpdateSyncedAttachmentMappingInD1Params = {
  syncRecordId: string;
  syncedAttachmentMapping: Record<string, string | null>;
  status?: Exclude<AccountingSyncStatus, "pending">;
  errorMessage?: string | null;
  errorCode?: string | null;
};

export function getAccountingSyncD1(db: Database) {
  return requireCloudflareD1Database(db);
}

function parseSyncedAttachmentMapping(value: string | null) {
  if (!value) {
    return {};
  }

  const parsed = JSON.parse(value) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }

  return parsed as Record<string, string | null>;
}

function serializeSyncedAttachmentMapping(value: Record<string, string | null> | undefined) {
  return JSON.stringify(value ?? {});
}

function toAccountingSyncRecord(row: AccountingSyncRecordRow): AccountingSyncRecord {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    teamId: row.team_id,
    provider: row.provider,
    providerTenantId: row.provider_tenant_id,
    providerTransactionId: row.provider_transaction_id,
    syncedAttachmentMapping: parseSyncedAttachmentMapping(row.synced_attachment_mapping_json),
    syncedAt: row.synced_at,
    syncType: row.sync_type,
    status: row.status,
    errorMessage: row.error_message,
    errorCode: row.error_code,
    providerEntityType: row.provider_entity_type,
    createdAt: row.created_at,
  };
}

async function getAccountingSyncRecordByIdFromD1(d1: CloudflareD1DatabaseBinding, id: string) {
  const row = await d1
    .prepare("select * from accounting_sync_records where id = ? limit 1")
    .bind(id)
    .first<AccountingSyncRecordRow>();

  return row ? toAccountingSyncRecord(row) : null;
}

async function getAccountingSyncRecordByTransactionProviderFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: {
    teamId: string;
    transactionId: string;
    provider: AccountingSyncProvider;
  },
) {
  const row = await d1
    .prepare(
      `select * from accounting_sync_records
       where team_id = ? and provider = ? and transaction_id = ?
       limit 1`,
    )
    .bind(params.teamId, params.provider, params.transactionId)
    .first<AccountingSyncRecordRow>();

  return row ? toAccountingSyncRecord(row) : null;
}

async function getAccountingSyncRecordsForTransactionFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: {
    teamId: string;
    transactionId: string;
  },
) {
  const result = await d1
    .prepare(
      `select * from accounting_sync_records
       where team_id = ? and transaction_id = ?`,
    )
    .bind(params.teamId, params.transactionId)
    .all<AccountingSyncRecordRow>();

  return (result.results ?? []).map(toAccountingSyncRecord);
}

export async function upsertAccountingSyncRecordInD1(
  d1: CloudflareD1DatabaseBinding,
  params: UpsertAccountingSyncRecordInD1Params,
) {
  const existing = await getAccountingSyncRecordByTransactionProviderFromD1(d1, {
    teamId: params.teamId,
    transactionId: params.transactionId,
    provider: params.provider,
  });
  const timestamp = new Date().toISOString();
  const syncedAt = params.syncedAt ?? timestamp;
  const status = params.status ?? "synced";
  const errorMessage = status === "synced" ? null : (params.errorMessage ?? null);
  const errorCode = status === "synced" ? null : (params.errorCode ?? null);

  if (existing) {
    await d1
      .prepare(
        `update accounting_sync_records
         set provider_tenant_id = ?,
             provider_transaction_id = ?,
             synced_attachment_mapping_json = ?,
             synced_at = ?,
             sync_type = ?,
             status = ?,
             error_message = ?,
             error_code = ?,
             provider_entity_type = ?
         where id = ?`,
      )
      .bind(
        params.providerTenantId,
        params.providerTransactionId ?? null,
        serializeSyncedAttachmentMapping(params.syncedAttachmentMapping),
        syncedAt,
        params.syncType ?? null,
        status,
        errorMessage,
        errorCode,
        params.providerEntityType ?? null,
        existing.id,
      )
      .run();

    const updated = await getAccountingSyncRecordByIdFromD1(d1, existing.id);

    if (!updated) {
      throw new Error("Failed to update accounting sync record");
    }

    return updated;
  }

  const id = params.id ?? crypto.randomUUID();
  await d1
    .prepare(
      `insert into accounting_sync_records (
        id,
        transaction_id,
        team_id,
        provider,
        provider_tenant_id,
        provider_transaction_id,
        synced_attachment_mapping_json,
        synced_at,
        sync_type,
        status,
        error_message,
        error_code,
        provider_entity_type,
        created_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      params.transactionId,
      params.teamId,
      params.provider,
      params.providerTenantId,
      params.providerTransactionId ?? null,
      serializeSyncedAttachmentMapping(params.syncedAttachmentMapping),
      syncedAt,
      params.syncType ?? null,
      status,
      errorMessage,
      errorCode,
      params.providerEntityType ?? null,
      params.createdAt ?? timestamp,
    )
    .run();

  const inserted = await getAccountingSyncRecordByIdFromD1(d1, id);

  if (!inserted) {
    throw new Error("Failed to create accounting sync record");
  }

  return inserted;
}

export async function getAccountingSyncStatusFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: GetAccountingSyncStatusFromD1Params,
) {
  let records: AccountingSyncRecord[];

  if (params.transactionIds && params.transactionIds.length > 0) {
    const transactionIds = [...new Set(params.transactionIds)];

    if (params.provider) {
      records = (
        await Promise.all(
          transactionIds.map((transactionId) =>
            getAccountingSyncRecordByTransactionProviderFromD1(d1, {
              teamId: params.teamId,
              transactionId,
              provider: params.provider!,
            }),
          ),
        )
      ).flatMap((record) => (record ? [record] : []));
    } else {
      records = (
        await Promise.all(
          transactionIds.map((transactionId) =>
            getAccountingSyncRecordsForTransactionFromD1(d1, {
              teamId: params.teamId,
              transactionId,
            }),
          ),
        )
      ).flat();
    }
  } else if (params.provider) {
    const result = await d1
      .prepare(
        `select * from accounting_sync_records
         where team_id = ? and provider = ?`,
      )
      .bind(params.teamId, params.provider)
      .all<AccountingSyncRecordRow>();
    records = (result.results ?? []).map(toAccountingSyncRecord);
  } else {
    const result = await d1
      .prepare("select * from accounting_sync_records where team_id = ?")
      .bind(params.teamId)
      .all<AccountingSyncRecordRow>();
    records = (result.results ?? []).map(toAccountingSyncRecord);
  }

  return records.sort((left, right) => right.syncedAt.localeCompare(left.syncedAt));
}

export async function deleteAccountingSyncRecordsInD1(
  d1: CloudflareD1DatabaseBinding,
  params: DeleteAccountingSyncRecordsInD1Params,
) {
  if (params.transactionIds.length === 0) {
    return { count: 0 };
  }

  const transactionIds = [...new Set(params.transactionIds)];
  const records = (
    await Promise.all(
      transactionIds.map((transactionId) =>
        params.provider
          ? getAccountingSyncRecordByTransactionProviderFromD1(d1, {
              teamId: params.teamId,
              transactionId,
              provider: params.provider,
            }).then((record) => (record ? [record] : []))
          : getAccountingSyncRecordsForTransactionFromD1(d1, {
              teamId: params.teamId,
              transactionId,
            }),
      ),
    )
  ).flat();

  for (const record of records) {
    await d1.prepare("delete from accounting_sync_records where id = ?").bind(record.id).run();
  }

  return { count: records.length };
}

export async function updateSyncedAttachmentMappingInD1(
  d1: CloudflareD1DatabaseBinding,
  params: UpdateSyncedAttachmentMappingInD1Params,
) {
  const existing = await getAccountingSyncRecordByIdFromD1(d1, params.syncRecordId);

  if (!existing) {
    return null;
  }

  await d1
    .prepare(
      `update accounting_sync_records
       set synced_attachment_mapping_json = ?,
           synced_at = ?,
           status = coalesce(?, status),
           error_message = case when ? = 1 then ? else error_message end,
           error_code = case when ? = 1 then ? else error_code end
       where id = ?`,
    )
    .bind(
      serializeSyncedAttachmentMapping(params.syncedAttachmentMapping),
      new Date().toISOString(),
      params.status ?? null,
      params.errorMessage !== undefined ? 1 : 0,
      params.errorMessage ?? null,
      params.errorCode !== undefined ? 1 : 0,
      params.errorCode ?? null,
      params.syncRecordId,
    )
    .run();

  const updated = await getAccountingSyncRecordByIdFromD1(d1, params.syncRecordId);

  if (!updated) {
    throw new Error("Failed to update accounting sync record");
  }

  return updated;
}
