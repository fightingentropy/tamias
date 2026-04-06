import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { nowIso } from "../../packages/domain/src/identity";
import { buildSearchIndexText, buildSearchQuery } from "../../packages/domain/src/text-search";
import type { Doc } from "./_generated/dataModel";
import { type MutationCtx, mutation, type QueryCtx, query } from "./_generated/server";
import { syncPublicInvoiceComplianceJournalEntryForChange } from "./complianceLedger";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";

type PublicInvoicePayload = Record<string, unknown>;
type ReadCtx = QueryCtx | MutationCtx;
type PublicInvoiceDoc = Doc<"publicInvoices">;
type InvoiceAggregateDoc = Doc<"invoiceAggregates">;
type InvoiceDateAggregateDoc = Doc<"invoiceDateAggregates">;
type InvoiceCustomerDateAggregateDoc = Doc<"invoiceCustomerDateAggregates">;
type InvoiceAnalyticsAggregateDoc = Doc<"invoiceAnalyticsAggregates">;
type InvoiceAgingAggregateDoc = Doc<"invoiceAgingAggregates">;
type TeamDoc = Doc<"teams">;
const INVOICE_NUMBER_PREFIX = "INV-";
const INVOICE_NUMBER_PAD_LENGTH = 4;
const INVOICE_NUMBER_CONFLICT_PREFIX = "INVOICE_NUMBER_ALREADY_USED:";
const TEAM_INVOICE_AGGREGATE_SCOPE_KEY = "team";
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const publicInvoiceDateFieldValidator = v.union(
  v.literal("createdAt"),
  v.literal("issueDate"),
  v.literal("sentAt"),
  v.literal("dueDate"),
  v.literal("paidAt"),
);
const invoiceAggregateDateFieldValidator = v.union(v.literal("issueDate"), v.literal("paidAt"));
const invoiceCustomerAggregateDateFieldValidator = v.union(
  v.literal("createdAt"),
  v.literal("paidAt"),
);
const invoiceAnalyticsAggregateDateFieldValidator = v.union(
  v.literal("createdAt"),
  v.literal("sentAt"),
  v.literal("paidAt"),
);
const publicInvoiceOrderValidator = v.union(v.literal("asc"), v.literal("desc"));

type PublicInvoiceDateField = "createdAt" | "issueDate" | "sentAt" | "dueDate" | "paidAt";
type InvoiceAggregateDateField = "issueDate" | "paidAt";
type InvoiceCustomerAggregateDateField = "createdAt" | "paidAt";
type InvoiceAnalyticsAggregateDateField = "createdAt" | "sentAt" | "paidAt";
type PublicInvoiceProjectionFields = {
  invoiceNumber?: string;
  invoiceRecurringId?: string;
  recurringSequence?: number;
  customerId?: string;
  customerName?: string;
  currency?: string;
  amount?: number;
  issueDate?: string;
  sentAt?: string;
  dueDate?: string;
  paidAt?: string;
};

type InvoiceAggregateKey = {
  teamId: TeamDoc["_id"];
  scopeKey: string;
  customerId?: string;
  status: string;
  currency: string;
};
type InvoiceDateAggregateKey = {
  teamId: TeamDoc["_id"];
  status: string;
  dateField: InvoiceAggregateDateField;
  date: string;
  currency: string;
  recurring: boolean;
};
type InvoiceDateAggregateEntry = InvoiceDateAggregateKey & {
  amount: number;
  validPaymentCount: number;
  onTimeCount: number;
  totalDaysToPay: number;
};
type InvoiceAgingAggregateKey = {
  teamId: TeamDoc["_id"];
  status: string;
  currency: string;
  issueDate: string | null;
  dueDate: string | null;
};
type InvoiceAgingAggregateEntry = InvoiceAgingAggregateKey & {
  amount: number;
};
type InvoiceCustomerDateAggregateKey = {
  teamId: TeamDoc["_id"];
  customerId: string;
  status: string;
  dateField: InvoiceCustomerAggregateDateField;
  date: string;
  currency: string;
};
type InvoiceCustomerDateAggregateEntry = InvoiceCustomerDateAggregateKey & {
  amount: number;
};
type InvoiceAnalyticsAggregateKey = {
  teamId: TeamDoc["_id"];
  dateField: InvoiceAnalyticsAggregateDateField;
  date: string;
  status: string;
  currency: string;
  dueDate: string | null;
};
type InvoiceAnalyticsAggregateEntry = InvoiceAnalyticsAggregateKey & {
  amount: number;
  issueToPaidValidCount: number;
  issueToPaidTotalDays: number;
  sentToPaidValidCount: number;
  sentToPaidTotalDays: number;
};

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

function getInvoiceNumberFromPayload(payload: PublicInvoicePayload) {
  return getStringFieldFromPayload(payload, "invoiceNumber");
}

function getInvoiceRecurringIdFromPayload(payload: PublicInvoicePayload) {
  return getStringFieldFromPayload(payload, "invoiceRecurringId");
}

function getRecurringSequenceFromPayload(payload: PublicInvoicePayload) {
  return typeof payload.recurringSequence === "number" ? payload.recurringSequence : null;
}

function getCustomerIdFromPayload(payload: PublicInvoicePayload) {
  return getStringFieldFromPayload(payload, "customerId");
}

function getCustomerNameFromPayload(payload: PublicInvoicePayload) {
  return getStringFieldFromPayload(payload, "customerName");
}

function getCurrencyFromPayload(payload: PublicInvoicePayload) {
  return getStringFieldFromPayload(payload, "currency");
}

function getAmountFromPayload(payload: PublicInvoicePayload) {
  return getNumberFieldFromPayload(payload, "amount");
}

function getIssueDateFromPayload(payload: PublicInvoicePayload) {
  return getStringFieldFromPayload(payload, "issueDate");
}

function getSentAtFromPayload(payload: PublicInvoicePayload) {
  return getStringFieldFromPayload(payload, "sentAt");
}

function getDueDateFromPayload(payload: PublicInvoicePayload) {
  return getStringFieldFromPayload(payload, "dueDate");
}

function getPaidAtFromPayload(payload: PublicInvoicePayload) {
  return getStringFieldFromPayload(payload, "paidAt");
}

function getInvoiceSearchText(
  payload: PublicInvoicePayload,
  invoiceNumberOverride?: string | null,
) {
  return (
    buildSearchIndexText([
      invoiceNumberOverride ?? getInvoiceNumberFromPayload(payload),
      getCustomerNameFromPayload(payload),
      getStringFieldFromPayload(payload, "status"),
      getStringFieldFromPayload(payload, "note"),
      getStringFieldFromPayload(payload, "sentTo"),
      getCurrencyFromPayload(payload),
      getNestedStringFieldFromPayload(payload, ["customer", "name"]),
      getNestedStringFieldFromPayload(payload, ["customer", "email"]),
      getNestedStringFieldFromPayload(payload, ["customer", "billingEmail"]),
    ]) || undefined
  );
}

function getPublicInvoiceProjectionFields(
  payload: PublicInvoicePayload,
  invoiceNumberOverride?: string | null,
): PublicInvoiceProjectionFields {
  return {
    invoiceNumber: invoiceNumberOverride ?? getInvoiceNumberFromPayload(payload) ?? undefined,
    invoiceRecurringId: getInvoiceRecurringIdFromPayload(payload) ?? undefined,
    recurringSequence: getRecurringSequenceFromPayload(payload) ?? undefined,
    customerId: getCustomerIdFromPayload(payload) ?? undefined,
    customerName: getCustomerNameFromPayload(payload) ?? undefined,
    currency: getCurrencyFromPayload(payload) ?? undefined,
    amount: getAmountFromPayload(payload) ?? undefined,
    issueDate: getIssueDateFromPayload(payload) ?? undefined,
    sentAt: getSentAtFromPayload(payload) ?? undefined,
    dueDate: getDueDateFromPayload(payload) ?? undefined,
    paidAt: getPaidAtFromPayload(payload) ?? undefined,
  };
}

function getInvoiceAggregateScopeKey(customerId?: string | null) {
  return customerId ? `customer:${customerId}` : TEAM_INVOICE_AGGREGATE_SCOPE_KEY;
}

function getInvoicePaymentAggregateMetrics(
  record: Pick<PublicInvoiceDoc, "issueDate" | "paidAt" | "dueDate">,
) {
  if (!record.issueDate || !record.paidAt) {
    return {
      validPaymentCount: 0,
      onTimeCount: 0,
      totalDaysToPay: 0,
    };
  }

  const issueTime = new Date(record.issueDate).getTime();
  const paidTime = new Date(record.paidAt).getTime();
  const daysToPay = Math.floor((paidTime - issueTime) / (1000 * 60 * 60 * 24));

  if (!Number.isFinite(daysToPay) || daysToPay < 0 || daysToPay > 365) {
    return {
      validPaymentCount: 0,
      onTimeCount: 0,
      totalDaysToPay: 0,
    };
  }

  const dueTime = record.dueDate ? new Date(record.dueDate).getTime() : null;

  return {
    validPaymentCount: 1,
    onTimeCount: dueTime !== null && Number.isFinite(dueTime) && paidTime <= dueTime ? 1 : 0,
    totalDaysToPay: daysToPay,
  };
}

function getInvoiceAnalyticsPaymentMetrics(
  record: Pick<PublicInvoiceDoc, "createdAt" | "issueDate" | "sentAt" | "paidAt" | "dueDate">,
) {
  if (!record.paidAt) {
    return {
      issueToPaidValidCount: 0,
      issueToPaidTotalDays: 0,
      sentToPaidValidCount: 0,
      sentToPaidTotalDays: 0,
    };
  }

  const paidTime = new Date(record.paidAt).getTime();
  const issueBaseline = record.issueDate ?? record.createdAt ?? record.dueDate;
  const issueBaselineTime = issueBaseline ? new Date(issueBaseline).getTime() : Number.NaN;
  const issueToPaidDays = (paidTime - issueBaselineTime) / (1000 * 60 * 60 * 24);

  const sentTime = record.sentAt ? new Date(record.sentAt).getTime() : Number.NaN;
  const sentToPaidDays = (paidTime - sentTime) / (1000 * 60 * 60 * 24);

  return {
    issueToPaidValidCount:
      Number.isFinite(issueToPaidDays) && issueToPaidDays >= 0 && issueToPaidDays <= 365 ? 1 : 0,
    issueToPaidTotalDays:
      Number.isFinite(issueToPaidDays) && issueToPaidDays >= 0 && issueToPaidDays <= 365
        ? issueToPaidDays
        : 0,
    sentToPaidValidCount:
      Number.isFinite(sentToPaidDays) && sentToPaidDays >= 0 && sentToPaidDays <= 365 ? 1 : 0,
    sentToPaidTotalDays:
      Number.isFinite(sentToPaidDays) && sentToPaidDays >= 0 && sentToPaidDays <= 365
        ? sentToPaidDays
        : 0,
  };
}

