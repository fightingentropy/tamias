import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../client";
import type { ProjectedInvoiceRecurringRecord } from "./shared";

export type StoredInvoiceRecurringRecord = Omit<ProjectedInvoiceRecurringRecord, "customer">;

type InvoiceRecurringSeriesRow = {
  id: string;
  team_id: string;
  user_id: string;
  customer_id: string | null;
  customer_name: string | null;
  frequency: StoredInvoiceRecurringRecord["frequency"];
  frequency_day: number | null;
  frequency_week: number | null;
  frequency_interval: number | null;
  end_type: StoredInvoiceRecurringRecord["endType"];
  end_date: string | null;
  end_count: number | null;
  status: StoredInvoiceRecurringRecord["status"];
  invoices_generated: number;
  consecutive_failures: number;
  next_scheduled_at: string | null;
  last_generated_at: string | null;
  upcoming_notification_sent_at: string | null;
  timezone: string;
  due_date_offset: number;
  amount: number | null;
  currency: string | null;
  line_items_json: string;
  template_json: string;
  payment_details_json: string;
  from_details_json: string;
  note_details_json: string;
  vat: number | null;
  tax: number | null;
  discount: number | null;
  subtotal: number | null;
  top_block_json: string;
  bottom_block_json: string;
  template_id: string | null;
  created_at: string;
  updated_at: string;
};

export function getInvoiceRecurringD1(db: Database) {
  return requireCloudflareD1Database(db);
}

export function requireInvoiceRecurringD1(db: Database) {
  const d1 = getInvoiceRecurringD1(db);

  if (!d1) {
    throw new Error("Invoice recurring series require Cloudflare D1");
  }

  return d1;
}

function parseJsonField(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function serializeJsonField(value: unknown) {
  return JSON.stringify(value ?? null);
}

function toInvoiceRecurringRecord(row: InvoiceRecurringSeriesRow): StoredInvoiceRecurringRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    teamId: row.team_id,
    userId: row.user_id,
    customerId: row.customer_id,
    frequency: row.frequency,
    frequencyDay: row.frequency_day,
    frequencyWeek: row.frequency_week,
    frequencyInterval: row.frequency_interval,
    endType: row.end_type,
    endDate: row.end_date,
    endCount: row.end_count,
    status: row.status,
    invoicesGenerated: row.invoices_generated,
    consecutiveFailures: row.consecutive_failures,
    nextScheduledAt: row.next_scheduled_at,
    lastGeneratedAt: row.last_generated_at,
    upcomingNotificationSentAt: row.upcoming_notification_sent_at,
    timezone: row.timezone,
    dueDateOffset: row.due_date_offset,
    amount: row.amount,
    currency: row.currency,
    lineItems: parseJsonField(row.line_items_json),
    template: parseJsonField(row.template_json),
    paymentDetails: parseJsonField(row.payment_details_json),
    fromDetails: parseJsonField(row.from_details_json),
    noteDetails: parseJsonField(row.note_details_json),
    customerName: row.customer_name,
    vat: row.vat,
    tax: row.tax,
    discount: row.discount,
    subtotal: row.subtotal,
    topBlock: parseJsonField(row.top_block_json),
    bottomBlock: parseJsonField(row.bottom_block_json),
    templateId: row.template_id,
  };
}

