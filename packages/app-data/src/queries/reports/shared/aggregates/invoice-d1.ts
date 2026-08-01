import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../../../client";
import type {
  InvoiceAggregateDateField,
  InvoiceAggregateRowRecord,
  InvoiceAgingAggregateRowRecord,
  InvoiceAnalyticsAggregateDateField,
  InvoiceAnalyticsAggregateRowRecord,
  InvoiceCustomerAggregateDateField,
  InvoiceCustomerDateAggregateRowRecord,
  InvoiceDateAggregateRowRecord,
} from "./types";

const TEAM_INVOICE_AGGREGATE_SCOPE_KEY = "team";

type InvoiceAggregateD1Row = {
  scope_key: string;
  customer_id: string | null;
  status: string;
  currency: string;
  invoice_count: number;
  total_amount: number;
  oldest_due_date: string | null;
  latest_issue_date: string | null;
  updated_at: string;
};

type InvoiceDateAggregateD1Row = {
  status: string;
  date_field: InvoiceAggregateDateField;
  date: string;
  currency: string;
  recurring: number | boolean;
  invoice_count: number;
  total_amount: number;
  valid_payment_count: number;
  on_time_count: number;
  total_days_to_pay: number;
  updated_at: string;
};

type InvoiceCustomerDateAggregateD1Row = {
  customer_id: string;
  status: string;
  date_field: InvoiceCustomerAggregateDateField;
  date: string;
  currency: string;
  invoice_count: number;
  total_amount: number;
  updated_at: string;
};

type InvoiceAnalyticsAggregateD1Row = {
  date_field: InvoiceAnalyticsAggregateDateField;
  date: string;
  status: string;
  currency: string;
  due_date: string | null;
  invoice_count: number;
  total_amount: number;
  issue_to_paid_valid_count: number;
  issue_to_paid_total_days: number;
  sent_to_paid_valid_count: number;
  sent_to_paid_total_days: number;
  updated_at: string;
};

type InvoiceAgingAggregateD1Row = {
  status: string;
  currency: string;
  issue_date: string | null;
  due_date: string | null;
  invoice_count: number;
  total_amount: number;
  updated_at: string;
};

function requireReportAggregatesD1(db: Database) {
  return requireCloudflareD1Database(db);
}