function getInvoiceDateAggregateEntries(
  teamId: TeamDoc["_id"],
  record: Pick<
    PublicInvoiceDoc,
    "status" | "currency" | "amount" | "issueDate" | "paidAt" | "dueDate" | "invoiceRecurringId"
  >,
) {
  const entries: InvoiceDateAggregateEntry[] = [];
  const currency = record.currency ?? "";
  const recurring = Boolean(record.invoiceRecurringId);
  const amount = record.amount ?? 0;

  if (record.issueDate) {
    entries.push({
      teamId,
      status: record.status,
      dateField: "issueDate",
      date: record.issueDate,
      currency,
      recurring,
      amount,
      validPaymentCount: 0,
      onTimeCount: 0,
      totalDaysToPay: 0,
    });
  }

  if (record.status === "paid" && record.paidAt) {
    const paymentMetrics = getInvoicePaymentAggregateMetrics(record);

    entries.push({
      teamId,
      status: record.status,
      dateField: "paidAt",
      date: record.paidAt,
      currency,
      recurring,
      amount,
      ...paymentMetrics,
    });
  }

  return entries;
}

function getInvoiceCustomerDateAggregateEntries(
  teamId: TeamDoc["_id"],
  record: Pick<
    PublicInvoiceDoc,
    "customerId" | "status" | "currency" | "amount" | "createdAt" | "paidAt"
  >,
) {
  if (!record.customerId) {
    return [];
  }

  const entries: InvoiceCustomerDateAggregateEntry[] = [
    {
      teamId,
      customerId: record.customerId,
      status: record.status,
      dateField: "createdAt",
      date: record.createdAt,
      currency: record.currency ?? "",
      amount: record.amount ?? 0,
    },
  ];

  if (record.status === "paid" && record.paidAt) {
    entries.push({
      teamId,
      customerId: record.customerId,
      status: record.status,
      dateField: "paidAt",
      date: record.paidAt,
      currency: record.currency ?? "",
      amount: record.amount ?? 0,
    });
  }

  return entries;
}

function getInvoiceAnalyticsAggregateEntries(
  teamId: TeamDoc["_id"],
  record: Pick<
    PublicInvoiceDoc,
    "createdAt" | "sentAt" | "paidAt" | "status" | "currency" | "amount" | "issueDate" | "dueDate"
  >,
) {
  const amount = record.amount ?? 0;
  const currency = record.currency ?? "";
  const dueDate = record.dueDate ?? null;
  const paymentMetrics = getInvoiceAnalyticsPaymentMetrics(record);
  const entries: InvoiceAnalyticsAggregateEntry[] = [
    {
      teamId,
      dateField: "createdAt",
      date: record.createdAt,
      status: record.status,
      currency,
      dueDate,
      amount,
      ...paymentMetrics,
    },
  ];

  if (record.sentAt) {
    entries.push({
      teamId,
      dateField: "sentAt",
      date: record.sentAt,
      status: record.status,
      currency,
      dueDate,
      amount,
      ...paymentMetrics,
    });
  }

  if (record.status === "paid" && record.paidAt) {
    entries.push({
      teamId,
      dateField: "paidAt",
      date: record.paidAt,
      status: record.status,
      currency,
      dueDate,
      amount,
      ...paymentMetrics,
    });
  }

  return entries;
}

function getInvoiceAgingAggregateEntries(
  teamId: TeamDoc["_id"],
  record: Pick<PublicInvoiceDoc, "status" | "currency" | "amount" | "issueDate" | "dueDate">,
) {
  if (record.status !== "unpaid" && record.status !== "overdue") {
    return [];
  }

  return [
    {
      teamId,
      status: record.status,
      currency: record.currency ?? "",
      issueDate: record.issueDate ?? null,
      dueDate: record.dueDate ?? null,
      amount: record.amount ?? 0,
    },
  ] satisfies InvoiceAgingAggregateEntry[];
}

function getInvoiceAggregateKeys(
  teamId: TeamDoc["_id"],
  record: Pick<PublicInvoiceDoc, "customerId" | "status" | "currency"> | null,
) {
  if (!record?.status) {
    return [];
  }

  const keys: InvoiceAggregateKey[] = [
    {
      teamId,
      scopeKey: getInvoiceAggregateScopeKey(),
      status: record.status,
      currency: record.currency ?? "",
    },
  ];

  if (record.customerId) {
    keys.push({
      teamId,
      scopeKey: getInvoiceAggregateScopeKey(record.customerId),
      customerId: record.customerId,
      status: record.status,
      currency: record.currency ?? "",
    });
  }

  return keys;
}

function serializeInvoiceAggregateKey(key: InvoiceAggregateKey) {
  return [key.teamId, key.scopeKey, key.customerId ?? "", key.status, key.currency].join(":");
}

function serializeInvoiceDateAggregateKey(key: InvoiceDateAggregateKey) {
  return [
    key.teamId,
    key.status,
    key.dateField,
    key.date,
    key.currency,
    key.recurring ? "1" : "0",
  ].join(":");
}

function serializeInvoiceCustomerDateAggregateKey(key: InvoiceCustomerDateAggregateKey) {
  return [key.teamId, key.customerId, key.status, key.dateField, key.date, key.currency].join(":");
}

function serializeInvoiceAnalyticsAggregateKey(key: InvoiceAnalyticsAggregateKey) {
  return JSON.stringify([
    key.teamId,
    key.dateField,
    key.date,
    key.status,
    key.currency,
    key.dueDate,
  ]);
}

function serializeInvoiceAgingAggregateKey(key: InvoiceAgingAggregateKey) {
  return JSON.stringify([key.teamId, key.status, key.currency, key.issueDate, key.dueDate]);
}

async function getInvoiceAggregateRecord(ctx: ReadCtx, key: InvoiceAggregateKey) {
  return ctx.db
    .query("invoiceAggregates")
    .withIndex("by_team_scope_status_currency", (q) =>
      q
        .eq("teamId", key.teamId)
        .eq("scopeKey", key.scopeKey)
        .eq("status", key.status)
        .eq("currency", key.currency),
    )
    .unique();
}

async function getInvoiceDateAggregateRecord(ctx: ReadCtx, key: InvoiceDateAggregateKey) {
  return ctx.db
    .query("invoiceDateAggregates")
    .withIndex("by_team_status_date_field_currency_recurring_date", (q) =>
      q
        .eq("teamId", key.teamId)
        .eq("status", key.status)
        .eq("dateField", key.dateField)
        .eq("currency", key.currency)
        .eq("recurring", key.recurring)
        .eq("date", key.date),
    )
    .unique();
}

async function getInvoiceCustomerDateAggregateRecord(
  ctx: ReadCtx,
  key: InvoiceCustomerDateAggregateKey,
) {
  return ctx.db
    .query("invoiceCustomerDateAggregates")
    .withIndex("by_team_customer_status_date_field_currency_date", (q) =>
      q
        .eq("teamId", key.teamId)
        .eq("customerId", key.customerId)
        .eq("status", key.status)
        .eq("dateField", key.dateField)
        .eq("currency", key.currency)
        .eq("date", key.date),
    )
    .unique();
}

async function getInvoiceAnalyticsAggregateRecord(ctx: ReadCtx, key: InvoiceAnalyticsAggregateKey) {
  return ctx.db
    .query("invoiceAnalyticsAggregates")
    .withIndex("by_team_date_field_status_date", (q) =>
      q
        .eq("teamId", key.teamId)
        .eq("dateField", key.dateField)
        .eq("status", key.status)
        .eq("date", key.date),
    )
    .filter((q) =>
      q.and(q.eq(q.field("currency"), key.currency), q.eq(q.field("dueDate"), key.dueDate)),
    )
    .unique();
}

async function getInvoiceAgingAggregateRecord(ctx: ReadCtx, key: InvoiceAgingAggregateKey) {
  return ctx.db
    .query("invoiceAgingAggregates")
    .withIndex("by_team_status_currency_issue_due", (q) =>
      q
        .eq("teamId", key.teamId)
        .eq("status", key.status)
        .eq("currency", key.currency)
        .eq("issueDate", key.issueDate)
        .eq("dueDate", key.dueDate),
    )
    .unique();
}

async function getInvoicesForAggregateKey(ctx: ReadCtx, key: InvoiceAggregateKey) {
  const records = key.customerId
    ? await ctx.db
        .query("publicInvoices")
        .withIndex("by_team_and_customer", (q) =>
          q.eq("teamId", key.teamId).eq("customerId", key.customerId!),
        )
        .collect()
    : await ctx.db
        .query("publicInvoices")
        .withIndex("by_team_status", (q) => q.eq("teamId", key.teamId).eq("status", key.status))
        .collect();

  return records.filter(
    (record) => record.status === key.status && (record.currency ?? "") === key.currency,
  );
}

async function getInvoicesForDateAggregateKey(ctx: ReadCtx, key: InvoiceDateAggregateKey) {
  const records =
    key.dateField === "issueDate"
      ? await ctx.db
          .query("publicInvoices")
          .withIndex("by_team_status_issue_date", (q) =>
            q.eq("teamId", key.teamId).eq("status", key.status).eq("issueDate", key.date),
          )
          .collect()
      : await ctx.db
          .query("publicInvoices")
          .withIndex("by_team_status_paid_at", (q) =>
            q.eq("teamId", key.teamId).eq("status", key.status).eq("paidAt", key.date),
          )
          .collect();

  return records.filter(
    (record) =>
      (record.currency ?? "") === key.currency &&
      Boolean(record.invoiceRecurringId) === key.recurring,
  );
}

async function getInvoicesForCustomerDateAggregateKey(
  ctx: ReadCtx,
  key: InvoiceCustomerDateAggregateKey,
) {
  const records =
    key.dateField === "createdAt"
      ? await ctx.db
          .query("publicInvoices")
          .withIndex("by_team_status_created_at", (q) =>
            q.eq("teamId", key.teamId).eq("status", key.status).eq("createdAt", key.date),
          )
          .collect()
      : await ctx.db
          .query("publicInvoices")
          .withIndex("by_team_status_paid_at", (q) =>
            q.eq("teamId", key.teamId).eq("status", key.status).eq("paidAt", key.date),
          )
          .collect();

  return records.filter(
    (record) => record.customerId === key.customerId && (record.currency ?? "") === key.currency,
  );
}

async function getInvoicesForAnalyticsAggregateKey(
  ctx: ReadCtx,
  key: InvoiceAnalyticsAggregateKey,
) {
  const records =
    key.dateField === "createdAt"
      ? await ctx.db
          .query("publicInvoices")
          .withIndex("by_team_status_created_at", (q) =>
            q.eq("teamId", key.teamId).eq("status", key.status).eq("createdAt", key.date),
          )
          .collect()
      : key.dateField === "sentAt"
        ? await ctx.db
            .query("publicInvoices")
            .withIndex("by_team_sent_at", (q) => q.eq("teamId", key.teamId).eq("sentAt", key.date))
            .collect()
        : await ctx.db
            .query("publicInvoices")
            .withIndex("by_team_status_paid_at", (q) =>
              q.eq("teamId", key.teamId).eq("status", key.status).eq("paidAt", key.date),
            )
            .collect();

  return records.filter(
    (record) =>
      record.status === key.status &&
      (record.currency ?? "") === key.currency &&
      (record.dueDate ?? null) === key.dueDate,
  );
}