export async function upsertInvoiceRecurringSeriesInD1(
  d1: CloudflareD1DatabaseBinding,
  record: StoredInvoiceRecurringRecord | ProjectedInvoiceRecurringRecord,
) {
  const updatedAt = record.updatedAt ?? new Date().toISOString();

  await d1
    .prepare(
      `insert into invoice_recurring_series (
        id,
        team_id,
        user_id,
        customer_id,
        customer_name,
        frequency,
        frequency_day,
        frequency_week,
        frequency_interval,
        end_type,
        end_date,
        end_count,
        status,
        invoices_generated,
        consecutive_failures,
        next_scheduled_at,
        last_generated_at,
        upcoming_notification_sent_at,
        timezone,
        due_date_offset,
        amount,
        currency,
        line_items_json,
        template_json,
        payment_details_json,
        from_details_json,
        note_details_json,
        vat,
        tax,
        discount,
        subtotal,
        top_block_json,
        bottom_block_json,
        template_id,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        team_id = excluded.team_id,
        user_id = excluded.user_id,
        customer_id = excluded.customer_id,
        customer_name = excluded.customer_name,
        frequency = excluded.frequency,
        frequency_day = excluded.frequency_day,
        frequency_week = excluded.frequency_week,
        frequency_interval = excluded.frequency_interval,
        end_type = excluded.end_type,
        end_date = excluded.end_date,
        end_count = excluded.end_count,
        status = excluded.status,
        invoices_generated = excluded.invoices_generated,
        consecutive_failures = excluded.consecutive_failures,
        next_scheduled_at = excluded.next_scheduled_at,
        last_generated_at = excluded.last_generated_at,
        upcoming_notification_sent_at = excluded.upcoming_notification_sent_at,
        timezone = excluded.timezone,
        due_date_offset = excluded.due_date_offset,
        amount = excluded.amount,
        currency = excluded.currency,
        line_items_json = excluded.line_items_json,
        template_json = excluded.template_json,
        payment_details_json = excluded.payment_details_json,
        from_details_json = excluded.from_details_json,
        note_details_json = excluded.note_details_json,
        vat = excluded.vat,
        tax = excluded.tax,
        discount = excluded.discount,
        subtotal = excluded.subtotal,
        top_block_json = excluded.top_block_json,
        bottom_block_json = excluded.bottom_block_json,
        template_id = excluded.template_id,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at`,
    )
    .bind(
      record.id,
      record.teamId,
      record.userId,
      record.customerId,
      record.customerName,
      record.frequency,
      record.frequencyDay,
      record.frequencyWeek,
      record.frequencyInterval,
      record.endType,
      record.endDate,
      record.endCount,
      record.status,
      record.invoicesGenerated,
      record.consecutiveFailures,
      record.nextScheduledAt,
      record.lastGeneratedAt,
      record.upcomingNotificationSentAt,
      record.timezone,
      record.dueDateOffset,
      record.amount,
      record.currency,
      serializeJsonField(record.lineItems),
      serializeJsonField(record.template),
      serializeJsonField(record.paymentDetails),
      serializeJsonField(record.fromDetails),
      serializeJsonField(record.noteDetails),
      record.vat,
      record.tax,
      record.discount,
      record.subtotal,
      serializeJsonField(record.topBlock),
      serializeJsonField(record.bottomBlock),
      record.templateId,
      record.createdAt,
      updatedAt,
    )
    .run();
}

export async function getInvoiceRecurringSeriesByIdFromD1(
  d1: CloudflareD1DatabaseBinding,
  id: string,
) {
  const row = await d1
    .prepare("select * from invoice_recurring_series where id = ? limit 1")
    .bind(id)
    .first<InvoiceRecurringSeriesRow>();

  return row ? toInvoiceRecurringRecord(row) : null;
}

export async function getInvoiceRecurringSeriesByTeamFromD1(
  d1: CloudflareD1DatabaseBinding,
  teamId: string,
) {
  const { results = [] } = await d1
    .prepare(
      `select *
      from invoice_recurring_series
      where team_id = ?
      order by created_at desc`,
    )
    .bind(teamId)
    .all<InvoiceRecurringSeriesRow>();

  return results.map(toInvoiceRecurringRecord);
}

export async function getDueInvoiceRecurringSeriesFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: { before: string; limit?: number },
) {
  const { results = [] } = await d1
    .prepare(
      `select *
      from invoice_recurring_series
      where status = 'active'
        and next_scheduled_at is not null
        and next_scheduled_at <= ?
      order by next_scheduled_at asc
      limit ?`,
    )
    .bind(params.before, params.limit ?? 50)
    .all<InvoiceRecurringSeriesRow>();

  return results.map(toInvoiceRecurringRecord);
}

export async function getUpcomingInvoiceRecurringSeriesFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: { after: string; before: string; limit?: number },
) {
  const { results = [] } = await d1
    .prepare(
      `select *
      from invoice_recurring_series
      where status = 'active'
        and next_scheduled_at is not null
        and next_scheduled_at > ?
        and next_scheduled_at <= ?
      order by next_scheduled_at asc
      limit ?`,
    )
    .bind(params.after, params.before, params.limit ?? 100)
    .all<InvoiceRecurringSeriesRow>();

  return results.map(toInvoiceRecurringRecord);
}