function invoiceAggregateScopeKey(customerId?: string | null) {
  return customerId ? `customer:${customerId}` : TEAM_INVOICE_AGGREGATE_SCOPE_KEY;
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

function addStatusesFilter(filters: string[], values: unknown[], statuses: string[]) {
  const normalizedStatuses = [...new Set(statuses)];

  if (normalizedStatuses.length === 0) {
    return false;
  }

  filters.push(`status in (${normalizedStatuses.map(() => "?").join(", ")})`);
  values.push(...normalizedStatuses);

  return true;
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

function normalizeCurrency(value: string) {
  return value || null;
}

function toInvoiceAggregateRecord(row: InvoiceAggregateD1Row): InvoiceAggregateRowRecord {
  return {
    scopeKey: row.scope_key,
    customerId: row.customer_id,
    status: row.status,
    currency: normalizeCurrency(row.currency),
    invoiceCount: row.invoice_count,
    totalAmount: row.total_amount,
    oldestDueDate: row.oldest_due_date,
    latestIssueDate: row.latest_issue_date,
    updatedAt: row.updated_at,
  };
}

function toInvoiceDateAggregateRecord(
  row: InvoiceDateAggregateD1Row,
): InvoiceDateAggregateRowRecord {
  return {
    status: row.status,
    dateField: row.date_field,
    date: row.date,
    currency: normalizeCurrency(row.currency),
    recurring: toBoolean(row.recurring),
    invoiceCount: row.invoice_count,
    totalAmount: row.total_amount,
    validPaymentCount: row.valid_payment_count,
    onTimeCount: row.on_time_count,
    totalDaysToPay: row.total_days_to_pay,
    updatedAt: row.updated_at,
  };
}

function toInvoiceCustomerDateAggregateRecord(
  row: InvoiceCustomerDateAggregateD1Row,
): InvoiceCustomerDateAggregateRowRecord {
  return {
    customerId: row.customer_id,
    status: row.status,
    dateField: row.date_field,
    date: row.date,
    currency: normalizeCurrency(row.currency),
    invoiceCount: row.invoice_count,
    totalAmount: row.total_amount,
    updatedAt: row.updated_at,
  };
}

function toInvoiceAnalyticsAggregateRecord(
  row: InvoiceAnalyticsAggregateD1Row,
): InvoiceAnalyticsAggregateRowRecord {
  return {
    dateField: row.date_field,
    date: row.date,
    status: row.status,
    currency: normalizeCurrency(row.currency),
    dueDate: row.due_date,
    invoiceCount: row.invoice_count,
    totalAmount: row.total_amount,
    issueToPaidValidCount: row.issue_to_paid_valid_count,
    issueToPaidTotalDays: row.issue_to_paid_total_days,
    sentToPaidValidCount: row.sent_to_paid_valid_count,
    sentToPaidTotalDays: row.sent_to_paid_total_days,
    updatedAt: row.updated_at,
  };
}

function toInvoiceAgingAggregateRecord(
  row: InvoiceAgingAggregateD1Row,
): InvoiceAgingAggregateRowRecord {
  return {
    status: row.status,
    currency: normalizeCurrency(row.currency),
    issueDate: row.issue_date,
    dueDate: row.due_date,
    invoiceCount: row.invoice_count,
    totalAmount: row.total_amount,
    updatedAt: row.updated_at,
  };
}

export async function getInvoiceAggregateRowsFromD1(
  db: Database,
  args: {
    teamId: string;
    customerId?: string;
    statuses?: string[];
  },
) {
  const d1 = requireReportAggregatesD1(db);
  const filters = ["team_id = ?", "scope_key = ?"];
  const values: unknown[] = [args.teamId, invoiceAggregateScopeKey(args.customerId)];

  if (args.statuses && args.statuses.length > 0) {
    addStatusesFilter(filters, values, args.statuses);
  }

  const rows = await allRows<InvoiceAggregateD1Row>(
    d1,
    `select
       scope_key,
       customer_id,
       status,
       currency,
       invoice_count,
       total_amount,
       oldest_due_date,
       latest_issue_date,
       updated_at
     from invoice_aggregates
     where ${filters.join(" and ")}
     order by status asc, currency asc`,
    values,
  );

  return rows.map(toInvoiceAggregateRecord);
}

export async function getInvoiceDateAggregateRowsFromD1(
  db: Database,
  args: {
    teamId: string;
    statuses: string[];
    dateField: InvoiceAggregateDateField;
    dateFrom?: string | null;
    dateTo?: string | null;
    currency?: string | null;
    recurring?: boolean;
  },
) {
  const d1 = requireReportAggregatesD1(db);
  const filters = ["team_id = ?", "date_field = ?"];
  const values: unknown[] = [args.teamId, args.dateField];

  if (!addStatusesFilter(filters, values, args.statuses)) {
    return [];
  }

  addDateRangeFilter(filters, values, args.dateFrom, args.dateTo);

  if (args.currency !== undefined && args.currency !== null) {
    filters.push("currency = ?");
    values.push(args.currency);
  }

  if (args.recurring !== undefined) {
    filters.push("recurring = ?");
    values.push(args.recurring ? 1 : 0);
  }

  const rows = await allRows<InvoiceDateAggregateD1Row>(
    d1,
    `select
       status,
       date_field,
       date,
       currency,
       recurring,
       invoice_count,
       total_amount,
       valid_payment_count,
       on_time_count,
       total_days_to_pay,
       updated_at
     from invoice_date_aggregates
     where ${filters.join(" and ")}
     order by date asc, status asc, currency asc, recurring asc`,
    values,
  );

  return rows.map(toInvoiceDateAggregateRecord);
}

export async function getInvoiceCustomerDateAggregateRowsFromD1(
  db: Database,
  args: {
    teamId: string;
    statuses: string[];
    dateField: InvoiceCustomerAggregateDateField;
    dateFrom?: string | null;
    dateTo?: string | null;
    currency?: string | null;
  },
) {
  const d1 = requireReportAggregatesD1(db);
  const filters = ["team_id = ?", "date_field = ?"];
  const values: unknown[] = [args.teamId, args.dateField];

  if (!addStatusesFilter(filters, values, args.statuses)) {
    return [];
  }

  addDateRangeFilter(filters, values, args.dateFrom, args.dateTo);

  if (args.currency !== undefined && args.currency !== null) {
    filters.push("currency = ?");
    values.push(args.currency);
  }

  const rows = await allRows<InvoiceCustomerDateAggregateD1Row>(
    d1,
    `select
       customer_id,
       status,
       date_field,
       date,
       currency,
       invoice_count,
       total_amount,
       updated_at
     from invoice_customer_date_aggregates
     where ${filters.join(" and ")}
     order by date asc, customer_id asc, status asc, currency asc`,
    values,
  );

  return rows.map(toInvoiceCustomerDateAggregateRecord);
}

export async function getInvoiceAnalyticsAggregateRowsFromD1(
  db: Database,
  args: {
    teamId: string;
    dateField: InvoiceAnalyticsAggregateDateField;
    statuses?: string[];
    dateFrom?: string | null;
    dateTo?: string | null;
    currency?: string | null;
  },
) {
  const d1 = requireReportAggregatesD1(db);
  const filters = ["team_id = ?", "date_field = ?"];
  const values: unknown[] = [args.teamId, args.dateField];

  if (args.statuses && args.statuses.length > 0) {
    addStatusesFilter(filters, values, args.statuses);
  }

  addDateRangeFilter(filters, values, args.dateFrom, args.dateTo);

  if (args.currency !== undefined && args.currency !== null) {
    filters.push("currency = ?");
    values.push(args.currency);
  }

  const rows = await allRows<InvoiceAnalyticsAggregateD1Row>(
    d1,
    `select
       date_field,
       date,
       status,
       currency,
       due_date,
       invoice_count,
       total_amount,
       issue_to_paid_valid_count,
       issue_to_paid_total_days,
       sent_to_paid_valid_count,
       sent_to_paid_total_days,
       updated_at
     from invoice_analytics_aggregates
     where ${filters.join(" and ")}
     order by date asc, status asc, currency asc, coalesce(due_date, '') asc`,
    values,
  );

  return rows.map(toInvoiceAnalyticsAggregateRecord);
}

export async function getInvoiceAgingAggregateRowsFromD1(
  db: Database,
  args: {
    teamId: string;
    statuses: string[];
    currency?: string | null;
  },
) {
  const d1 = requireReportAggregatesD1(db);
  const filters = ["team_id = ?"];
  const values: unknown[] = [args.teamId];

  if (!addStatusesFilter(filters, values, args.statuses)) {
    return [];
  }

  if (args.currency !== undefined && args.currency !== null) {
    filters.push("currency = ?");
    values.push(args.currency);
  }

  const rows = await allRows<InvoiceAgingAggregateD1Row>(
    d1,
    `select
       status,
       currency,
       issue_date,
       due_date,
       invoice_count,
       total_amount,
       updated_at
     from invoice_aging_aggregates
     where ${filters.join(" and ")}
     order by status asc, currency asc, coalesce(due_date, '') asc, coalesce(issue_date, '') asc`,
    values,
  );

  return rows.map(toInvoiceAgingAggregateRecord);
}