async function getInvoicesForAgingAggregateKey(ctx: ReadCtx, key: InvoiceAgingAggregateKey) {
  let records: PublicInvoiceDoc[];

  if (key.dueDate !== null) {
    const dueDate = key.dueDate;
    records = await ctx.db
      .query("publicInvoices")
      .withIndex("by_team_status_due_date", (q) =>
        q.eq("teamId", key.teamId).eq("status", key.status).eq("dueDate", dueDate),
      )
      .collect();
  } else if (key.issueDate !== null) {
    const issueDate = key.issueDate;
    records = await ctx.db
      .query("publicInvoices")
      .withIndex("by_team_status_issue_date", (q) =>
        q.eq("teamId", key.teamId).eq("status", key.status).eq("issueDate", issueDate),
      )
      .collect();
  } else {
    records = await ctx.db
      .query("publicInvoices")
      .withIndex("by_team_status", (q) => q.eq("teamId", key.teamId).eq("status", key.status))
      .collect();
  }

  return records.filter(
    (record) =>
      (record.currency ?? "") === key.currency &&
      (record.issueDate ?? null) === key.issueDate &&
      (record.dueDate ?? null) === key.dueDate,
  );
}

function summarizeInvoicesForAggregate(records: PublicInvoiceDoc[]) {
  let totalAmount = 0;
  let oldestDueDate: string | null = null;
  let latestIssueDate: string | null = null;

  for (const record of records) {
    totalAmount += record.amount ?? 0;

    if (record.dueDate && (!oldestDueDate || record.dueDate < oldestDueDate)) {
      oldestDueDate = record.dueDate;
    }

    if (record.issueDate && (!latestIssueDate || record.issueDate > latestIssueDate)) {
      latestIssueDate = record.issueDate;
    }
  }

  return {
    invoiceCount: records.length,
    totalAmount: Math.round(totalAmount * 100) / 100,
    oldestDueDate: oldestDueDate ?? undefined,
    latestIssueDate: latestIssueDate ?? undefined,
  };
}

function summarizeInvoicesForDateAggregate(
  teamId: TeamDoc["_id"],
  key: InvoiceDateAggregateKey,
  records: PublicInvoiceDoc[],
) {
  let totalAmount = 0;
  let invoiceCount = 0;
  let validPaymentCount = 0;
  let onTimeCount = 0;
  let totalDaysToPay = 0;

  for (const record of records) {
    for (const entry of getInvoiceDateAggregateEntries(teamId, record).filter(
      (candidate) =>
        candidate.status === key.status &&
        candidate.dateField === key.dateField &&
        candidate.date === key.date &&
        candidate.currency === key.currency &&
        candidate.recurring === key.recurring,
    )) {
      totalAmount += entry.amount;
      invoiceCount += 1;
      validPaymentCount += entry.validPaymentCount;
      onTimeCount += entry.onTimeCount;
      totalDaysToPay += entry.totalDaysToPay;
    }
  }

  return {
    invoiceCount,
    totalAmount: Math.round(totalAmount * 100) / 100,
    validPaymentCount,
    onTimeCount,
    totalDaysToPay,
  };
}

function summarizeInvoicesForCustomerDateAggregate(records: PublicInvoiceDoc[]) {
  const totalAmount =
    Math.round(records.reduce((sum, record) => sum + (record.amount ?? 0), 0) * 100) / 100;

  return {
    invoiceCount: records.length,
    totalAmount,
  };
}

function summarizeInvoicesForAnalyticsAggregate(
  teamId: TeamDoc["_id"],
  key: InvoiceAnalyticsAggregateKey,
  records: PublicInvoiceDoc[],
) {
  let invoiceCount = 0;
  let totalAmount = 0;
  let issueToPaidValidCount = 0;
  let issueToPaidTotalDays = 0;
  let sentToPaidValidCount = 0;
  let sentToPaidTotalDays = 0;

  for (const record of records) {
    for (const entry of getInvoiceAnalyticsAggregateEntries(teamId, record).filter(
      (candidate) =>
        candidate.dateField === key.dateField &&
        candidate.date === key.date &&
        candidate.status === key.status &&
        candidate.currency === key.currency &&
        candidate.dueDate === key.dueDate,
    )) {
      invoiceCount += 1;
      totalAmount += entry.amount;
      issueToPaidValidCount += entry.issueToPaidValidCount;
      issueToPaidTotalDays += entry.issueToPaidTotalDays;
      sentToPaidValidCount += entry.sentToPaidValidCount;
      sentToPaidTotalDays += entry.sentToPaidTotalDays;
    }
  }

  return {
    invoiceCount,
    totalAmount: Math.round(totalAmount * 100) / 100,
    issueToPaidValidCount,
    issueToPaidTotalDays,
    sentToPaidValidCount,
    sentToPaidTotalDays,
  };
}

function summarizeInvoicesForAgingAggregate(records: PublicInvoiceDoc[]) {
  const totalAmount =
    Math.round(records.reduce((sum, record) => sum + (record.amount ?? 0), 0) * 100) / 100;

  return {
    invoiceCount: records.length,
    totalAmount,
  };
}

function buildInvoiceAggregateBackfillMaps(teamId: TeamDoc["_id"], records: PublicInvoiceDoc[]) {
  const invoiceAggregateMap = new Map<
    string,
    {
      key: InvoiceAggregateKey;
      invoiceCount: number;
      totalAmount: number;
      oldestDueDate: string | undefined;
      latestIssueDate: string | undefined;
    }
  >();
  const invoiceDateAggregateMap = new Map<
    string,
    {
      key: InvoiceDateAggregateKey;
      invoiceCount: number;
      totalAmount: number;
      validPaymentCount: number;
      onTimeCount: number;
      totalDaysToPay: number;
    }
  >();
  const invoiceCustomerDateAggregateMap = new Map<
    string,
    {
      key: InvoiceCustomerDateAggregateKey;
      invoiceCount: number;
      totalAmount: number;
    }
  >();
  const invoiceAnalyticsAggregateMap = new Map<
    string,
    {
      key: InvoiceAnalyticsAggregateKey;
      invoiceCount: number;
      totalAmount: number;
      issueToPaidValidCount: number;
      issueToPaidTotalDays: number;
      sentToPaidValidCount: number;
      sentToPaidTotalDays: number;
    }
  >();
  const invoiceAgingAggregateMap = new Map<
    string,
    {
      key: InvoiceAgingAggregateKey;
      invoiceCount: number;
      totalAmount: number;
    }
  >();

  for (const record of records) {
    for (const key of getInvoiceAggregateKeys(teamId, record)) {
      const serializedKey = serializeInvoiceAggregateKey(key);
      const current = invoiceAggregateMap.get(serializedKey) ?? {
        key,
        invoiceCount: 0,
        totalAmount: 0,
        oldestDueDate: undefined,
        latestIssueDate: undefined,
      };

      current.invoiceCount += 1;
      current.totalAmount = Math.round((current.totalAmount + (record.amount ?? 0)) * 100) / 100;

      if (record.dueDate && (!current.oldestDueDate || record.dueDate < current.oldestDueDate)) {
        current.oldestDueDate = record.dueDate;
      }

      if (
        record.issueDate &&
        (!current.latestIssueDate || record.issueDate > current.latestIssueDate)
      ) {
        current.latestIssueDate = record.issueDate;
      }

      invoiceAggregateMap.set(serializedKey, current);
    }

    for (const entry of getInvoiceDateAggregateEntries(teamId, record)) {
      const { amount, validPaymentCount, onTimeCount, totalDaysToPay, ...key } = entry;
      const serializedKey = serializeInvoiceDateAggregateKey(key);
      const current = invoiceDateAggregateMap.get(serializedKey) ?? {
        key,
        invoiceCount: 0,
        totalAmount: 0,
        validPaymentCount: 0,
        onTimeCount: 0,
        totalDaysToPay: 0,
      };

      current.invoiceCount += 1;
      current.totalAmount = Math.round((current.totalAmount + amount) * 100) / 100;
      current.validPaymentCount += validPaymentCount;
      current.onTimeCount += onTimeCount;
      current.totalDaysToPay += totalDaysToPay;
      invoiceDateAggregateMap.set(serializedKey, current);
    }

    for (const entry of getInvoiceCustomerDateAggregateEntries(teamId, record)) {
      const { amount, ...key } = entry;
      const serializedKey = serializeInvoiceCustomerDateAggregateKey(key);
      const current = invoiceCustomerDateAggregateMap.get(serializedKey) ?? {
        key,
        invoiceCount: 0,
        totalAmount: 0,
      };

      current.invoiceCount += 1;
      current.totalAmount = Math.round((current.totalAmount + amount) * 100) / 100;
      invoiceCustomerDateAggregateMap.set(serializedKey, current);
    }

    for (const entry of getInvoiceAnalyticsAggregateEntries(teamId, record)) {
      const {
        amount,
        issueToPaidValidCount,
        issueToPaidTotalDays,
        sentToPaidValidCount,
        sentToPaidTotalDays,
        ...key
      } = entry;
      const serializedKey = serializeInvoiceAnalyticsAggregateKey(key);
      const current = invoiceAnalyticsAggregateMap.get(serializedKey) ?? {
        key,
        invoiceCount: 0,
        totalAmount: 0,
        issueToPaidValidCount: 0,
        issueToPaidTotalDays: 0,
        sentToPaidValidCount: 0,
        sentToPaidTotalDays: 0,
      };

      current.invoiceCount += 1;
      current.totalAmount = Math.round((current.totalAmount + amount) * 100) / 100;
      current.issueToPaidValidCount += issueToPaidValidCount;
      current.issueToPaidTotalDays += issueToPaidTotalDays;
      current.sentToPaidValidCount += sentToPaidValidCount;
      current.sentToPaidTotalDays += sentToPaidTotalDays;
      invoiceAnalyticsAggregateMap.set(serializedKey, current);
    }

    for (const entry of getInvoiceAgingAggregateEntries(teamId, record)) {
      const { amount, ...key } = entry;
      const serializedKey = serializeInvoiceAgingAggregateKey(key);
      const current = invoiceAgingAggregateMap.get(serializedKey) ?? {
        key,
        invoiceCount: 0,
        totalAmount: 0,
      };

      current.invoiceCount += 1;
      current.totalAmount = Math.round((current.totalAmount + amount) * 100) / 100;
      invoiceAgingAggregateMap.set(serializedKey, current);
    }
  }

  return {
    invoiceAggregateMap,
    invoiceDateAggregateMap,
    invoiceCustomerDateAggregateMap,
    invoiceAnalyticsAggregateMap,
    invoiceAgingAggregateMap,
  };
}

