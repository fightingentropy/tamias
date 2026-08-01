import { buildSearchIndexText } from "@tamias/domain";
import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
  type DatabaseOrTransaction,
} from "../client";

export type PublicInvoiceRecord = {
  id: string;
  token: string;
  status: string;
  paymentIntentId: string | null;
  viewedAt: string | null;
  invoiceNumber: string | null;
  invoiceRecurringId?: string | null;
  recurringSequence?: number | null;
  payload: unknown;
  createdAt: string;
  updatedAt: string;
};

export type PublicInvoiceFilterDateField =
  | "createdAt"
  | "issueDate"
  | "sentAt"
  | "dueDate"
  | "paidAt";

type PublicInvoicePayload = Record<string, unknown>;
type PublicInvoiceProjectionFields = {
  invoiceNumber: string | null;
  invoiceRecurringId: string | null;
  recurringSequence: number | null;
  customerId: string | null;
  customerName: string | null;
  currency: string | null;
  amount: number | null;
  issueDate: string | null;
  sentAt: string | null;
  dueDate: string | null;
  paidAt: string | null;
};

type PublicInvoiceRow = {
  id: string;
  team_id: string;
  token: string;
  status: string;
  payment_intent_id: string | null;
  viewed_at: string | null;
  invoice_number: string | null;
  invoice_recurring_id: string | null;
  recurring_sequence: number | null;
  customer_id: string | null;
  customer_name: string | null;
  currency: string | null;
  amount: number | null;
  issue_date: string | null;
  sent_at: string | null;
  due_date: string | null;
  paid_at: string | null;
  search_text: string | null;
  payload_json: string;
  created_at: string;
  updated_at: string;
};

type TeamInvoiceSequenceRow = {
  id: string;
  next_invoice_sequence: number | null;
};

const INVOICE_NUMBER_PREFIX = "INV-";
const INVOICE_NUMBER_PAD_LENGTH = 4;
const INVOICE_NUMBER_CONFLICT_PREFIX = "INVOICE_NUMBER_ALREADY_USED:";
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function getPublicInvoicesD1(db: Database | DatabaseOrTransaction) {
  return requireCloudflareD1Database(db as Database);
}

export function requirePublicInvoicesD1(db: Database | DatabaseOrTransaction) {
  const d1 = getPublicInvoicesD1(db);

  if (!d1) {
    throw new Error("Public invoices require Cloudflare D1");
  }

  return d1;
}

function nowIso() {
  return new Date().toISOString();
}

