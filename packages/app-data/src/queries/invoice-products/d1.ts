import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../client";
import type {
  CreateInvoiceProductParams,
  GetInvoiceProductsParams,
  InvoiceProductRecord,
  UpdateInvoiceProductParams,
  UpsertInvoiceProductParams,
} from "../invoice-products";

type InvoiceProductRow = {
  id: string;
  team_id: string;
  created_by_user_id: string | null;
  name: string;
  name_key: string;
  normalized_name: string;
  description: string | null;
  price: number | null;
  price_key: string;
  currency: string | null;
  currency_key: string;
  unit: string | null;
  tax_rate: number | null;
  is_active: number;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string | null;
};

export function getInvoiceProductsD1(db: Database) {
  return requireCloudflareD1Database(db);
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function toNameKey(value: string) {
  return value.trim();
}

function toCurrencyKey(value?: string | null) {
  return value ?? "__null__";
}

function toPriceKey(value?: number | null) {
  return value === null || value === undefined ? "__null__" : String(value);
}

function toInvoiceProductRecord(row: InvoiceProductRow): InvoiceProductRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    teamId: row.team_id,
    createdBy: row.created_by_user_id as InvoiceProductRecord["createdBy"],
    name: row.name,
    description: row.description,
    price: row.price,
    currency: row.currency,
    unit: row.unit,
    taxRate: row.tax_rate,
    isActive: row.is_active === 1,
    usageCount: row.usage_count,
    lastUsedAt: row.last_used_at,
  };
}

export async function upsertInvoiceProductRecordInD1(
  d1: CloudflareD1DatabaseBinding,
  record: InvoiceProductRecord,
) {
  const nameKey = toNameKey(record.name);
  const currencyKey = toCurrencyKey(record.currency);
  const priceKey = toPriceKey(record.price);

  await d1
    .prepare(
      `delete from invoice_products
      where team_id = ?
        and name_key = ?
        and currency_key = ?
        and price_key = ?
        and id != ?`,
    )
    .bind(record.teamId, nameKey, currencyKey, priceKey, record.id)
    .run();

  await d1
    .prepare(
      `insert into invoice_products (
        id,
        team_id,
        created_by_user_id,
        name,
        name_key,
        normalized_name,
        description,
        price,
        price_key,
        currency,
        currency_key,
        unit,
        tax_rate,
        is_active,
        usage_count,
        last_used_at,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        team_id = excluded.team_id,
        created_by_user_id = excluded.created_by_user_id,
        name = excluded.name,
        name_key = excluded.name_key,
        normalized_name = excluded.normalized_name,
        description = excluded.description,
        price = excluded.price,
        price_key = excluded.price_key,
        currency = excluded.currency,
        currency_key = excluded.currency_key,
        unit = excluded.unit,
        tax_rate = excluded.tax_rate,
        is_active = excluded.is_active,
        usage_count = excluded.usage_count,
        last_used_at = excluded.last_used_at,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at`,
    )
    .bind(
      record.id,
      record.teamId,
      record.createdBy,
      record.name,
      nameKey,
      normalizeName(record.name),
      record.description,
      record.price,
      priceKey,
      record.currency,
      currencyKey,
      record.unit,
      record.taxRate,
      record.isActive ? 1 : 0,
      record.usageCount,
      record.lastUsedAt,
      record.createdAt,
      record.updatedAt,
    )
    .run();
}

async function getInvoiceProductByUniqueKeyFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: {
    teamId: string;
    name: string;
    currency?: string | null;
    price?: number | null;
  },
) {
  const row = await d1
    .prepare(
      `select *
      from invoice_products
      where team_id = ?
        and name_key = ?
        and currency_key = ?
        and price_key = ?
      limit 1`,
    )
    .bind(
      params.teamId,
      toNameKey(params.name),
      toCurrencyKey(params.currency),
      toPriceKey(params.price),
    )
    .first<InvoiceProductRow>();

  return row ? toInvoiceProductRecord(row) : null;
}

export async function createInvoiceProductInD1(
  d1: CloudflareD1DatabaseBinding,
  params: CreateInvoiceProductParams,
) {
  const timestamp = new Date().toISOString();
  const record: InvoiceProductRecord = {
    id: crypto.randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
    teamId: params.teamId,
    createdBy: params.createdBy,
    name: params.name,
    description: params.description ?? null,
    price: params.price ?? null,
    currency: params.currency ?? null,
    unit: params.unit ?? null,
    taxRate: params.taxRate ?? null,
    isActive: params.isActive ?? true,
    usageCount: 0,
    lastUsedAt: timestamp,
  };

  await upsertInvoiceProductRecordInD1(d1, record);

  return record;
}