async function syncInvoiceAggregateKey(ctx: MutationCtx, key: InvoiceAggregateKey) {
  const existing = await getInvoiceAggregateRecord(ctx, key);
  const records = await getInvoicesForAggregateKey(ctx, key);

  if (records.length === 0) {
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return;
  }

  const timestamp = nowIso();
  const summary = summarizeInvoicesForAggregate(records);

  if (existing) {
    await ctx.db.patch(existing._id, {
      customerId: key.customerId ?? undefined,
      invoiceCount: summary.invoiceCount,
      totalAmount: summary.totalAmount,
      oldestDueDate: summary.oldestDueDate,
      latestIssueDate: summary.latestIssueDate,
      updatedAt: timestamp,
    });

    return;
  }

  await ctx.db.insert("invoiceAggregates", {
    teamId: key.teamId,
    scopeKey: key.scopeKey,
    customerId: key.customerId ?? undefined,
    status: key.status,
    currency: key.currency,
    invoiceCount: summary.invoiceCount,
    totalAmount: summary.totalAmount,
    oldestDueDate: summary.oldestDueDate,
    latestIssueDate: summary.latestIssueDate,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

async function syncInvoiceDateAggregateKey(ctx: MutationCtx, key: InvoiceDateAggregateKey) {
  const existing = await getInvoiceDateAggregateRecord(ctx, key);
  const records = await getInvoicesForDateAggregateKey(ctx, key);

  if (records.length === 0) {
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return;
  }

  const timestamp = nowIso();
  const summary = summarizeInvoicesForDateAggregate(key.teamId, key, records);

  if (existing) {
    await ctx.db.patch(existing._id, {
      invoiceCount: summary.invoiceCount,
      totalAmount: summary.totalAmount,
      validPaymentCount: summary.validPaymentCount,
      onTimeCount: summary.onTimeCount,
      totalDaysToPay: summary.totalDaysToPay,
      updatedAt: timestamp,
    });

    return;
  }

  await ctx.db.insert("invoiceDateAggregates", {
    teamId: key.teamId,
    status: key.status,
    dateField: key.dateField,
    date: key.date,
    currency: key.currency,
    recurring: key.recurring,
    invoiceCount: summary.invoiceCount,
    totalAmount: summary.totalAmount,
    validPaymentCount: summary.validPaymentCount,
    onTimeCount: summary.onTimeCount,
    totalDaysToPay: summary.totalDaysToPay,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

async function syncInvoiceCustomerDateAggregateKey(
  ctx: MutationCtx,
  key: InvoiceCustomerDateAggregateKey,
) {
  const existing = await getInvoiceCustomerDateAggregateRecord(ctx, key);
  const records = await getInvoicesForCustomerDateAggregateKey(ctx, key);

  if (records.length === 0) {
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return;
  }

  const timestamp = nowIso();
  const summary = summarizeInvoicesForCustomerDateAggregate(records);

  if (existing) {
    await ctx.db.patch(existing._id, {
      invoiceCount: summary.invoiceCount,
      totalAmount: summary.totalAmount,
      updatedAt: timestamp,
    });

    return;
  }

  await ctx.db.insert("invoiceCustomerDateAggregates", {
    teamId: key.teamId,
    customerId: key.customerId,
    status: key.status,
    dateField: key.dateField,
    date: key.date,
    currency: key.currency,
    invoiceCount: summary.invoiceCount,
    totalAmount: summary.totalAmount,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

async function syncInvoiceAnalyticsAggregateKey(
  ctx: MutationCtx,
  key: InvoiceAnalyticsAggregateKey,
) {
  const existing = await getInvoiceAnalyticsAggregateRecord(ctx, key);
  const records = await getInvoicesForAnalyticsAggregateKey(ctx, key);

  if (records.length === 0) {
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return;
  }

  const timestamp = nowIso();
  const summary = summarizeInvoicesForAnalyticsAggregate(key.teamId, key, records);

  if (existing) {
    await ctx.db.patch(existing._id, {
      invoiceCount: summary.invoiceCount,
      totalAmount: summary.totalAmount,
      issueToPaidValidCount: summary.issueToPaidValidCount,
      issueToPaidTotalDays: summary.issueToPaidTotalDays,
      sentToPaidValidCount: summary.sentToPaidValidCount,
      sentToPaidTotalDays: summary.sentToPaidTotalDays,
      updatedAt: timestamp,
    });

    return;
  }

  await ctx.db.insert("invoiceAnalyticsAggregates", {
    teamId: key.teamId,
    dateField: key.dateField,
    date: key.date,
    status: key.status,
    currency: key.currency,
    dueDate: key.dueDate,
    invoiceCount: summary.invoiceCount,
    totalAmount: summary.totalAmount,
    issueToPaidValidCount: summary.issueToPaidValidCount,
    issueToPaidTotalDays: summary.issueToPaidTotalDays,
    sentToPaidValidCount: summary.sentToPaidValidCount,
    sentToPaidTotalDays: summary.sentToPaidTotalDays,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

async function syncInvoiceAgingAggregateKey(ctx: MutationCtx, key: InvoiceAgingAggregateKey) {
  const existing = await getInvoiceAgingAggregateRecord(ctx, key);
  const records = await getInvoicesForAgingAggregateKey(ctx, key);

  if (records.length === 0) {
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return;
  }

  const timestamp = nowIso();
  const summary = summarizeInvoicesForAgingAggregate(records);

  if (existing) {
    await ctx.db.patch(existing._id, {
      invoiceCount: summary.invoiceCount,
      totalAmount: summary.totalAmount,
      updatedAt: timestamp,
    });

    return;
  }

  await ctx.db.insert("invoiceAgingAggregates", {
    teamId: key.teamId,
    status: key.status,
    currency: key.currency,
    issueDate: key.issueDate,
    dueDate: key.dueDate,
    invoiceCount: summary.invoiceCount,
    totalAmount: summary.totalAmount,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

async function syncInvoiceAggregatesForChange(
  ctx: MutationCtx,
  teamId: TeamDoc["_id"],
  previous: PublicInvoiceDoc | null,
  next: PublicInvoiceDoc | null,
) {
  const keys = new Map<string, InvoiceAggregateKey>();
  const dateAggregateKeys = new Map<string, InvoiceDateAggregateKey>();
  const customerDateAggregateKeys = new Map<string, InvoiceCustomerDateAggregateKey>();
  const analyticsAggregateKeys = new Map<string, InvoiceAnalyticsAggregateKey>();
  const agingAggregateKeys = new Map<string, InvoiceAgingAggregateKey>();

  for (const key of [
    ...getInvoiceAggregateKeys(teamId, previous),
    ...getInvoiceAggregateKeys(teamId, next),
  ]) {
    keys.set(serializeInvoiceAggregateKey(key), key);
  }

  for (const key of [
    ...(previous ? getInvoiceDateAggregateEntries(teamId, previous) : []),
    ...(next ? getInvoiceDateAggregateEntries(teamId, next) : []),
  ]) {
    const {
      amount: _amount,
      validPaymentCount: _validPaymentCount,
      onTimeCount: _onTimeCount,
      totalDaysToPay: _totalDaysToPay,
      ...aggregateKey
    } = key;
    dateAggregateKeys.set(serializeInvoiceDateAggregateKey(aggregateKey), aggregateKey);
  }

  for (const key of [
    ...(previous ? getInvoiceCustomerDateAggregateEntries(teamId, previous) : []),
    ...(next ? getInvoiceCustomerDateAggregateEntries(teamId, next) : []),
  ]) {
    const { amount: _amount, ...aggregateKey } = key;
    customerDateAggregateKeys.set(
      serializeInvoiceCustomerDateAggregateKey(aggregateKey),
      aggregateKey,
    );
  }

  for (const key of [
    ...(previous ? getInvoiceAnalyticsAggregateEntries(teamId, previous) : []),
    ...(next ? getInvoiceAnalyticsAggregateEntries(teamId, next) : []),
  ]) {
    const {
      amount: _amount,
      issueToPaidValidCount: _issueToPaidValidCount,
      issueToPaidTotalDays: _issueToPaidTotalDays,
      sentToPaidValidCount: _sentToPaidValidCount,
      sentToPaidTotalDays: _sentToPaidTotalDays,
      ...aggregateKey
    } = key;
    analyticsAggregateKeys.set(serializeInvoiceAnalyticsAggregateKey(aggregateKey), aggregateKey);
  }

  for (const key of [
    ...(previous ? getInvoiceAgingAggregateEntries(teamId, previous) : []),
    ...(next ? getInvoiceAgingAggregateEntries(teamId, next) : []),
  ]) {
    const { amount: _amount, ...aggregateKey } = key;
    agingAggregateKeys.set(serializeInvoiceAgingAggregateKey(aggregateKey), aggregateKey);
  }

  for (const key of keys.values()) {
    await syncInvoiceAggregateKey(ctx, key);
  }

  for (const key of dateAggregateKeys.values()) {
    await syncInvoiceDateAggregateKey(ctx, key);
  }

  for (const key of customerDateAggregateKeys.values()) {
    await syncInvoiceCustomerDateAggregateKey(ctx, key);
  }

  for (const key of analyticsAggregateKeys.values()) {
    await syncInvoiceAnalyticsAggregateKey(ctx, key);
  }

  for (const key of agingAggregateKeys.values()) {
    await syncInvoiceAgingAggregateKey(ctx, key);
  }
}

async function rebuildInvoiceReportAggregatesForTeam(
  ctx: MutationCtx,
  team: Pick<TeamDoc, "_id" | "publicTeamId">,
) {
  const timestamp = nowIso();
  const records = await ctx.db
    .query("publicInvoices")
    .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
    .collect();
  const {
    invoiceAggregateMap,
    invoiceDateAggregateMap,
    invoiceCustomerDateAggregateMap,
    invoiceAnalyticsAggregateMap,
    invoiceAgingAggregateMap,
  } = buildInvoiceAggregateBackfillMaps(team._id, records);

  for (const record of await ctx.db
    .query("invoiceAggregates")
    .withIndex("by_team_scope", (q) => q.eq("teamId", team._id))
    .collect()) {
    await ctx.db.delete(record._id);
  }

  for (const record of await ctx.db
    .query("invoiceDateAggregates")
    .withIndex("by_team_status_date_field_date", (q) => q.eq("teamId", team._id))
    .collect()) {
    await ctx.db.delete(record._id);
  }

  for (const record of await ctx.db
    .query("invoiceCustomerDateAggregates")
    .withIndex("by_team_status_date_field_date", (q) => q.eq("teamId", team._id))
    .collect()) {
    await ctx.db.delete(record._id);
  }

  for (const record of await ctx.db
    .query("invoiceAnalyticsAggregates")
    .withIndex("by_team_date_field_date", (q) => q.eq("teamId", team._id))
    .collect()) {
    await ctx.db.delete(record._id);
  }

  for (const record of await ctx.db
    .query("invoiceAgingAggregates")
    .withIndex("by_team_status", (q) => q.eq("teamId", team._id))
    .collect()) {
    await ctx.db.delete(record._id);
  }

  for (const entry of invoiceAggregateMap.values()) {
    await ctx.db.insert("invoiceAggregates", {
      teamId: entry.key.teamId,
      scopeKey: entry.key.scopeKey,
      customerId: entry.key.customerId ?? undefined,
      status: entry.key.status,
      currency: entry.key.currency,
      invoiceCount: entry.invoiceCount,
      totalAmount: entry.totalAmount,
      oldestDueDate: entry.oldestDueDate,
      latestIssueDate: entry.latestIssueDate,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  for (const entry of invoiceDateAggregateMap.values()) {
    await ctx.db.insert("invoiceDateAggregates", {
      teamId: entry.key.teamId,
      status: entry.key.status,
      dateField: entry.key.dateField,
      date: entry.key.date,
      currency: entry.key.currency,
      recurring: entry.key.recurring,
      invoiceCount: entry.invoiceCount,
      totalAmount: entry.totalAmount,
      validPaymentCount: entry.validPaymentCount,
      onTimeCount: entry.onTimeCount,
      totalDaysToPay: entry.totalDaysToPay,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  for (const entry of invoiceCustomerDateAggregateMap.values()) {
    await ctx.db.insert("invoiceCustomerDateAggregates", {
      teamId: entry.key.teamId,
      customerId: entry.key.customerId,
      status: entry.key.status,
      dateField: entry.key.dateField,
      date: entry.key.date,
      currency: entry.key.currency,
      invoiceCount: entry.invoiceCount,
      totalAmount: entry.totalAmount,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  for (const entry of invoiceAnalyticsAggregateMap.values()) {
    await ctx.db.insert("invoiceAnalyticsAggregates", {
      teamId: entry.key.teamId,
      dateField: entry.key.dateField,
      date: entry.key.date,
      status: entry.key.status,
      currency: entry.key.currency,
      dueDate: entry.key.dueDate,
      invoiceCount: entry.invoiceCount,
      totalAmount: entry.totalAmount,
      issueToPaidValidCount: entry.issueToPaidValidCount,
      issueToPaidTotalDays: entry.issueToPaidTotalDays,
      sentToPaidValidCount: entry.sentToPaidValidCount,
      sentToPaidTotalDays: entry.sentToPaidTotalDays,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  for (const entry of invoiceAgingAggregateMap.values()) {
    await ctx.db.insert("invoiceAgingAggregates", {
      teamId: entry.key.teamId,
      status: entry.key.status,
      currency: entry.key.currency,
      issueDate: entry.key.issueDate,
      dueDate: entry.key.dueDate,
      invoiceCount: entry.invoiceCount,
      totalAmount: entry.totalAmount,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  return {
    teamId: team.publicTeamId ?? team._id,
    invoiceCount: records.length,
    invoiceAggregateRows: invoiceAggregateMap.size,
    invoiceDateAggregateRows: invoiceDateAggregateMap.size,
    invoiceCustomerDateAggregateRows: invoiceCustomerDateAggregateMap.size,
    invoiceAnalyticsAggregateRows: invoiceAnalyticsAggregateMap.size,
    invoiceAgingAggregateRows: invoiceAgingAggregateMap.size,
  };
}

async function rebuildPublicInvoiceSearchTextsForTeam(
  ctx: MutationCtx,
  team: Pick<TeamDoc, "_id" | "publicTeamId">,
) {
  const records = await ctx.db
    .query("publicInvoices")
    .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
    .collect();
  let updatedInvoiceCount = 0;

  for (const record of records) {
    const searchText = getInvoiceSearchText(
      record.payload as PublicInvoicePayload,
      record.invoiceNumber,
    );

    if (record.searchText === searchText) {
      continue;
    }

    await ctx.db.patch(record._id, {
      searchText,
    });
    updatedInvoiceCount += 1;
  }

  return {
    teamId: team.publicTeamId ?? team._id,
    invoiceCount: records.length,
    updatedInvoiceCount,
  };
}

function serializeInvoiceAggregate(record: InvoiceAggregateDoc) {
  return {
    scopeKey: record.scopeKey,
    customerId: record.customerId ?? null,
    status: record.status,
    currency: record.currency || null,
    invoiceCount: record.invoiceCount,
    totalAmount: record.totalAmount,
    oldestDueDate: record.oldestDueDate ?? null,
    latestIssueDate: record.latestIssueDate ?? null,
    updatedAt: record.updatedAt,
  };
}

function serializeInvoiceDateAggregate(record: InvoiceDateAggregateDoc) {
  return {
    status: record.status,
    dateField: record.dateField,
    date: record.date,
    currency: record.currency || null,
    recurring: record.recurring,
    invoiceCount: record.invoiceCount,
    totalAmount: record.totalAmount,
    validPaymentCount: record.validPaymentCount,
    onTimeCount: record.onTimeCount,
    totalDaysToPay: record.totalDaysToPay,
    updatedAt: record.updatedAt,
  };
}

function serializeInvoiceCustomerDateAggregate(record: InvoiceCustomerDateAggregateDoc) {
  return {
    customerId: record.customerId,
    status: record.status,
    dateField: record.dateField,
    date: record.date,
    currency: record.currency || null,
    invoiceCount: record.invoiceCount,
    totalAmount: record.totalAmount,
    updatedAt: record.updatedAt,
  };
}

function serializeInvoiceAnalyticsAggregate(record: InvoiceAnalyticsAggregateDoc) {
  return {
    dateField: record.dateField,
    date: record.date,
    status: record.status,
    currency: record.currency || null,
    dueDate: record.dueDate,
    invoiceCount: record.invoiceCount,
    totalAmount: record.totalAmount,
    issueToPaidValidCount: record.issueToPaidValidCount,
    issueToPaidTotalDays: record.issueToPaidTotalDays,
    sentToPaidValidCount: record.sentToPaidValidCount,
    sentToPaidTotalDays: record.sentToPaidTotalDays,
    updatedAt: record.updatedAt,
  };
}

function serializeInvoiceAgingAggregate(record: InvoiceAgingAggregateDoc) {
  return {
    status: record.status,
    currency: record.currency || null,
    issueDate: record.issueDate,
    dueDate: record.dueDate,
    invoiceCount: record.invoiceCount,
    totalAmount: record.totalAmount,
    updatedAt: record.updatedAt,
  };
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
  return new ConvexError(`${INVOICE_NUMBER_CONFLICT_PREFIX}${invoiceNumber}`);
}

async function getTeamPublicInvoices(ctx: ReadCtx, teamId: TeamDoc["_id"]) {
  return ctx.db
    .query("publicInvoices")
    .withIndex("by_team_id", (q) => q.eq("teamId", teamId))
    .collect();
}

function getNextInvoiceSequenceFromRecords(records: PublicInvoiceDoc[]) {
  const numericSequences = records
    .map((record) => parseInvoiceNumberSequence(record.invoiceNumber))
    .filter((value): value is number => value !== null);

  if (numericSequences.length > 0) {
    return Math.max(...numericSequences) + 1;
  }

  return records.length + 1;
}

async function getInitialNextInvoiceSequence(ctx: ReadCtx, teamId: TeamDoc["_id"]) {
  const records = await getTeamPublicInvoices(ctx, teamId);

  return getNextInvoiceSequenceFromRecords(records);
}

async function getNextInvoiceSequencePreview(ctx: QueryCtx, teamId: TeamDoc["_id"]) {
  const records = await getTeamPublicInvoices(ctx, teamId);

  return getNextInvoiceSequenceFromRecords(records);
}

async function getNextInvoiceSequence(
  ctx: MutationCtx,
  team: Pick<TeamDoc, "_id" | "nextInvoiceSequence">,
) {
  if (typeof team.nextInvoiceSequence === "number") {
    return team.nextInvoiceSequence;
  }

  return getInitialNextInvoiceSequence(ctx, team._id);
}

async function advanceNextInvoiceSequenceIfNeeded(
  ctx: MutationCtx,
  team: Pick<TeamDoc, "_id" | "nextInvoiceSequence">,
  invoiceNumber: string | null,
) {
  const parsedSequence = parseInvoiceNumberSequence(invoiceNumber);

  if (parsedSequence === null) {
    return;
  }

  const currentNextSequence = await getNextInvoiceSequence(ctx, team);
  const desiredNextSequence = Math.max(currentNextSequence, parsedSequence + 1);

  if (desiredNextSequence !== currentNextSequence) {
    await ctx.db.patch(team._id, {
      nextInvoiceSequence: desiredNextSequence,
    });
  }
}

function sortByNewestCreatedAt(records: PublicInvoiceDoc[]) {
  return [...records].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function sortByRecurringSequence(records: PublicInvoiceDoc[], direction: "asc" | "desc" = "asc") {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...records].sort((left, right) => {
    const leftSequence = left.recurringSequence ?? 0;
    const rightSequence = right.recurringSequence ?? 0;
    const sequenceDelta = leftSequence - rightSequence;

    if (sequenceDelta !== 0) {
      return sequenceDelta * multiplier;
    }

    return left.createdAt.localeCompare(right.createdAt) * multiplier;
  });
}

function getStoredDateField(
  record: PublicInvoiceDoc,
  field: Exclude<PublicInvoiceDateField, "createdAt">,
) {
  switch (field) {
    case "issueDate":
      return record.issueDate ?? null;
    case "sentAt":
      return record.sentAt ?? null;
    case "dueDate":
      return record.dueDate ?? null;
    case "paidAt":
      return record.paidAt ?? null;
  }
}

function getStoredDateFieldValue(record: PublicInvoiceDoc, field: PublicInvoiceDateField) {
  if (field === "createdAt") {
    return record.createdAt;
  }

  return getStoredDateField(record, field);
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

function matchesDateRange(
  value: string | null | undefined,
  from: string | null,
  to: string | null,
) {
  if (!value) {
    return false;
  }

  return (!from || value >= from) && (!to || value <= to);
}

function isSamePublicInvoiceRecord(
  record: PublicInvoiceDoc,
  args: {
    invoiceId: string;
    token: string;
  },
  existing: PublicInvoiceDoc | null,
) {
  return (
    (existing !== null && record._id === existing._id) ||
    record.publicInvoiceId === args.invoiceId ||
    record.token === args.token
  );
}

async function getPublicInvoicesByStatuses(
  ctx: ReadCtx,
  teamId: TeamDoc["_id"],
  statuses: string[],
) {
  const records = await Promise.all(
    statuses.map((status) =>
      ctx.db
        .query("publicInvoices")
        .withIndex("by_team_status", (q) => q.eq("teamId", teamId).eq("status", status))
        .collect(),
    ),
  );

  return records.flat();
}

async function getPublicInvoicesByStatusAndCreatedAt(
  ctx: ReadCtx,
  teamId: TeamDoc["_id"],
  statuses: string[],
  from: string | null,
  to: string | null,
) {
  const records = await Promise.all(
    statuses.map((status) =>
      ctx.db
        .query("publicInvoices")
        .withIndex("by_team_status_created_at", (q) => {
          const range = q.eq("teamId", teamId).eq("status", status);

          if (from && to) {
            return range.gte("createdAt", from).lte("createdAt", to);
          }

          if (from) {
            return range.gte("createdAt", from);
          }

          if (to) {
            return range.lte("createdAt", to);
          }

          return range;
        })
        .collect(),
    ),
  );

  return records.flat();
}

async function getPublicInvoicesByCreatedAt(
  ctx: ReadCtx,
  teamId: TeamDoc["_id"],
  from: string | null,
  to: string | null,
) {
  return ctx.db
    .query("publicInvoices")
    .withIndex("by_team_created_at", (q) => {
      const range = q.eq("teamId", teamId);

      if (from && to) {
        return range.gte("createdAt", from).lte("createdAt", to);
      }

      if (from) {
        return range.gte("createdAt", from);
      }

      if (to) {
        return range.lte("createdAt", to);
      }

      return range;
    })
    .collect();
}

async function getPublicInvoicesByStatusAndDateField(
  ctx: ReadCtx,
  teamId: TeamDoc["_id"],
  statuses: string[],
  field: Exclude<PublicInvoiceDateField, "createdAt" | "sentAt">,
  from: string | null,
  to: string | null,
) {
  const records = await Promise.all(
    statuses.map((status) => {
      if (field === "issueDate") {
        return ctx.db
          .query("publicInvoices")
          .withIndex("by_team_status_issue_date", (q) => {
            const range = q.eq("teamId", teamId).eq("status", status);

            if (from && to) {
              return range.gte("issueDate", from).lte("issueDate", to);
            }

            if (from) {
              return range.gte("issueDate", from);
            }

            if (to) {
              return range.lte("issueDate", to);
            }

            return range;
          })
          .collect();
      }

      if (field === "dueDate") {
        return ctx.db
          .query("publicInvoices")
          .withIndex("by_team_status_due_date", (q) => {
            const range = q.eq("teamId", teamId).eq("status", status);

            if (from && to) {
              return range.gte("dueDate", from).lte("dueDate", to);
            }

            if (from) {
              return range.gte("dueDate", from);
            }

            if (to) {
              return range.lte("dueDate", to);
            }

            return range;
          })
          .collect();
      }

      return ctx.db
        .query("publicInvoices")
        .withIndex("by_team_status_paid_at", (q) => {
          const range = q.eq("teamId", teamId).eq("status", status);

          if (from && to) {
            return range.gte("paidAt", from).lte("paidAt", to);
          }

          if (from) {
            return range.gte("paidAt", from);
          }

          if (to) {
            return range.lte("paidAt", to);
          }

          return range;
        })
        .collect();
    }),
  );

  return records.flat();
}

async function getPublicInvoicesByTeamDateField(
  ctx: ReadCtx,
  teamId: TeamDoc["_id"],
  field: "issueDate" | "sentAt",
  from: string | null,
  to: string | null,
) {
  if (field === "issueDate") {
    return ctx.db
      .query("publicInvoices")
      .withIndex("by_team_issue_date", (q) => {
        const range = q.eq("teamId", teamId);

        if (from && to) {
          return range.gte("issueDate", from).lte("issueDate", to);
        }

        if (from) {
          return range.gte("issueDate", from);
        }

        if (to) {
          return range.lte("issueDate", to);
        }

        return range;
      })
      .collect();
  }

  return ctx.db
    .query("publicInvoices")
    .withIndex("by_team_sent_at", (q) => {
      const range = q.eq("teamId", teamId);

      if (from && to) {
        return range.gte("sentAt", from).lte("sentAt", to);
      }

      if (from) {
        return range.gte("sentAt", from);
      }

      if (to) {
        return range.lte("sentAt", to);
      }

      return range;
    })
    .collect();
}

function serializePublicInvoice(record: {
  _id: string;
  publicInvoiceId?: string;
  token: string;
  status: string;
  paymentIntentId?: string;
  viewedAt?: string;
  invoiceNumber?: string;
  invoiceRecurringId?: string;
  recurringSequence?: number;
  payload: PublicInvoicePayload;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: record.publicInvoiceId ?? record._id,
    token: record.token,
    status: record.status,
    paymentIntentId: record.paymentIntentId ?? null,
    viewedAt: record.viewedAt ?? null,
    invoiceNumber: record.invoiceNumber ?? null,
    invoiceRecurringId: record.invoiceRecurringId ?? null,
    recurringSequence: record.recurringSequence ?? null,
    payload: record.payload,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

async function getPublicInvoiceForTeam(
  ctx: ReadCtx,
  args: {
    teamId: TeamDoc["_id"];
    invoiceId: string;
  },
) {
  const byPublicId = await ctx.db
    .query("publicInvoices")
    .withIndex("by_team_and_public_invoice_id", (q) =>
      q.eq("teamId", args.teamId).eq("publicInvoiceId", args.invoiceId),
    )
    .unique();

  if (byPublicId) {
    return byPublicId;
  }

  try {
    const byDocId = await ctx.db.get(args.invoiceId as Doc<"publicInvoices">["_id"]);

    if (byDocId && byDocId.teamId === args.teamId) {
      return byDocId;
    }
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.includes("db.get") ||
      !error.message.includes("Unable to decode ID")
    ) {
      throw error;
    }
  }

  return null;
}

export const serviceUpsertPublicInvoice = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    invoiceId: v.string(),
    token: v.string(),
    status: v.string(),
    paymentIntentId: v.optional(v.union(v.string(), v.null())),
    viewedAt: v.optional(v.union(v.string(), v.null())),
    invoiceNumber: v.optional(v.union(v.string(), v.null())),
    payload: v.any(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      throw new ConvexError("Convex public invoice team not found");
    }

    const timestamp = nowIso();
    const payload = args.payload as PublicInvoicePayload;
    const projectionFields = getPublicInvoiceProjectionFields(payload, args.invoiceNumber);
    const invoiceNumber = projectionFields.invoiceNumber ?? null;
    const searchText = getInvoiceSearchText(payload, args.invoiceNumber);
    const existing =
      (await ctx.db
        .query("publicInvoices")
        .withIndex("by_team_and_public_invoice_id", (q) =>
          q.eq("teamId", team._id).eq("publicInvoiceId", args.invoiceId),
        )
        .unique()) ??
      (await ctx.db
        .query("publicInvoices")
        .withIndex("by_token", (q) => q.eq("token", args.token))
        .unique());

    if (invoiceNumber) {
      const indexedMatches = await ctx.db
        .query("publicInvoices")
        .withIndex("by_team_and_invoice_number", (q) =>
          q.eq("teamId", team._id).eq("invoiceNumber", invoiceNumber),
        )
        .collect();
      const indexedConflict = indexedMatches.find(
        (record) => !isSamePublicInvoiceRecord(record, args, existing),
      );

      if (indexedConflict) {
        throw buildInvoiceNumberConflictError(invoiceNumber);
      }
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        publicInvoiceId: existing.publicInvoiceId ?? args.invoiceId,
        teamId: team._id,
        token: args.token,
        status: args.status,
        paymentIntentId: args.paymentIntentId ?? undefined,
        viewedAt: args.viewedAt ?? undefined,
        ...projectionFields,
        searchText,
        payload,
        updatedAt: timestamp,
      });

      await advanceNextInvoiceSequenceIfNeeded(ctx, team, invoiceNumber);

      const updated = await ctx.db.get(existing._id);

      if (!updated) {
        throw new ConvexError("Failed to update public invoice projection");
      }

      await syncInvoiceAggregatesForChange(ctx, team._id, existing, updated);
      await syncPublicInvoiceComplianceJournalEntryForChange(ctx, team, existing, updated);

      return serializePublicInvoice({
        _id: updated._id,
        publicInvoiceId: updated.publicInvoiceId,
        token: updated.token,
        status: updated.status,
        paymentIntentId: updated.paymentIntentId,
        viewedAt: updated.viewedAt,
        invoiceNumber: updated.invoiceNumber,
        invoiceRecurringId: updated.invoiceRecurringId,
        recurringSequence: updated.recurringSequence,
        payload: updated.payload as PublicInvoicePayload,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      });
    }

    const insertedId = await ctx.db.insert("publicInvoices", {
      publicInvoiceId: args.invoiceId,
      teamId: team._id,
      token: args.token,
      status: args.status,
      paymentIntentId: args.paymentIntentId ?? undefined,
      viewedAt: args.viewedAt ?? undefined,
      ...projectionFields,
      searchText,
      payload,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await advanceNextInvoiceSequenceIfNeeded(ctx, team, invoiceNumber);

    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError("Failed to create public invoice projection");
    }

    await syncInvoiceAggregatesForChange(ctx, team._id, null, inserted);
    await syncPublicInvoiceComplianceJournalEntryForChange(ctx, team, null, inserted);

    return serializePublicInvoice({
      _id: inserted._id,
      publicInvoiceId: inserted.publicInvoiceId,
      token: inserted.token,
      status: inserted.status,
      paymentIntentId: inserted.paymentIntentId,
      viewedAt: inserted.viewedAt,
      invoiceNumber: inserted.invoiceNumber,
      invoiceRecurringId: inserted.invoiceRecurringId,
      recurringSequence: inserted.recurringSequence,
      payload: inserted.payload as PublicInvoicePayload,
      createdAt: inserted.createdAt,
      updatedAt: inserted.updatedAt,
    });
  },
});

export const serviceGetPublicInvoiceByPublicInvoiceId = query({
  args: {
    serviceKey: v.string(),
    publicInvoiceId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const record = await ctx.db
      .query("publicInvoices")
      .withIndex("by_public_invoice_id", (q) => q.eq("publicInvoiceId", args.publicInvoiceId))
      .unique();

    if (!record) {
      return null;
    }

    return serializePublicInvoice({
      _id: record._id,
      publicInvoiceId: record.publicInvoiceId,
      token: record.token,
      status: record.status,
      paymentIntentId: record.paymentIntentId,
      viewedAt: record.viewedAt,
      invoiceNumber: record.invoiceNumber,
      payload: record.payload as PublicInvoicePayload,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  },
});

export const serviceGetPublicInvoiceByToken = query({
  args: {
    serviceKey: v.string(),
    token: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const record = await ctx.db
      .query("publicInvoices")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!record) {
      return null;
    }

    return serializePublicInvoice({
      _id: record._id,
      publicInvoiceId: record.publicInvoiceId,
      token: record.token,
      status: record.status,
      paymentIntentId: record.paymentIntentId,
      viewedAt: record.viewedAt,
      invoiceNumber: record.invoiceNumber,
      payload: record.payload as PublicInvoicePayload,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  },
});

export const serviceGetPublicInvoiceByInvoiceNumber = query({
  args: {
    serviceKey: v.string(),
    invoiceNumber: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const record = sortByNewestCreatedAt(
      await ctx.db
        .query("publicInvoices")
        .withIndex("by_invoice_number", (q) => q.eq("invoiceNumber", args.invoiceNumber))
        .collect(),
    )[0];

    if (!record) {
      return null;
    }

    return serializePublicInvoice({
      _id: record._id,
      publicInvoiceId: record.publicInvoiceId,
      token: record.token,
      status: record.status,
      paymentIntentId: record.paymentIntentId,
      viewedAt: record.viewedAt,
      invoiceNumber: record.invoiceNumber,
      payload: record.payload as PublicInvoicePayload,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  },
});

export const serviceGetPublicInvoiceByTeamAndInvoiceNumber = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    invoiceNumber: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return null;
    }

    const indexedRecord = sortByNewestCreatedAt(
      await ctx.db
        .query("publicInvoices")
        .withIndex("by_team_and_invoice_number", (q) =>
          q.eq("teamId", team._id).eq("invoiceNumber", args.invoiceNumber),
        )
        .collect(),
    )[0];
    const record = indexedRecord;

    if (!record) {
      return null;
    }

    return serializePublicInvoice({
      _id: record._id,
      publicInvoiceId: record.publicInvoiceId,
      token: record.token,
      status: record.status,
      paymentIntentId: record.paymentIntentId,
      viewedAt: record.viewedAt,
      invoiceNumber: record.invoiceNumber,
      payload: record.payload as PublicInvoicePayload,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  },
});

export const serviceGetPublicInvoiceByRecurringSequence = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    invoiceRecurringId: v.string(),
    recurringSequence: v.number(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return null;
    }

    const indexedRecord = sortByNewestCreatedAt(
      await ctx.db
        .query("publicInvoices")
        .withIndex("by_team_invoice_recurring_sequence", (q) =>
          q
            .eq("teamId", team._id)
            .eq("invoiceRecurringId", args.invoiceRecurringId)
            .eq("recurringSequence", args.recurringSequence),
        )
        .collect(),
    )[0];
    const record = indexedRecord;

    if (!record) {
      return null;
    }

    return serializePublicInvoice({
      _id: record._id,
      publicInvoiceId: record.publicInvoiceId,
      token: record.token,
      status: record.status,
      paymentIntentId: record.paymentIntentId,
      viewedAt: record.viewedAt,
      invoiceNumber: record.invoiceNumber,
      invoiceRecurringId: record.invoiceRecurringId,
      recurringSequence: record.recurringSequence,
      payload: record.payload as PublicInvoicePayload,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  },
});

export const serviceGetPublicInvoicesByRecurringId = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    invoiceRecurringId: v.string(),
    statuses: v.optional(v.array(v.string())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const records = sortByRecurringSequence(
      await ctx.db
        .query("publicInvoices")
        .withIndex("by_team_and_invoice_recurring_id", (q) =>
          q.eq("teamId", team._id).eq("invoiceRecurringId", args.invoiceRecurringId),
        )
        .collect(),
    ).filter((record) => (args.statuses ? args.statuses.includes(record.status) : true));

    return records.map((record) =>
      serializePublicInvoice({
        _id: record._id,
        publicInvoiceId: record.publicInvoiceId,
        token: record.token,
        status: record.status,
        paymentIntentId: record.paymentIntentId,
        viewedAt: record.viewedAt,
        invoiceNumber: record.invoiceNumber,
        invoiceRecurringId: record.invoiceRecurringId,
        recurringSequence: record.recurringSequence,
        payload: record.payload as PublicInvoicePayload,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }),
    );
  },
});

export const serviceGetNextInvoiceNumberPreview = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      throw new ConvexError("Convex public invoice team not found");
    }

    const nextSequence =
      typeof team.nextInvoiceSequence === "number"
        ? team.nextInvoiceSequence
        : await getNextInvoiceSequencePreview(ctx, team._id);

    return formatInvoiceNumber(nextSequence);
  },
});

export const serviceAllocateNextInvoiceNumber = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      throw new ConvexError("Convex public invoice team not found");
    }

    const nextSequence = await getNextInvoiceSequence(ctx, team);

    await ctx.db.patch(team._id, {
      nextInvoiceSequence: nextSequence + 1,
    });

    return formatInvoiceNumber(nextSequence);
  },
});

export const serviceGetPublicInvoicesByTeam = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const records = await ctx.db
      .query("publicInvoices")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect();

    return records.map((record) =>
      serializePublicInvoice({
        _id: record._id,
        publicInvoiceId: record.publicInvoiceId,
        token: record.token,
        status: record.status,
        paymentIntentId: record.paymentIntentId,
        viewedAt: record.viewedAt,
        invoiceNumber: record.invoiceNumber,
        payload: record.payload as PublicInvoicePayload,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }),
    );
  },
});

export const serviceGetPublicInvoicesByCustomerIds = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    customerIds: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.customerIds.length === 0) {
      return [];
    }

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const records = await Promise.all(
      [...new Set(args.customerIds)].map((customerId) =>
        ctx.db
          .query("publicInvoices")
          .withIndex("by_team_and_customer", (q) =>
            q.eq("teamId", team._id).eq("customerId", customerId),
          )
          .collect(),
      ),
    );

    return records.flat().map((record) =>
      serializePublicInvoice({
        _id: record._id,
        publicInvoiceId: record.publicInvoiceId,
        token: record.token,
        status: record.status,
        paymentIntentId: record.paymentIntentId,
        viewedAt: record.viewedAt,
        invoiceNumber: record.invoiceNumber,
        invoiceRecurringId: record.invoiceRecurringId,
        recurringSequence: record.recurringSequence,
        payload: record.payload as PublicInvoicePayload,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }),
    );
  },
});

export const serviceGetInvoiceAggregateRows = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    customerId: v.optional(v.string()),
    statuses: v.optional(v.array(v.string())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const scopeKey = getInvoiceAggregateScopeKey(args.customerId);
    const statuses = [...new Set(args.statuses ?? [])];
    const records =
      statuses.length > 0
        ? (
            await Promise.all(
              statuses.map((status) =>
                ctx.db
                  .query("invoiceAggregates")
                  .withIndex("by_team_scope_status", (q) =>
                    q.eq("teamId", team._id).eq("scopeKey", scopeKey).eq("status", status),
                  )
                  .collect(),
              ),
            )
          ).flat()
        : await ctx.db
            .query("invoiceAggregates")
            .withIndex("by_team_scope", (q) => q.eq("teamId", team._id).eq("scopeKey", scopeKey))
            .collect();

    return records.map(serializeInvoiceAggregate);
  },
});

export const serviceGetInvoiceDateAggregateRows = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    statuses: v.array(v.string()),
    dateField: invoiceAggregateDateFieldValidator,
    dateFrom: v.optional(v.union(v.string(), v.null())),
    dateTo: v.optional(v.union(v.string(), v.null())),
    currency: v.optional(v.union(v.string(), v.null())),
    recurring: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.statuses.length === 0) {
      return [];
    }

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const records = (
      await Promise.all(
        [...new Set(args.statuses)].map((status) =>
          ctx.db
            .query("invoiceDateAggregates")
            .withIndex("by_team_status_date_field_date", (q) => {
              const range = q
                .eq("teamId", team._id)
                .eq("status", status)
                .eq("dateField", args.dateField);

              if (args.dateFrom && args.dateTo) {
                return range.gte("date", args.dateFrom).lte("date", args.dateTo);
              }

              if (args.dateFrom) {
                return range.gte("date", args.dateFrom);
              }

              if (args.dateTo) {
                return range.lte("date", args.dateTo);
              }

              return range;
            })
            .collect(),
        ),
      )
    ).flat();

    return records
      .filter((record) =>
        args.currency === undefined || args.currency === null
          ? true
          : record.currency === args.currency,
      )
      .filter((record) =>
        args.recurring === undefined ? true : record.recurring === args.recurring,
      )
      .map(serializeInvoiceDateAggregate);
  },
});

export const serviceGetInvoiceCustomerDateAggregateRows = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    statuses: v.array(v.string()),
    dateField: invoiceCustomerAggregateDateFieldValidator,
    dateFrom: v.optional(v.union(v.string(), v.null())),
    dateTo: v.optional(v.union(v.string(), v.null())),
    currency: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.statuses.length === 0) {
      return [];
    }

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const records = (
      await Promise.all(
        [...new Set(args.statuses)].map((status) =>
          ctx.db
            .query("invoiceCustomerDateAggregates")
            .withIndex("by_team_status_date_field_date", (q) => {
              const range = q
                .eq("teamId", team._id)
                .eq("status", status)
                .eq("dateField", args.dateField);

              if (args.dateFrom && args.dateTo) {
                return range.gte("date", args.dateFrom).lte("date", args.dateTo);
              }

              if (args.dateFrom) {
                return range.gte("date", args.dateFrom);
              }

              if (args.dateTo) {
                return range.lte("date", args.dateTo);
              }

              return range;
            })
            .collect(),
        ),
      )
    ).flat();

    return records
      .filter((record) =>
        args.currency === undefined || args.currency === null
          ? true
          : record.currency === args.currency,
      )
      .map(serializeInvoiceCustomerDateAggregate);
  },
});

export const serviceGetInvoiceAnalyticsAggregateRows = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    dateField: invoiceAnalyticsAggregateDateFieldValidator,
    statuses: v.optional(v.array(v.string())),
    dateFrom: v.optional(v.union(v.string(), v.null())),
    dateTo: v.optional(v.union(v.string(), v.null())),
    currency: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const normalizedStatuses =
      args.statuses && args.statuses.length > 0 ? [...new Set(args.statuses)] : null;
    const records = normalizedStatuses
      ? (
          await Promise.all(
            normalizedStatuses.map((status) =>
              ctx.db
                .query("invoiceAnalyticsAggregates")
                .withIndex("by_team_date_field_status_date", (q) => {
                  const range = q
                    .eq("teamId", team._id)
                    .eq("dateField", args.dateField)
                    .eq("status", status);

                  if (args.dateFrom && args.dateTo) {
                    return range.gte("date", args.dateFrom).lte("date", args.dateTo);
                  }

                  if (args.dateFrom) {
                    return range.gte("date", args.dateFrom);
                  }

                  if (args.dateTo) {
                    return range.lte("date", args.dateTo);
                  }

                  return range;
                })
                .collect(),
            ),
          )
        ).flat()
      : await ctx.db
          .query("invoiceAnalyticsAggregates")
          .withIndex("by_team_date_field_date", (q) => {
            const range = q.eq("teamId", team._id).eq("dateField", args.dateField);

            if (args.dateFrom && args.dateTo) {
              return range.gte("date", args.dateFrom).lte("date", args.dateTo);
            }

            if (args.dateFrom) {
              return range.gte("date", args.dateFrom);
            }

            if (args.dateTo) {
              return range.lte("date", args.dateTo);
            }

            return range;
          })
          .collect();

    return records
      .filter((record) =>
        args.currency === undefined || args.currency === null
          ? true
          : record.currency === args.currency,
      )
      .map(serializeInvoiceAnalyticsAggregate);
  },
});

