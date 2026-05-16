import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../client";
import type {
  CreateInvoiceTemplateParams,
  InvoiceTemplateDeleteResult,
  InvoiceTemplateRecord,
  UpsertInvoiceTemplateParams,
} from "../invoice-templates";

type InvoiceTemplateRow = {
  id: string;
  team_id: string;
  name: string;
  is_default: number;
  data_json: string;
  created_at: string;
  updated_at: string;
};

type InvoiceTemplateData = Omit<
  InvoiceTemplateRecord,
  "id" | "name" | "isDefault" | "createdAt" | "updatedAt"
>;

export function getInvoiceTemplatesD1(db: Database) {
  return requireCloudflareD1Database(db);
}

function stripUndefinedValues<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, Exclude<unknown, undefined>] => {
      return entry[1] !== undefined;
    }),
  ) as Partial<T>;
}

function parseTemplateData(value: string): InvoiceTemplateData {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as InvoiceTemplateData)
      : {};
  } catch {
    return {};
  }
}

function templateDataFromRecord(record: InvoiceTemplateRecord): InvoiceTemplateData {
  const {
    id: _id,
    name: _name,
    isDefault: _isDefault,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...data
  } = record;
  return stripUndefinedValues(data) as InvoiceTemplateData;
}

function templateDataFromCreateParams(params: CreateInvoiceTemplateParams): InvoiceTemplateData {
  const {
    teamId: _teamId,
    name: _name,
    isDefault: _isDefault,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...data
  } = params;
  return stripUndefinedValues(data) as InvoiceTemplateData;
}

function templateDataFromUpsertParams(params: UpsertInvoiceTemplateParams): InvoiceTemplateData {
  const {
    id: _id,
    teamId: _teamId,
    name: _name,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...data
  } = params;
  return stripUndefinedValues(data) as InvoiceTemplateData;
}

function toInvoiceTemplateRecord(row: InvoiceTemplateRow): InvoiceTemplateRecord {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.is_default === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...parseTemplateData(row.data_json),
  };
}

async function unsetDefaultTemplatesInD1(
  d1: CloudflareD1DatabaseBinding,
  teamId: string,
  ignoreId?: string,
) {
  const timestamp = new Date().toISOString();
  const query = ignoreId
    ? "update invoice_templates set is_default = 0, updated_at = ? where team_id = ? and is_default = 1 and id != ?"
    : "update invoice_templates set is_default = 0, updated_at = ? where team_id = ? and is_default = 1";
  const statement = d1.prepare(query);

  if (ignoreId) {
    await statement.bind(timestamp, teamId, ignoreId).run();
    return;
  }

  await statement.bind(timestamp, teamId).run();
}

export async function upsertInvoiceTemplateRecordInD1(
  d1: CloudflareD1DatabaseBinding,
  teamId: string,
  record: InvoiceTemplateRecord,
) {
  const timestamp = new Date().toISOString();
  const createdAt = record.createdAt ?? timestamp;
  const updatedAt = record.updatedAt ?? timestamp;

  if (record.isDefault) {
    await unsetDefaultTemplatesInD1(d1, teamId, record.id);
  }

  await d1
    .prepare(
      `insert into invoice_templates (
        id,
        team_id,
        name,
        is_default,
        data_json,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        team_id = excluded.team_id,
        name = excluded.name,
        is_default = excluded.is_default,
        data_json = excluded.data_json,
        updated_at = excluded.updated_at`,
    )
    .bind(
      record.id,
      teamId,
      record.name,
      record.isDefault ? 1 : 0,
      JSON.stringify(templateDataFromRecord(record)),
      createdAt,
      updatedAt,
    )
    .run();
}

export async function getInvoiceTemplatesFromD1(d1: CloudflareD1DatabaseBinding, teamId: string) {
  const { results = [] } = await d1
    .prepare(
      `select *
      from invoice_templates
      where team_id = ?
      order by is_default desc, name asc`,
    )
    .bind(teamId)
    .all<InvoiceTemplateRow>();

  return results.map(toInvoiceTemplateRecord);
}

export async function getInvoiceTemplateByIdFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: { id: string; teamId: string },
) {
  const row = await d1
    .prepare("select * from invoice_templates where id = ? and team_id = ? limit 1")
    .bind(params.id, params.teamId)
    .first<InvoiceTemplateRow>();

  return row ? toInvoiceTemplateRecord(row) : null;
}