function parsePayload(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function serializePayload(value: unknown) {
  return JSON.stringify(value ?? null);
}

function toPublicInvoiceRecord(row: PublicInvoiceRow): PublicInvoiceRecord {
  return {
    id: row.id,
    token: row.token,
    status: row.status,
    paymentIntentId: row.payment_intent_id,
    viewedAt: row.viewed_at,
    invoiceNumber: row.invoice_number,
    invoiceRecurringId: row.invoice_recurring_id,
    recurringSequence: row.recurring_sequence,
    payload: parsePayload(row.payload_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function allRows<T>(d1: CloudflareD1DatabaseBinding, query: string, values: unknown[] = []) {
  const { results = [] } = await d1
    .prepare(query)
    .bind(...values)
    .all<T>();

  return results;
}

function getStringFieldFromPayload(payload: PublicInvoicePayload, key: string) {
  return typeof payload[key] === "string" && payload[key].length > 0 ? payload[key] : null;
}

function getNestedStringFieldFromPayload(payload: PublicInvoicePayload, path: string[]) {
  let current: unknown = payload;

  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) {
      return null;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === "string" && current.length > 0 ? current : null;
}

function getNumberFieldFromPayload(payload: PublicInvoicePayload, key: string) {
  return typeof payload[key] === "number" ? payload[key] : null;
}

function getPublicInvoiceProjectionFields(
  payload: PublicInvoicePayload,
  invoiceNumberOverride?: string | null,
): PublicInvoiceProjectionFields {
  return {
    invoiceNumber: invoiceNumberOverride ?? getStringFieldFromPayload(payload, "invoiceNumber"),
    invoiceRecurringId: getStringFieldFromPayload(payload, "invoiceRecurringId"),
    recurringSequence:
      typeof payload.recurringSequence === "number" ? payload.recurringSequence : null,
    customerId: getStringFieldFromPayload(payload, "customerId"),
    customerName: getStringFieldFromPayload(payload, "customerName"),
    currency: getStringFieldFromPayload(payload, "currency"),
    amount: getNumberFieldFromPayload(payload, "amount"),
    issueDate: getStringFieldFromPayload(payload, "issueDate"),
    sentAt: getStringFieldFromPayload(payload, "sentAt"),
    dueDate: getStringFieldFromPayload(payload, "dueDate"),
    paidAt: getStringFieldFromPayload(payload, "paidAt"),
  };
}

function getInvoiceSearchText(
  payload: PublicInvoicePayload,
  invoiceNumberOverride?: string | null,
) {
  const text = buildSearchIndexText([
    invoiceNumberOverride ?? getStringFieldFromPayload(payload, "invoiceNumber"),
    getStringFieldFromPayload(payload, "customerName"),
    getStringFieldFromPayload(payload, "status"),
    getStringFieldFromPayload(payload, "note"),
    getStringFieldFromPayload(payload, "sentTo"),
    getStringFieldFromPayload(payload, "currency"),
    getNestedStringFieldFromPayload(payload, ["customer", "name"]),
    getNestedStringFieldFromPayload(payload, ["customer", "email"]),
    getNestedStringFieldFromPayload(payload, ["customer", "billingEmail"]),
  ]);

  return text || null;
}

function parseInvoiceNumberSequence(invoiceNumber: string | null | undefined) {
  if (!invoiceNumber) {
    return null;
  }

  const match = invoiceNumber.match(/(\d+)$/);

  return match?.[1] ? Number.parseInt(match[1], 10) : null;
}

function formatInvoiceNumber(sequence: number) {
  return `${INVOICE_NUMBER_PREFIX}${sequence.toString().padStart(INVOICE_NUMBER_PAD_LENGTH, "0")}`;
}

function buildInvoiceNumberConflictError(invoiceNumber: string) {
  return new Error(`${INVOICE_NUMBER_CONFLICT_PREFIX}${invoiceNumber}`);
}

function isSamePublicInvoiceRecord(
  record: PublicInvoiceRow,
  args: {
    id: string;
    token: string;
  },
  existing: PublicInvoiceRow | null,
) {
  return (
    (existing !== null && record.id === existing.id) ||
    record.id === args.id ||
    record.token === args.token
  );
}

async function getPublicInvoiceRowById(d1: CloudflareD1DatabaseBinding, invoiceId: string) {
  return d1
    .prepare("select * from public_invoices where id = ? limit 1")
    .bind(invoiceId)
    .first<PublicInvoiceRow>();
}

async function getPublicInvoiceRowByToken(d1: CloudflareD1DatabaseBinding, token: string) {
  return d1
    .prepare("select * from public_invoices where token = ? limit 1")
    .bind(token)
    .first<PublicInvoiceRow>();
}

async function getTeamInvoiceSequenceRow(d1: CloudflareD1DatabaseBinding, teamId: string) {
  return d1
    .prepare("select id, next_invoice_sequence from teams where id = ? limit 1")
    .bind(teamId)
    .first<TeamInvoiceSequenceRow>();
}

function getNextInvoiceSequenceFromRecords(records: PublicInvoiceRow[]) {
  const numericSequences = records
    .map((record) => parseInvoiceNumberSequence(record.invoice_number))
    .filter((value): value is number => value !== null);

  if (numericSequences.length > 0) {
    return Math.max(...numericSequences) + 1;
  }

  return records.length + 1;
}

async function getInitialNextInvoiceSequence(d1: CloudflareD1DatabaseBinding, teamId: string) {
  const records = await allRows<PublicInvoiceRow>(
    d1,
    "select invoice_number from public_invoices where team_id = ?",
    [teamId],
  );

  return getNextInvoiceSequenceFromRecords(records);
}

async function getNextInvoiceSequence(d1: CloudflareD1DatabaseBinding, teamId: string) {
  const team = await getTeamInvoiceSequenceRow(d1, teamId);

  if (!team) {
    throw new Error("Public invoice team not found");
  }

  if (typeof team.next_invoice_sequence === "number") {
    return team.next_invoice_sequence;
  }

  return getInitialNextInvoiceSequence(d1, teamId);
}

async function initializeNextInvoiceSequenceIfNeeded(
  d1: CloudflareD1DatabaseBinding,
  teamId: string,
) {
  const team = await getTeamInvoiceSequenceRow(d1, teamId);

  if (!team) {
    throw new Error("Public invoice team not found");
  }

  if (typeof team.next_invoice_sequence === "number") {
    return;
  }

  const nextSequence = await getInitialNextInvoiceSequence(d1, teamId);

  await d1
    .prepare(
      `update teams
       set next_invoice_sequence = ?,
           updated_at = ?
       where id = ?
         and next_invoice_sequence is null`,
    )
    .bind(nextSequence, nowIso(), teamId)
    .run();
}

async function advanceNextInvoiceSequenceIfNeeded(
  d1: CloudflareD1DatabaseBinding,
  teamId: string,
  invoiceNumber: string | null,
) {
  const parsedSequence = parseInvoiceNumberSequence(invoiceNumber);

  if (parsedSequence === null) {
    return;
  }

  const currentNextSequence = await getNextInvoiceSequence(d1, teamId);
  const desiredNextSequence = Math.max(currentNextSequence, parsedSequence + 1);

  if (desiredNextSequence === currentNextSequence) {
    return;
  }

  await d1
    .prepare(
      `update teams
       set next_invoice_sequence = ?,
           updated_at = ?
       where id = ?
         and (next_invoice_sequence is null or next_invoice_sequence < ?)`,
    )
    .bind(desiredNextSequence, nowIso(), teamId, desiredNextSequence)
    .run();
}

function normalizeDateBoundary(value: string | null | undefined, boundary: "start" | "end") {
  if (!value) {
    return null;
  }

  if (!DATE_ONLY_PATTERN.test(value)) {
    return value;
  }

  return boundary === "start" ? `${value}T00:00:00.000Z` : `${value}T23:59:59.999Z`;
}

function toDateColumn(field: PublicInvoiceFilterDateField) {
  switch (field) {
    case "createdAt":
      return "created_at";
    case "issueDate":
      return "issue_date";
    case "sentAt":
      return "sent_at";
    case "dueDate":
      return "due_date";
    case "paidAt":
      return "paid_at";
  }
}

function escapeLikeSearch(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function addInFilter(filters: string[], values: unknown[], column: string, items: string[]) {
  const normalizedItems = [...new Set(items)].filter(Boolean);

  if (normalizedItems.length === 0) {
    return false;
  }

  filters.push(`${column} in (${normalizedItems.map(() => "?").join(", ")})`);
  values.push(...normalizedItems);

  return true;
}

export async function upsertPublicInvoice(
  db: DatabaseOrTransaction,
  args: {
    teamId: string;
    id: string;
    token: string;
    status: string;
    paymentIntentId?: string | null;
    viewedAt?: string | null;
    invoiceNumber?: string | null;
    payload: Record<string, unknown>;
  },
) {
  const d1 = requirePublicInvoicesD1(db);
  const timestamp = nowIso();
  const payload = args.payload as PublicInvoicePayload;
  const projectionFields = getPublicInvoiceProjectionFields(payload, args.invoiceNumber);
  const invoiceNumber = projectionFields.invoiceNumber;
  const searchText = getInvoiceSearchText(payload, args.invoiceNumber);
  const existing =
    (await getPublicInvoiceRowById(d1, args.id)) ??
    (await getPublicInvoiceRowByToken(d1, args.token));

  if (invoiceNumber) {
    const conflicts = await allRows<PublicInvoiceRow>(
      d1,
      `select id, token
       from public_invoices
       where team_id = ?
         and invoice_number = ?`,
      [args.teamId, invoiceNumber],
    );
    const conflict = conflicts.find((record) => !isSamePublicInvoiceRecord(record, args, existing));

    if (conflict) {
      throw buildInvoiceNumberConflictError(invoiceNumber);
    }
  }

  const createdAt = existing?.created_at ?? timestamp;
  const values = [
    args.id,
    args.teamId,
    args.token,
    args.status,
    args.paymentIntentId ?? null,
    args.viewedAt ?? null,
    invoiceNumber,
    projectionFields.invoiceRecurringId,
    projectionFields.recurringSequence,
    projectionFields.customerId,
    projectionFields.customerName,
    projectionFields.currency,
    projectionFields.amount,
    projectionFields.issueDate,
    projectionFields.sentAt,
    projectionFields.dueDate,
    projectionFields.paidAt,
    searchText,
    serializePayload(payload),
    createdAt,
    timestamp,
  ];

  if (existing) {
    await d1
      .prepare(
        `update public_invoices
         set id = ?,
             team_id = ?,
             token = ?,
             status = ?,
             payment_intent_id = ?,
             viewed_at = ?,
             invoice_number = ?,
             invoice_recurring_id = ?,
             recurring_sequence = ?,
             customer_id = ?,
             customer_name = ?,
             currency = ?,
             amount = ?,
             issue_date = ?,
             sent_at = ?,
             due_date = ?,
             paid_at = ?,
             search_text = ?,
             payload_json = ?,
             created_at = ?,
             updated_at = ?
         where id = ?`,
      )
      .bind(...values, existing.id)
      .run();
  } else {
    await d1
      .prepare(
        `insert into public_invoices (
          id,
          team_id,
          token,
          status,
          payment_intent_id,
          viewed_at,
          invoice_number,
          invoice_recurring_id,
          recurring_sequence,
          customer_id,
          customer_name,
          currency,
          amount,
          issue_date,
          sent_at,
          due_date,
          paid_at,
          search_text,
          payload_json,
          created_at,
          updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(...values)
      .run();
  }

  await advanceNextInvoiceSequenceIfNeeded(d1, args.teamId, invoiceNumber);

  const row = await getPublicInvoiceRowById(d1, args.id);

  if (!row) {
    throw new Error("Failed to upsert public invoice");
  }

  return toPublicInvoiceRecord(row);
}

export async function getPublicInvoiceByPublicInvoiceId(
  db: DatabaseOrTransaction,
  args: { invoiceId: string },
) {
  const row = await getPublicInvoiceRowById(requirePublicInvoicesD1(db), args.invoiceId);

  return row ? toPublicInvoiceRecord(row) : null;
}

export async function getPublicInvoiceByToken(db: DatabaseOrTransaction, args: { token: string }) {
  const row = await getPublicInvoiceRowByToken(requirePublicInvoicesD1(db), args.token);

  return row ? toPublicInvoiceRecord(row) : null;
}

export async function getPublicInvoicesByTeam(db: DatabaseOrTransaction, args: { teamId: string }) {
  const rows = await allRows<PublicInvoiceRow>(
    requirePublicInvoicesD1(db),
    `select *
     from public_invoices
     where team_id = ?
     order by created_at desc, id desc`,
    [args.teamId],
  );

  return rows.map(toPublicInvoiceRecord);
}

export async function getPublicInvoicesByIds(
  db: DatabaseOrTransaction,
  args: {
    teamId: string;
    invoiceIds: string[];
  },
) {
  const invoiceIds = [...new Set(args.invoiceIds)].filter(Boolean);

  if (invoiceIds.length === 0) {
    return [];
  }

  const rows = await allRows<PublicInvoiceRow>(
    requirePublicInvoicesD1(db),
    `select *
     from public_invoices
     where team_id = ?
       and id in (${invoiceIds.map(() => "?").join(", ")})`,
    [args.teamId, ...invoiceIds],
  );

  return rows.map(toPublicInvoiceRecord);
}

export async function getPublicInvoicesByCustomerIds(
  db: DatabaseOrTransaction,
  args: {
    teamId: string;
    customerIds: string[];
  },
) {
  const customerIds = [...new Set(args.customerIds)].filter(Boolean);

  if (customerIds.length === 0) {
    return [];
  }

  const rows = await allRows<PublicInvoiceRow>(
    requirePublicInvoicesD1(db),
    `select *
     from public_invoices
     where team_id = ?
       and customer_id in (${customerIds.map(() => "?").join(", ")})
     order by created_at desc, id desc`,
    [args.teamId, ...customerIds],
  );

  return rows.map(toPublicInvoiceRecord);
}

export async function getPublicInvoicesPage(
  db: DatabaseOrTransaction,
  args: {
    teamId: string;
    cursor?: string | null;
    pageSize: number;
    status?: string;
    order?: "asc" | "desc";
    createdAtFrom?: string;
    createdAtTo?: string;
  },
) {
  const filters = ["team_id = ?"];
  const values: unknown[] = [args.teamId];
  const order = args.order === "asc" ? "asc" : "desc";
  const offset = args.cursor ? Math.max(Number.parseInt(args.cursor, 10) || 0, 0) : 0;
  const pageSize = Math.max(args.pageSize, 0);

  if (args.status) {
    filters.push("status = ?");
    values.push(args.status);
  }

  if (args.createdAtFrom) {
    filters.push("created_at >= ?");
    values.push(args.createdAtFrom);
  }

  if (args.createdAtTo) {
    filters.push("created_at <= ?");
    values.push(args.createdAtTo);
  }

  const rows = await allRows<PublicInvoiceRow>(
    requirePublicInvoicesD1(db),
    `select *
     from public_invoices
     where ${filters.join(" and ")}
     order by created_at ${order}, id ${order}
     limit ?
     offset ?`,
    [...values, pageSize + 1, offset],
  );
  const page = rows.slice(0, pageSize).map(toPublicInvoiceRecord);
  const hasMore = rows.length > pageSize;

  return {
    page,
    isDone: !hasMore,
    continueCursor: hasMore ? String(offset + pageSize) : "",
  };
}

export async function searchPublicInvoices(
  db: DatabaseOrTransaction,
  args: {
    teamId: string;
    query: string;
    status?: string | null;
    limit?: number;
  },
) {
  const searchQuery = buildSearchIndexText([args.query.trim()]);

  if (!searchQuery) {
    return [];
  }

  const filters = ["team_id = ?", "search_text like ? escape '\\'"];
  const values: unknown[] = [args.teamId, `%${escapeLikeSearch(searchQuery)}%`];

  if (args.status) {
    filters.push("status = ?");
    values.push(args.status);
  }

  const rows = await allRows<PublicInvoiceRow>(
    requirePublicInvoicesD1(db),
    `select *
     from public_invoices
     where ${filters.join(" and ")}
     order by created_at desc, id desc
     limit ?`,
    [...values, Math.min(Math.max(args.limit ?? 25, 1), 100)],
  );

  return rows.map(toPublicInvoiceRecord);
}

export async function getPublicInvoicesByFilters(
  db: DatabaseOrTransaction,
  args: {
    teamId: string;
    statuses?: string[];
    currency?: string;
    dateField?: PublicInvoiceFilterDateField;
    from?: string;
    to?: string;
  },
) {
  const filters = ["team_id = ?"];
  const values: unknown[] = [args.teamId];

  if (args.statuses?.length) {
    addInFilter(filters, values, "status", args.statuses);
  }

  if (args.currency) {
    filters.push("currency = ?");
    values.push(args.currency);
  }

  const dateField = args.dateField ?? "createdAt";
  const dateColumn = toDateColumn(dateField);
  const from = normalizeDateBoundary(args.from, "start");
  const to = normalizeDateBoundary(args.to, "end");

  if (from) {
    filters.push(`${dateColumn} >= ?`);
    values.push(from);
  }

  if (to) {
    filters.push(`${dateColumn} <= ?`);
    values.push(to);
  }

  const rows = await allRows<PublicInvoiceRow>(
    requirePublicInvoicesD1(db),
    `select *
     from public_invoices
     where ${filters.join(" and ")}
     order by ${dateColumn} desc, created_at desc, id desc`,
    values,
  );

  return rows.map(toPublicInvoiceRecord);
}

export async function getPublicInvoiceByTeamAndInvoiceNumber(
  db: DatabaseOrTransaction,
  args: {
    teamId: string;
    invoiceNumber: string;
  },
) {
  const row = await requirePublicInvoicesD1(db)
    .prepare(
      `select *
       from public_invoices
       where team_id = ?
         and invoice_number = ?
       order by created_at desc, id desc
       limit 1`,
    )
    .bind(args.teamId, args.invoiceNumber)
    .first<PublicInvoiceRow>();

  return row ? toPublicInvoiceRecord(row) : null;
}

export async function getPublicInvoiceByRecurringSequence(
  db: DatabaseOrTransaction,
  args: {
    teamId: string;
    invoiceRecurringId: string;
    recurringSequence: number;
  },
) {
  const row = await requirePublicInvoicesD1(db)
    .prepare(
      `select *
       from public_invoices
       where team_id = ?
         and invoice_recurring_id = ?
         and recurring_sequence = ?
       order by created_at desc, id desc
       limit 1`,
    )
    .bind(args.teamId, args.invoiceRecurringId, args.recurringSequence)
    .first<PublicInvoiceRow>();

  return row ? toPublicInvoiceRecord(row) : null;
}

export async function getPublicInvoicesByRecurringId(
  db: DatabaseOrTransaction,
  args: {
    teamId: string;
    invoiceRecurringId: string;
    statuses?: string[];
  },
) {
  const filters = ["team_id = ?", "invoice_recurring_id = ?"];
  const values: unknown[] = [args.teamId, args.invoiceRecurringId];

  if (args.statuses?.length) {
    addInFilter(filters, values, "status", args.statuses);
  }

  const rows = await allRows<PublicInvoiceRow>(
    requirePublicInvoicesD1(db),
    `select *
     from public_invoices
     where ${filters.join(" and ")}
     order by coalesce(recurring_sequence, 0) asc, created_at asc, id asc`,
    values,
  );

  return rows.map(toPublicInvoiceRecord);
}

export async function getNextInvoiceNumberPreview(
  db: DatabaseOrTransaction,
  args: { teamId: string },
) {
  return formatInvoiceNumber(
    await getNextInvoiceSequence(requirePublicInvoicesD1(db), args.teamId),
  );
}

export async function allocateNextPublicInvoiceNumber(
  db: DatabaseOrTransaction,
  args: { teamId: string },
) {
  const d1 = requirePublicInvoicesD1(db);

  await initializeNextInvoiceSequenceIfNeeded(d1, args.teamId);

  const row = await d1
    .prepare(
      `update teams
       set next_invoice_sequence = next_invoice_sequence + 1,
           updated_at = ?
       where id = ?
       returning next_invoice_sequence`,
    )
    .bind(nowIso(), args.teamId)
    .first<{ next_invoice_sequence: number }>();

  if (!row || typeof row.next_invoice_sequence !== "number") {
    throw new Error("Failed to allocate invoice number");
  }

  return formatInvoiceNumber(row.next_invoice_sequence - 1);
}

export async function getPublicInvoicesByStatuses(
  db: DatabaseOrTransaction,
  args: { statuses: string[] },
) {
  const filters: string[] = [];
  const values: unknown[] = [];

  if (!addInFilter(filters, values, "status", args.statuses)) {
    return [];
  }

  const rows = await allRows<PublicInvoiceRow>(
    requirePublicInvoicesD1(db),
    `select *
     from public_invoices
     where ${filters.join(" and ")}
     order by created_at desc, id desc`,
    values,
  );

  return rows.map(toPublicInvoiceRecord);
}

export async function getPublicInvoiceByPaymentIntentId(
  db: DatabaseOrTransaction,
  args: {
    paymentIntentId: string;
  },
) {
  const row = await requirePublicInvoicesD1(db)
    .prepare(
      `select *
       from public_invoices
       where payment_intent_id = ?
       limit 1`,
    )
    .bind(args.paymentIntentId)
    .first<PublicInvoiceRow>();

  return row ? toPublicInvoiceRecord(row) : null;
}

export async function deletePublicInvoice(
  db: DatabaseOrTransaction,
  args: { teamId: string; id: string },
) {
  const d1 = requirePublicInvoicesD1(db);
  const existing = await d1
    .prepare(
      `select *
       from public_invoices
       where team_id = ?
         and id = ?
       limit 1`,
    )
    .bind(args.teamId, args.id)
    .first<PublicInvoiceRow>();

  if (!existing) {
    return null;
  }

  await d1
    .prepare(
      `delete from public_invoices
       where team_id = ?
         and id = ?`,
    )
    .bind(args.teamId, args.id)
    .run();

  return toPublicInvoiceRecord(existing);
}

export { INVOICE_NUMBER_CONFLICT_PREFIX };