export const serviceGetInvoiceAgingAggregateRows = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    statuses: v.array(v.string()),
    currency: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.statuses.length === 0) {
      return [];
    }

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const records = (
      await Promise.all(
        [...new Set(args.statuses)].map((status) =>
          ctx.db
            .query("invoiceAgingAggregates")
            .withIndex("by_team_status", (q) => q.eq("teamId", team._id).eq("status", status))
            .collect(),
        ),
      )
    ).flat();

    return records
      .filter((record) =>
        args.currency === undefined || args.currency === null
          ? true
          : record.currency === args.currency,
      )
      .map(serializeInvoiceAgingAggregate);
  },
});

export const serviceRebuildInvoiceReportAggregates = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const teams = args.publicTeamId
      ? [await getTeamByPublicTeamId(ctx, args.publicTeamId)]
      : (await ctx.db.query("teams").collect()).filter((team) => !!team.publicTeamId);

    const validTeams = teams.filter(
      (team): team is NonNullable<(typeof teams)[number]> => team !== null,
    );

    if (args.publicTeamId && validTeams.length === 0) {
      throw new ConvexError("Convex public invoice team not found");
    }

    const results = [];

    for (const team of validTeams) {
      results.push(await rebuildInvoiceReportAggregatesForTeam(ctx, team));
    }

    return results;
  },
});

