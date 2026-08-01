import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../../../client";
import type {
  TransactionMetricAggregateRowRecord,
  TransactionRecurringAggregateRowRecord,
  TransactionTaxAggregateRowRecord,
} from "./types";

type TransactionMetricAggregateD1Row = {
  scope: "base" | "native";
  date: string;
  currency: string;
  direction: "income" | "expense";
  category_slug: string | null;
  recurring: number | boolean;
  total_amount: number;
  total_net_amount: number | null;
  transaction_count: number;
  updated_at: string;
};

type TransactionRecurringAggregateD1Row = {
  scope: "base" | "native";
  direction: "income" | "expense";
  currency: string;
  date: string;
  name: string;
  frequency: TransactionRecurringAggregateRowRecord["frequency"];
  category_slug: string | null;
  total_amount: number;
  transaction_count: number;
  latest_amount: number;
  latest_transaction_created_at: string;
  updated_at: string;
};

type TransactionTaxAggregateD1Row = {
  scope: "base" | "native";
  date: string;
  currency: string;
  direction: "income" | "expense";
  category_slug: string | null;
  tax_type: string | null;
  tax_rate: number;
  total_tax_amount: number;
  total_transaction_amount: number;
  transaction_count: number;
  updated_at: string;
};

type TransactionAggregateDateFilter = {
  teamId: string;
  scope: "base" | "native";
  currency: string;
  dateFrom?: string | null;
  dateTo?: string | null;
};

function requireReportAggregatesD1(db: Database) {
  return requireCloudflareD1Database(db);
}

function addDateRangeFilter(
  filters: string[],
  values: unknown[],
  dateFrom?: string | null,
  dateTo?: string | null,
) {
  if (dateFrom) {
    filters.push("date >= ?");
    values.push(dateFrom);
  }

  if (dateTo) {
    filters.push("date <= ?");
    values.push(dateTo);
  }
}

async function allRows<T>(d1: CloudflareD1DatabaseBinding, query: string, values: unknown[]) {
  const { results = [] } = await d1
    .prepare(query)
    .bind(...values)
    .all<T>();

  return results;
}

function toBoolean(value: number | boolean) {
  return value === true || value === 1;
}

function toMetricRecord(row: TransactionMetricAggregateD1Row): TransactionMetricAggregateRowRecord {
  return {
    scope: row.scope,
    date: row.date,
    currency: row.currency,
    direction: row.direction,
    categorySlug: row.category_slug,
    recurring: toBoolean(row.recurring),
    totalAmount: row.total_amount,
    totalNetAmount: row.total_net_amount,
    transactionCount: row.transaction_count,
    updatedAt: row.updated_at,
  };
}

function toRecurringRecord(
  row: TransactionRecurringAggregateD1Row,
): TransactionRecurringAggregateRowRecord {
  return {
    scope: row.scope,
    direction: row.direction,
    currency: row.currency,
    date: row.date,
    name: row.name,
    frequency: row.frequency,
    categorySlug: row.category_slug,
    totalAmount: row.total_amount,
    transactionCount: row.transaction_count,
    latestAmount: row.latest_amount,
    latestTransactionCreatedAt: row.latest_transaction_created_at,
    updatedAt: row.updated_at,
  };
}

function toTaxRecord(row: TransactionTaxAggregateD1Row): TransactionTaxAggregateRowRecord {
  return {
    scope: row.scope,
    date: row.date,
    currency: row.currency,
    direction: row.direction,
    categorySlug: row.category_slug,
    taxType: row.tax_type,
    taxRate: row.tax_rate,
    totalTaxAmount: row.total_tax_amount,
    totalTransactionAmount: row.total_transaction_amount,
    transactionCount: row.transaction_count,
    updatedAt: row.updated_at,
  };
}

export async function getTransactionMetricAggregateRowsFromD1(
  db: Database,
  args: TransactionAggregateDateFilter,
) {
  const d1 = requireReportAggregatesD1(db);
  const filters = ["team_id = ?", "scope = ?", "currency = ?"];
  const values: unknown[] = [args.teamId, args.scope, args.currency];

  addDateRangeFilter(filters, values, args.dateFrom, args.dateTo);

  const rows = await allRows<TransactionMetricAggregateD1Row>(
    d1,
    `select
       scope,
       date,
       currency,
       direction,
       category_slug,
       recurring,
       total_amount,
       total_net_amount,
       transaction_count,
       updated_at
     from transaction_metric_aggregates
     where ${filters.join(" and ")}
     order by date asc, direction asc, coalesce(category_slug, '') asc, recurring asc`,
    values,
  );

  return rows.map(toMetricRecord);
}

export async function getTransactionRecurringAggregateRowsFromD1(
  db: Database,
  args: TransactionAggregateDateFilter & {
    direction: "income" | "expense";
  },
) {
  const d1 = requireReportAggregatesD1(db);
  const filters = ["team_id = ?", "scope = ?", "direction = ?", "currency = ?"];
  const values: unknown[] = [args.teamId, args.scope, args.direction, args.currency];

  addDateRangeFilter(filters, values, args.dateFrom, args.dateTo);

  const rows = await allRows<TransactionRecurringAggregateD1Row>(
    d1,
    `select
       scope,
       direction,
       currency,
       date,
       name,
       frequency,
       category_slug,
       total_amount,
       transaction_count,
       latest_amount,
       latest_transaction_created_at,
       updated_at
     from transaction_recurring_aggregates
     where ${filters.join(" and ")}
     order by date asc, name asc, coalesce(frequency, '') asc, coalesce(category_slug, '') asc`,
    values,
  );

  return rows.map(toRecurringRecord);
}

export async function getTransactionTaxAggregateRowsFromD1(
  db: Database,
  args: TransactionAggregateDateFilter & {
    direction: "income" | "expense";
  },
) {
  const d1 = requireReportAggregatesD1(db);
  const filters = ["team_id = ?", "scope = ?", "direction = ?", "currency = ?"];
  const values: unknown[] = [args.teamId, args.scope, args.direction, args.currency];

  addDateRangeFilter(filters, values, args.dateFrom, args.dateTo);

  const rows = await allRows<TransactionTaxAggregateD1Row>(
    d1,
    `select
       scope,
       date,
       currency,
       direction,
       category_slug,
       tax_type,
       tax_rate,
       total_tax_amount,
       total_transaction_amount,
       transaction_count,
       updated_at
     from transaction_tax_aggregates
     where ${filters.join(" and ")}
     order by date asc, coalesce(category_slug, '') asc, coalesce(tax_type, '') asc, tax_rate asc`,
    values,
  );

  return rows.map(toTaxRecord);
}