export async function getDefaultInvoiceTemplateFromD1(
  d1: CloudflareD1DatabaseBinding,
  teamId: string,
) {
  const defaultRow = await d1
    .prepare("select * from invoice_templates where team_id = ? and is_default = 1 limit 1")
    .bind(teamId)
    .first<InvoiceTemplateRow>();

  if (defaultRow) {
    return toInvoiceTemplateRecord(defaultRow);
  }

  const firstRow = await d1
    .prepare("select * from invoice_templates where team_id = ? order by created_at asc limit 1")
    .bind(teamId)
    .first<InvoiceTemplateRow>();

  return firstRow ? toInvoiceTemplateRecord(firstRow) : null;
}

export async function getInvoiceTemplateCountFromD1(
  d1: CloudflareD1DatabaseBinding,
  teamId: string,
) {
  return (
    (await d1
      .prepare("select count(*) as count from invoice_templates where team_id = ?")
      .bind(teamId)
      .first<number>("count")) ?? 0
  );
}

export async function createInvoiceTemplateInD1(
  d1: CloudflareD1DatabaseBinding,
  params: CreateInvoiceTemplateParams,
) {
  const timestamp = new Date().toISOString();
  const count = await getInvoiceTemplateCountFromD1(d1, params.teamId);
  const isDefault = count === 0 || (params.isDefault ?? false);
  const record: InvoiceTemplateRecord = {
    id: crypto.randomUUID(),
    name: params.name,
    isDefault,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...templateDataFromCreateParams(params),
  };

  await upsertInvoiceTemplateRecordInD1(d1, params.teamId, record);

  return record;
}

export async function upsertInvoiceTemplateInD1(
  d1: CloudflareD1DatabaseBinding,
  params: UpsertInvoiceTemplateParams,
) {
  const incomingData = templateDataFromUpsertParams(params);

  if (params.id) {
    const existing = await getInvoiceTemplateByIdFromD1(d1, {
      id: params.id,
      teamId: params.teamId,
    });

    if (!existing) {
      throw new Error("Template not found");
    }

    const record: InvoiceTemplateRecord = {
      ...existing,
      ...incomingData,
      name: params.name ?? existing.name,
      updatedAt: new Date().toISOString(),
    };

    await upsertInvoiceTemplateRecordInD1(d1, params.teamId, record);

    return record;
  }

  const existingDefault = await getDefaultInvoiceTemplateFromD1(d1, params.teamId);

  if (existingDefault) {
    const record: InvoiceTemplateRecord = {
      ...existingDefault,
      ...incomingData,
      name: params.name ?? existingDefault.name,
      updatedAt: new Date().toISOString(),
    };

    await upsertInvoiceTemplateRecordInD1(d1, params.teamId, record);

    return record;
  }

  const timestamp = new Date().toISOString();
  const record: InvoiceTemplateRecord = {
    id: crypto.randomUUID(),
    name: params.name ?? "Default",
    isDefault: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...incomingData,
  };

  await upsertInvoiceTemplateRecordInD1(d1, params.teamId, record);

  return record;
}

export async function setDefaultInvoiceTemplateInD1(
  d1: CloudflareD1DatabaseBinding,
  params: { id: string; teamId: string },
) {
  const existing = await getInvoiceTemplateByIdFromD1(d1, params);

  if (!existing) {
    throw new Error("Template not found");
  }

  const record: InvoiceTemplateRecord = {
    ...existing,
    isDefault: true,
    updatedAt: new Date().toISOString(),
  };

  await upsertInvoiceTemplateRecordInD1(d1, params.teamId, record);

  return record;
}

export async function deleteInvoiceTemplateFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: { id: string; teamId: string },
): Promise<InvoiceTemplateDeleteResult> {
  const templates = await getInvoiceTemplatesFromD1(d1, params.teamId);
  const existing = templates.find((template) => template.id === params.id);

  if (!existing) {
    throw new Error("Template not found");
  }

  const remaining = templates.filter((template) => template.id !== params.id);

  if (remaining.length === 0) {
    throw new Error("Cannot delete the last template");
  }

  await d1
    .prepare("delete from invoice_templates where id = ? and team_id = ?")
    .bind(params.id, params.teamId)
    .run();

  let newDefault = remaining.find((template) => template.isDefault) ?? null;

  if (existing.isDefault) {
    const nextDefaultRow = await d1
      .prepare("select * from invoice_templates where team_id = ? order by created_at asc limit 1")
      .bind(params.teamId)
      .first<InvoiceTemplateRow>();
    newDefault = nextDefaultRow
      ? await setDefaultInvoiceTemplateInD1(d1, {
          id: nextDefaultRow.id,
          teamId: params.teamId,
        })
      : null;
  }

  return {
    deleted: existing,
    newDefault,
  };
}