export const serviceRebuildPublicInvoiceSearchTexts = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const teams = args.publicTeamId
      ? [await getTeamByPublicTeamId(ctx, args.publicTeamId)]
      : (await ctx.db.query("teams").collect()).filter((team) => !!team.publicTeamId);

    const validTeams = teams.filter(
      (team): team is NonNullable<(typeof teams)[number]> => team !== null,
    );

    if (args.publicTeamId && validTeams.length === 0) {
      throw new ConvexError("Convex public invoice team not found");
    }

    const results = [];

    for (const team of validTeams) {
      results.push(await rebuildPublicInvoiceSearchTextsForTeam(ctx, team));
    }

    return results;
  },
});

export const serviceGetPublicInvoicesByIds = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    invoiceIds: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.invoiceIds.length === 0) {
      return [];
    }

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const records = await Promise.all(
      [...new Set(args.invoiceIds)].map((invoiceId) =>
        getPublicInvoiceForTeam(ctx, {
          teamId: team._id,
          invoiceId,
        }),
      ),
    );

    return records
      .filter((record): record is PublicInvoiceDoc => record !== null)
      .map((record) =>
        serializePublicInvoice({
          _id: record._id,
          publicInvoiceId: record.publicInvoiceId,
          token: record.token,
          status: record.status,
          paymentIntentId: record.paymentIntentId,
          viewedAt: record.viewedAt,
          invoiceNumber: record.invoiceNumber,
          invoiceRecurringId: record.invoiceRecurringId,
          recurringSequence: record.recurringSequence,
          payload: record.payload as PublicInvoicePayload,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        }),
      );
  },
});

