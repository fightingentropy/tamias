import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../client";
import type {
  DeleteInboxAccountResult,
  InboxAccountInfoRecord,
  InboxAccountListRecord,
  InboxAccountProvider,
  InboxAccountRecord,
  InboxAccountStatus,
  UpdateInboxAccountParams,
  UpsertInboxAccountParams,
  UpsertInboxAccountResult,
} from "../inbox-accounts";

type InboxAccountRow = {
  id: string;
  team_id: string;
  email: string;
  access_token: string | null;
  refresh_token: string | null;
  provider: InboxAccountProvider;
  external_id: string | null;
  expiry_date: string | null;
  last_accessed: string;
  schedule_id: string | null;
  status: InboxAccountStatus | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type InboxAccountDetailInput = InboxAccountRecord & {
  externalId?: string | null;
  scheduleId?: string | null;
  status?: InboxAccountStatus | null;
  errorMessage?: string | null;
  createdAt?: string;
};

type PatchInboxAccountD1Input = Omit<UpdateInboxAccountParams, "scheduleId" | "status"> & {
  externalId?: string | null;
  scheduleId?: string | null;
  status?: InboxAccountStatus | null;
};

export function getInboxAccountsD1(db: Database) {
  return requireCloudflareD1Database(db);
}

function toListRecord(row: InboxAccountRow): InboxAccountListRecord {
  return {
    id: row.id,
    email: row.email,
    provider: row.provider,
    lastAccessed: row.last_accessed,
    status: row.status ?? "connected",
    errorMessage: row.error_message,
  };
}

function toDetailRecord(row: InboxAccountRow): InboxAccountRecord | null {
  if (!row.access_token || !row.refresh_token || !row.expiry_date) {
    return null;
  }

  return {
    id: row.id,
    teamId: row.team_id,
    email: row.email,
    provider: row.provider,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiryDate: row.expiry_date,
    lastAccessed: row.last_accessed,
  };
}

function toInfoRecord(row: InboxAccountRow): InboxAccountInfoRecord {
  return {
    id: row.id,
    provider: row.provider,
    teamId: row.team_id,
    lastAccessed: row.last_accessed,
  };
}

export async function upsertInboxAccountDetailInD1(
  d1: CloudflareD1DatabaseBinding,
  account: InboxAccountDetailInput,
) {
  const now = new Date().toISOString();

  await d1
    .prepare(
      `insert or ignore into inbox_accounts (
        id,
        team_id,
        email,
        access_token,
        refresh_token,
        provider,
        external_id,
        expiry_date,
        last_accessed,
        schedule_id,
        status,
        error_message,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      account.id,
      account.teamId,
      account.email,
      account.accessToken,
      account.refreshToken,
      account.provider,
      account.externalId ?? null,
      account.expiryDate,
      account.lastAccessed,
      account.scheduleId ?? null,
      account.status ?? "connected",
      account.errorMessage ?? null,
      account.createdAt ?? now,
      now,
    )
    .run();

  await d1
    .prepare(
      `update inbox_accounts
       set team_id = ?,
           email = ?,
           access_token = ?,
           refresh_token = ?,
           provider = ?,
           expiry_date = ?,
           last_accessed = ?,
           updated_at = ?
       where id = ?`,
    )
    .bind(
      account.teamId,
      account.email,
      account.accessToken,
      account.refreshToken,
      account.provider,
      account.expiryDate,
      account.lastAccessed,
      now,
      account.id,
    )
    .run();

  await patchInboxAccountInD1(d1, {
    id: account.id,
    externalId: account.externalId,
    scheduleId: account.scheduleId,
    status: account.status,
    errorMessage: account.errorMessage,
  });
}

export async function getInboxAccountsFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: { teamId: string },
) {
  const { results = [] } = await d1
    .prepare(
      `select *
       from inbox_accounts
       where team_id = ?
       order by email asc`,
    )
    .bind(params.teamId)
    .all<InboxAccountRow>();

  return results.map(toListRecord);
}

export async function getInboxAccountsByIdsFromD1(d1: CloudflareD1DatabaseBinding, ids: string[]) {
  if (ids.length === 0) {
    return [];
  }

  const placeholders = ids.map(() => "?").join(", ");
  const { results = [] } = await d1
    .prepare(
      `select *
       from inbox_accounts
       where id in (${placeholders})`,
    )
    .bind(...ids)
    .all<InboxAccountRow>();

  return results.map(toListRecord);
}

export async function getInboxAccountByIdFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: { id: string; teamId: string },
) {
  const row = await d1
    .prepare("select * from inbox_accounts where id = ? and team_id = ? limit 1")
    .bind(params.id, params.teamId)
    .first<InboxAccountRow>();

  return row ? toDetailRecord(row) : null;
}

export async function getInboxAccountInfoFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: { id: string },
) {
  const row = await d1
    .prepare("select * from inbox_accounts where id = ? limit 1")
    .bind(params.id)
    .first<InboxAccountRow>();

  return row ? toInfoRecord(row) : null;
}

export async function patchInboxAccountInD1(
  d1: CloudflareD1DatabaseBinding,
  params: PatchInboxAccountD1Input,
) {
  const assignments: string[] = ["updated_at = ?"];
  const values: unknown[] = [new Date().toISOString()];

  if (params.accessToken !== undefined) {
    assignments.push("access_token = ?");
    values.push(params.accessToken);
  }

  if (params.refreshToken !== undefined) {
    assignments.push("refresh_token = ?");
    values.push(params.refreshToken);
  }

  if (params.expiryDate !== undefined) {
    assignments.push("expiry_date = ?");
    values.push(params.expiryDate);
  }

  if (params.scheduleId !== undefined) {
    assignments.push("schedule_id = ?");
    values.push(params.scheduleId);
  }

  if (params.lastAccessed !== undefined) {
    assignments.push("last_accessed = ?");
    values.push(params.lastAccessed);
  }

  if (params.status !== undefined) {
    assignments.push("status = ?");
    values.push(params.status);
  }

  if (params.errorMessage !== undefined) {
    assignments.push("error_message = ?");
    values.push(params.errorMessage);
  }

  if (params.externalId !== undefined) {
    assignments.push("external_id = ?");
    values.push(params.externalId);
  }

  if (assignments.length === 1) {
    return;
  }

  values.push(params.id);

  await d1
    .prepare(`update inbox_accounts set ${assignments.join(", ")} where id = ?`)
    .bind(...values)
    .run();
}

export async function deleteInboxAccountFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: { id: string; teamId: string },
): Promise<DeleteInboxAccountResult | null> {
  const row = await d1
    .prepare("select id, schedule_id from inbox_accounts where id = ? and team_id = ? limit 1")
    .bind(params.id, params.teamId)
    .first<{ id: string; schedule_id: string | null }>();

  if (!row) {
    return null;
  }

  await d1
    .prepare("delete from inbox_accounts where id = ? and team_id = ?")
    .bind(params.id, params.teamId)
    .run();

  return {
    id: row.id,
    scheduleId: row.schedule_id,
  };
}

export async function updateInboxAccountInD1(
  d1: CloudflareD1DatabaseBinding,
  params: UpdateInboxAccountParams,
) {
  const row = await d1
    .prepare("select id from inbox_accounts where id = ? limit 1")
    .bind(params.id)
    .first<{ id: string }>();

  if (!row) {
    return null;
  }

  await patchInboxAccountInD1(d1, params);

  return {
    id: row.id,
  };
}

export async function upsertInboxAccountInD1(
  d1: CloudflareD1DatabaseBinding,
  params: UpsertInboxAccountParams,
): Promise<UpsertInboxAccountResult> {
  const now = new Date().toISOString();
  const existing = await d1
    .prepare("select * from inbox_accounts where external_id = ? limit 1")
    .bind(params.externalId)
    .first<InboxAccountRow>();

  if (existing) {
    await d1
      .prepare(
        `update inbox_accounts
         set access_token = ?,
             refresh_token = ?,
             email = ?,
             last_accessed = ?,
             expiry_date = ?,
             status = ?,
             error_message = ?,
             updated_at = ?
         where id = ?`,
      )
      .bind(
        params.accessToken,
        params.refreshToken,
        params.email,
        params.lastAccessed,
        params.expiryDate,
        "connected",
        null,
        now,
        existing.id,
      )
      .run();

    return {
      id: existing.id,
      provider: existing.provider,
      external_id: existing.external_id ?? params.externalId,
    };
  }

  const id = crypto.randomUUID();
  await upsertInboxAccountDetailInD1(d1, {
    id,
    teamId: params.teamId,
    email: params.email,
    provider: params.provider,
    accessToken: params.accessToken,
    refreshToken: params.refreshToken,
    expiryDate: params.expiryDate,
    lastAccessed: params.lastAccessed,
    externalId: params.externalId,
    status: "connected",
    errorMessage: null,
    createdAt: now,
  });

  return {
    id,
    provider: params.provider,
    external_id: params.externalId,
  };
}