export async function upsertInvoiceProductInD1(
  d1: CloudflareD1DatabaseBinding,
  params: UpsertInvoiceProductParams,
) {
  const existing = await getInvoiceProductByUniqueKeyFromD1(d1, params);
  const timestamp = new Date().toISOString();

  if (existing) {
    const record: InvoiceProductRecord = {
      ...existing,
      description:
        params.description !== undefined ? (params.description ?? null) : existing.description,
      unit: params.unit !== undefined ? (params.unit ?? null) : existing.unit,
      taxRate: params.taxRate !== undefined ? (params.taxRate ?? null) : existing.taxRate,
      usageCount: existing.usageCount + 1,
      lastUsedAt: timestamp,
      updatedAt: timestamp,
    };

    await upsertInvoiceProductRecordInD1(d1, record);

    return record;
  }

  const record: InvoiceProductRecord = {
    id: crypto.randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
    teamId: params.teamId,
    createdBy: params.createdBy,
    name: params.name,
    description: params.description ?? null,
    price: params.price ?? null,
    currency: params.currency ?? null,
    unit: params.unit ?? null,
    taxRate: params.taxRate ?? null,
    isActive: true,
    usageCount: 1,
    lastUsedAt: timestamp,
  };

  await upsertInvoiceProductRecordInD1(d1, record);

  return record;
}

export async function updateInvoiceProductInD1(
  d1: CloudflareD1DatabaseBinding,
  params: UpdateInvoiceProductParams,
) {
  const existing = await getInvoiceProductByIdFromD1(d1, params.id, params.teamId);

  if (!existing) {
    return null;
  }

  const nextName = params.name ?? existing.name;
  const nextCurrency =
    params.currency !== undefined ? (params.currency ?? null) : existing.currency;
  const nextPrice = params.price !== undefined ? (params.price ?? null) : existing.price;
  const duplicate = await getInvoiceProductByUniqueKeyFromD1(d1, {
    teamId: params.teamId,
    name: nextName,
    currency: nextCurrency,
    price: nextPrice,
  });

  if (duplicate && duplicate.id !== params.id) {
    throw new Error("Invoice product already exists");
  }

  const record: InvoiceProductRecord = {
    ...existing,
    name: nextName,
    description:
      params.description !== undefined ? (params.description ?? null) : existing.description,
    price: nextPrice,
    currency: nextCurrency,
    unit: params.unit !== undefined ? (params.unit ?? null) : existing.unit,
    taxRate: params.taxRate !== undefined ? (params.taxRate ?? null) : existing.taxRate,
    isActive: params.isActive ?? existing.isActive,
    usageCount: params.usageCount ?? existing.usageCount,
    lastUsedAt: params.lastUsedAt !== undefined ? (params.lastUsedAt ?? null) : existing.lastUsedAt,
    updatedAt: new Date().toISOString(),
  };

  await upsertInvoiceProductRecordInD1(d1, record);

  return record;
}

export async function getInvoiceProductByIdFromD1(
  d1: CloudflareD1DatabaseBinding,
  id: string,
  teamId: string,
) {
  const row = await d1
    .prepare("select * from invoice_products where id = ? and team_id = ? limit 1")
    .bind(id, teamId)
    .first<InvoiceProductRow>();

  return row ? toInvoiceProductRecord(row) : null;
}

export async function getInvoiceProductsFromD1(
  d1: CloudflareD1DatabaseBinding,
  teamId: string,
  params: GetInvoiceProductsParams = {},
) {
  const sortBy = params.sortBy ?? "popular";
  const limit = params.limit ?? 50;
  const filters = ["team_id = ?"];
  const values: unknown[] = [teamId];

  if (!params.includeInactive) {
    filters.push("is_active = 1");
  }

  if (params.currency !== undefined && params.currency !== null) {
    filters.push("currency = ?");
    values.push(params.currency);
  }

  const orderBy =
    sortBy === "recent"
      ? "coalesce(last_used_at, '') desc, usage_count desc"
      : "usage_count desc, coalesce(last_used_at, '') desc";

  const { results = [] } = await d1
    .prepare(
      `select *
      from invoice_products
      where ${filters.join(" and ")}
      order by ${orderBy}
      limit ?`,
    )
    .bind(...values, limit)
    .all<InvoiceProductRow>();

  return results.map(toInvoiceProductRecord);
}

export async function deleteInvoiceProductFromD1(
  d1: CloudflareD1DatabaseBinding,
  id: string,
  teamId: string,
) {
  const existing = await getInvoiceProductByIdFromD1(d1, id, teamId);

  if (!existing) {
    return false;
  }

  await d1
    .prepare("delete from invoice_products where id = ? and team_id = ?")
    .bind(id, teamId)
    .run();

  return true;
}

export async function incrementInvoiceProductUsageInD1(
  d1: CloudflareD1DatabaseBinding,
  id: string,
  teamId: string,
) {
  const existing = await getInvoiceProductByIdFromD1(d1, id, teamId);

  if (!existing) {
    return false;
  }

  const timestamp = new Date().toISOString();
  await upsertInvoiceProductRecordInD1(d1, {
    ...existing,
    usageCount: existing.usageCount + 1,
    lastUsedAt: timestamp,
    updatedAt: timestamp,
  });

  return true;
}