export const serviceListPublicInvoicesPage = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    status: v.optional(v.string()),
    order: v.optional(publicInvoiceOrderValidator),
    createdAtFrom: v.optional(v.string()),
    createdAtTo: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return {
        page: [],
        isDone: true,
        continueCursor: args.paginationOpts.cursor ?? "",
        splitCursor: null,
        pageStatus: null,
      };
    }

    const db = ctx.db as any;
    const baseQuery = args.status
      ? ctx.db.query("publicInvoices").withIndex("by_team_status_created_at", (q) => {
          const range = q.eq("teamId", team._id).eq("status", args.status!);

          if (args.createdAtFrom && args.createdAtTo) {
            return range.gte("createdAt", args.createdAtFrom).lte("createdAt", args.createdAtTo);
          }

          if (args.createdAtFrom) {
            return range.gte("createdAt", args.createdAtFrom);
          }

          if (args.createdAtTo) {
            return range.lte("createdAt", args.createdAtTo);
          }

          return range;
        })
      : db.query("publicInvoices").withIndex("by_team_created_at", (q: any) => {
          const range = q.eq("teamId", team._id);

          if (args.createdAtFrom && args.createdAtTo) {
            return range.gte("createdAt", args.createdAtFrom).lte("createdAt", args.createdAtTo);
          }

          if (args.createdAtFrom) {
            return range.gte("createdAt", args.createdAtFrom);
          }

          if (args.createdAtTo) {
            return range.lte("createdAt", args.createdAtTo);
          }

          return range;
        });

    const orderedQuery = baseQuery.order(args.order ?? "desc");
    const result = await orderedQuery.paginate(args.paginationOpts);

    return {
      ...result,
      page: result.page.map((record: PublicInvoiceDoc) =>
        serializePublicInvoice({
          _id: record._id,
          publicInvoiceId: record.publicInvoiceId,
          token: record.token,
          status: record.status,
          paymentIntentId: record.paymentIntentId,
          viewedAt: record.viewedAt,
          invoiceNumber: record.invoiceNumber,
          invoiceRecurringId: record.invoiceRecurringId,
          recurringSequence: record.recurringSequence,
          payload: record.payload as PublicInvoicePayload,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        }),
      ),
    };
  },
});

