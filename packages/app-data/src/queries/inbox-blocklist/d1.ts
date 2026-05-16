import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../client";
import type {
  CreateInboxBlocklistParams,
  DeleteInboxBlocklistParams,
  InboxBlocklistRecord,
} from "../inbox-blocklist";

type InboxBlocklistRow = {
  id: string;
  team_id: string;
  type: InboxBlocklistRecord["type"];
  value: string;
  normalized_value: string;
  created_at: string;
  updated_at: string;
};

export function getInboxBlocklistD1(db: Database) {
  return requireCloudflareD1Database(db);
}

function normalizeBlocklistValue(value: string) {
  return value.trim().toLowerCase();
}

function toInboxBlocklistRecord(row: InboxBlocklistRow): InboxBlocklistRecord {
  return {
    id: row.id,
    teamId: row.team_id,
    type: row.type,
    value: row.value,
    createdAt: row.created_at,
  };
}

export async function upsertInboxBlocklistInD1(
  d1: CloudflareD1DatabaseBinding,
  entry: InboxBlocklistRecord,
) {
  const normalizedValue = normalizeBlocklistValue(entry.value);

  await d1
    .prepare(
      `delete from inbox_blocklist
       where team_id = ?
         and type = ?
         and normalized_value = ?
         and id != ?`,
    )
    .bind(entry.teamId, entry.type, normalizedValue, entry.id)
    .run();

  await d1
    .prepare(
      `insert into inbox_blocklist (
        id,
        team_id,
        type,
        value,
        normalized_value,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        team_id = excluded.team_id,
        type = excluded.type,
        value = excluded.value,
        normalized_value = excluded.normalized_value,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at`,
    )
    .bind(
      entry.id,
      entry.teamId,
      entry.type,
      entry.value,
      normalizedValue,
      entry.createdAt,
      new Date().toISOString(),
    )
    .run();
}

async function getInboxBlocklistEntryByValueFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: CreateInboxBlocklistParams,
) {
  const row = await d1
    .prepare(
      `select *
       from inbox_blocklist
       where team_id = ?
         and type = ?
         and normalized_value = ?
       limit 1`,
    )
    .bind(params.teamId, params.type, normalizeBlocklistValue(params.value))
    .first<InboxBlocklistRow>();

  return row ? toInboxBlocklistRecord(row) : null;
}

export async function createInboxBlocklistInD1(
  d1: CloudflareD1DatabaseBinding,
  params: CreateInboxBlocklistParams,
) {
  const value = params.value.trim();
  const normalizedValue = normalizeBlocklistValue(value);

  if (!normalizedValue) {
    throw new Error("Inbox blocklist value is required");
  }

  const existing = await getInboxBlocklistEntryByValueFromD1(d1, {
    ...params,
    value,
  });

  if (existing) {
    return existing;
  }

  const entry: InboxBlocklistRecord = {
    id: crypto.randomUUID(),
    teamId: params.teamId,
    type: params.type,
    value,
    createdAt: new Date().toISOString(),
  };

  await upsertInboxBlocklistInD1(d1, entry);

  return entry;
}

export async function getInboxBlocklistFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: { teamId: string },
) {
  const { results = [] } = await d1
    .prepare(
      `select *
       from inbox_blocklist
       where team_id = ?
       order by created_at asc`,
    )
    .bind(params.teamId)
    .all<InboxBlocklistRow>();

  return results.map(toInboxBlocklistRecord);
}

export async function deleteInboxBlocklistRecordFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: DeleteInboxBlocklistParams,
) {
  const row = await d1
    .prepare("select * from inbox_blocklist where id = ? and team_id = ? limit 1")
    .bind(params.id, params.teamId)
    .first<InboxBlocklistRow>();

  if (!row) {
    return null;
  }

  await d1
    .prepare("delete from inbox_blocklist where id = ? and team_id = ?")
    .bind(params.id, params.teamId)
    .run();

  return toInboxBlocklistRecord(row);
}