export const serviceSearchPublicInvoices = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    query: v.string(),
    status: v.optional(v.union(v.string(), v.null())),
    limit: v.optional(v.number()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);
    const searchQuery = buildSearchQuery(args.query);

    if (!team || searchQuery.length === 0) {
      return [];
    }

    const records = await ctx.db
      .query("publicInvoices")
      .withSearchIndex("search_by_team", (q) =>
        q.search("searchText", searchQuery).eq("teamId", team._id),
      )
      .take(Math.max(1, Math.min((args.limit ?? 100) * 4, 400)));

    return records
      .filter((record) =>
        args.status === undefined || args.status === null ? true : record.status === args.status,
      )
      .slice(0, args.limit ?? records.length)
      .map((record) =>
        serializePublicInvoice({
          _id: record._id,
          publicInvoiceId: record.publicInvoiceId,
          token: record.token,
          status: record.status,
          paymentIntentId: record.paymentIntentId,
          viewedAt: record.viewedAt,
          invoiceNumber: record.invoiceNumber,
          invoiceRecurringId: record.invoiceRecurringId,
          recurringSequence: record.recurringSequence,
          payload: record.payload as PublicInvoicePayload,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        }),
      );
  },
});

export const serviceGetPublicInvoicesByFilters = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    statuses: v.optional(v.array(v.string())),
    currency: v.optional(v.string()),
    dateField: v.optional(publicInvoiceDateFieldValidator),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const statuses = args.statuses && args.statuses.length > 0 ? args.statuses : null;
    const dateField = args.dateField ?? null;
    const from = normalizeDateBoundary(args.from, "start");
    const to = normalizeDateBoundary(args.to, "end");

    let records: PublicInvoiceDoc[];

    if (statuses && dateField === "createdAt") {
      records = await getPublicInvoicesByStatusAndCreatedAt(ctx, team._id, statuses, from, to);
    } else if (!statuses && dateField === "createdAt") {
      records = await getPublicInvoicesByCreatedAt(ctx, team._id, from, to);
    } else if (statuses && dateField && dateField !== "createdAt" && dateField !== "sentAt") {
      records = await getPublicInvoicesByStatusAndDateField(
        ctx,
        team._id,
        statuses,
        dateField,
        from,
        to,
      );
    } else if (
      !statuses &&
      dateField &&
      dateField !== "createdAt" &&
      dateField !== "dueDate" &&
      dateField !== "paidAt"
    ) {
      records = await getPublicInvoicesByTeamDateField(ctx, team._id, dateField, from, to);
    } else if (statuses) {
      records = await getPublicInvoicesByStatuses(ctx, team._id, statuses);
    } else {
      records = await ctx.db
        .query("publicInvoices")
        .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
        .collect();
    }

    const filteredRecords = records.filter((record) => {
      if (statuses && !statuses.includes(record.status)) {
        return false;
      }

      if (dateField) {
        const dateValue = getStoredDateFieldValue(record, dateField);

        if (!matchesDateRange(dateValue, from, to)) {
          return false;
        }
      }

      if (args.currency && record.currency !== args.currency) {
        return false;
      }

      return true;
    });

    return filteredRecords.map((record) =>
      serializePublicInvoice({
        _id: record._id,
        publicInvoiceId: record.publicInvoiceId,
        token: record.token,
        status: record.status,
        paymentIntentId: record.paymentIntentId,
        viewedAt: record.viewedAt,
        invoiceNumber: record.invoiceNumber,
        invoiceRecurringId: record.invoiceRecurringId,
        recurringSequence: record.recurringSequence,
        payload: record.payload as PublicInvoicePayload,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }),
    );
  },
});

export const serviceGetPublicInvoicesByStatuses = query({
  args: {
    serviceKey: v.string(),
    statuses: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const records = await Promise.all(
      args.statuses.map((status) =>
        ctx.db
          .query("publicInvoices")
          .withIndex("by_status", (q) => q.eq("status", status))
          .collect(),
      ),
    );

    return records.flat().map((record) =>
      serializePublicInvoice({
        _id: record._id,
        publicInvoiceId: record.publicInvoiceId,
        token: record.token,
        status: record.status,
        paymentIntentId: record.paymentIntentId,
        viewedAt: record.viewedAt,
        invoiceNumber: record.invoiceNumber,
        payload: record.payload as PublicInvoicePayload,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }),
    );
  },
});

export const serviceGetPublicInvoiceByPaymentIntentId = query({
  args: {
    serviceKey: v.string(),
    paymentIntentId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const record = await ctx.db
      .query("publicInvoices")
      .withIndex("by_payment_intent_id", (q) => q.eq("paymentIntentId", args.paymentIntentId))
      .unique();

    if (!record) {
      return null;
    }

    return serializePublicInvoice({
      _id: record._id,
      publicInvoiceId: record.publicInvoiceId,
      token: record.token,
      status: record.status,
      paymentIntentId: record.paymentIntentId,
      viewedAt: record.viewedAt,
      invoiceNumber: record.invoiceNumber,
      payload: record.payload as PublicInvoicePayload,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  },
});

export const serviceDeletePublicInvoice = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    invoiceId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return null;
    }

    const record = await ctx.db
      .query("publicInvoices")
      .withIndex("by_team_and_public_invoice_id", (q) =>
        q.eq("teamId", team._id).eq("publicInvoiceId", args.invoiceId),
      )
      .unique();

    if (!record) {
      return null;
    }

    await ctx.db.delete(record._id);
    await syncInvoiceAggregatesForChange(ctx, team._id, record, null);
    await syncPublicInvoiceComplianceJournalEntryForChange(ctx, team, record, null);

    return serializePublicInvoice({
      _id: record._id,
      publicInvoiceId: record.publicInvoiceId,
      token: record.token,
      status: record.status,
      paymentIntentId: record.paymentIntentId,
      viewedAt: record.viewedAt,
      invoiceNumber: record.invoiceNumber,
      payload: record.payload as PublicInvoicePayload,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  },
});
