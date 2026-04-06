import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import {
  CONTRA_REVENUE_CATEGORIES,
  getTaxRateForCategory,
  getTaxTypeForCountry,
  REVENUE_CATEGORIES,
} from "../../packages/categories/src/index";
import { nowIso } from "../../packages/domain/src/identity";
import {
  buildAbsoluteAmountSearchValue,
  buildSearchIndexText,
  buildSearchQuery,
} from "../../packages/domain/src/text-search";
import type { Doc, Id } from "./_generated/dataModel";
import {
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { syncTransactionComplianceJournalEntriesForChanges } from "./complianceLedger";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";

type TransactionCtx = QueryCtx | MutationCtx;
type TeamDoc = Doc<"teams">;

const nullableString = v.optional(v.union(v.string(), v.null()));
const nullableNumber = v.optional(v.union(v.number(), v.null()));
const nullableBoolean = v.optional(v.union(v.boolean(), v.null()));

const transactionMethod = v.union(
  v.literal("payment"),
  v.literal("card_purchase"),
  v.literal("card_atm"),
  v.literal("transfer"),
  v.literal("other"),
  v.literal("unknown"),
  v.literal("ach"),
  v.literal("interest"),
  v.literal("deposit"),
  v.literal("wire"),
  v.literal("fee"),
);

const transactionStatus = v.union(
  v.literal("posted"),
  v.literal("pending"),
  v.literal("excluded"),
  v.literal("completed"),
  v.literal("archived"),
  v.literal("exported"),
);

const transactionFrequency = v.union(
  v.literal("weekly"),
  v.literal("biweekly"),
  v.literal("monthly"),
  v.literal("semi_monthly"),
  v.literal("annually"),
  v.literal("irregular"),
  v.literal("unknown"),
);
const transactionOrder = v.union(v.literal("asc"), v.literal("desc"));
const transactionAggregateScope = v.union(
  v.literal("base"),
  v.literal("native"),
);
const transactionAggregateDirection = v.union(
  v.literal("income"),
  v.literal("expense"),
);

const transactionRecord = v.object({
  id: v.string(),
  createdAt: v.string(),
  date: v.string(),
  name: v.string(),
  method: transactionMethod,
  amount: v.number(),
  currency: v.string(),
  assignedId: nullableString,
  note: nullableString,
  bankAccountId: nullableString,
  internalId: v.string(),
  status: transactionStatus,
  balance: nullableNumber,
  manual: v.boolean(),
  notified: nullableBoolean,
  internal: nullableBoolean,
  description: nullableString,
  categorySlug: nullableString,
  baseAmount: nullableNumber,
  counterpartyName: nullableString,
  baseCurrency: nullableString,
  taxAmount: nullableNumber,
  taxRate: nullableNumber,
  taxType: nullableString,
  recurring: nullableBoolean,
  frequency: v.optional(v.union(transactionFrequency, v.null())),
  merchantName: nullableString,
  enrichmentCompleted: nullableBoolean,
  hasAttachment: nullableBoolean,
});

type TransactionMetricAggregateDoc = Doc<"transactionMetricAggregates">;
type TransactionRecurringAggregateDoc = Doc<"transactionRecurringAggregates">;
type TransactionTaxAggregateDoc = Doc<"transactionTaxAggregates">;
type TransactionAggregateScope = "base" | "native";
type TransactionAggregateDirection = "income" | "expense";
type TransactionRecurringAggregateFrequency = NonNullable<
  Doc<"transactions">["frequency"]
> | null;
type TransactionAggregateKey = {
  teamId: Id<"teams">;
  scope: TransactionAggregateScope;
  date: string;
  currency: string;
  direction: TransactionAggregateDirection;
  categorySlug: string | null;
  recurring: boolean;
};
type TransactionAggregateEntry = TransactionAggregateKey & {
  amount: number;
  netAmount: number;
};
type TransactionRecurringAggregateKey = {
  teamId: Id<"teams">;
  scope: TransactionAggregateScope;
  direction: TransactionAggregateDirection;
  currency: string;
  date: string;
  name: string;
  frequency: TransactionRecurringAggregateFrequency;
  categorySlug: string | null;
};
type TransactionRecurringAggregateEntry = TransactionRecurringAggregateKey & {
  amount: number;
  createdAt: string;
};
type TransactionTaxAggregateKey = {
  teamId: Id<"teams">;
  scope: TransactionAggregateScope;
  date: string;
  currency: string;
  direction: TransactionAggregateDirection;
  categorySlug: string | null;
  taxType: string | null;
  taxRate: number;
};
type TransactionTaxAggregateEntry = TransactionTaxAggregateKey & {
  totalTaxAmount: number;
  totalTransactionAmount: number;
};
type TransactionMetricAggregateBackfillEntry = {
  key: TransactionAggregateKey;
  totalAmount: number;
  totalNetAmount: number;
  transactionCount: number;
};
type TransactionRecurringAggregateBackfillEntry = {
  key: TransactionRecurringAggregateKey;
  totalAmount: number;
  transactionCount: number;
  latestAmount: number;
  latestTransactionCreatedAt: string;
};
type TransactionTaxAggregateBackfillEntry = {
  key: TransactionTaxAggregateKey;
  totalTaxAmount: number;
  totalTransactionAmount: number;
  transactionCount: number;
};
type TaggedTransactionCursor = {
  date: string;
  transactionId: string;
};

function roundAggregateAmount(value: number) {
  return Math.round(value * 100) / 100;
}

function roundAggregateTaxRate(value: number) {
  return Math.round(value * 10000) / 10000;
}

function decodeTaggedTransactionCursor(
  cursor: string | null | undefined,
): TaggedTransactionCursor | null {
  if (!cursor) {
    return null;
  }

  try {
    const normalizedCursor = cursor.replace(/-/g, "+").replace(/_/g, "/");
    const paddedCursor =
      normalizedCursor + "=".repeat((4 - (normalizedCursor.length % 4)) % 4);
    const parsed = JSON.parse(
      atob(paddedCursor),
    ) as Partial<TaggedTransactionCursor>;

    if (
      typeof parsed.date !== "string" ||
      typeof parsed.transactionId !== "string"
    ) {
      throw new ConvexError("Invalid tagged transaction cursor");
    }

    return {
      date: parsed.date,
      transactionId: parsed.transactionId,
    };
  } catch {
    throw new ConvexError("Invalid tagged transaction cursor");
  }
}

function encodeTaggedTransactionCursor(cursor: TaggedTransactionCursor) {
  return btoa(JSON.stringify(cursor))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function compareTaggedTransactionRows(
  left: Pick<Doc<"transactionTags">, "transactionDate" | "transactionId">,
  right: Pick<Doc<"transactionTags">, "transactionDate" | "transactionId">,
  order: "asc" | "desc",
) {
  const dateComparison = left.transactionDate!.localeCompare(
    right.transactionDate!,
  );

  if (dateComparison !== 0) {
    return order === "asc" ? dateComparison : -dateComparison;
  }

  const transactionIdComparison = left.transactionId.localeCompare(
    right.transactionId,
  );

  return order === "asc" ? transactionIdComparison : -transactionIdComparison;
}

function isTaggedTransactionRowPastCursor(
  row: Pick<Doc<"transactionTags">, "transactionDate" | "transactionId">,
  cursor: TaggedTransactionCursor | null,
  order: "asc" | "desc",
) {
  if (!cursor || !row.transactionDate) {
    return false;
  }

  if (order === "asc") {
    return (
      row.transactionDate < cursor.date ||
      (row.transactionDate === cursor.date &&
        row.transactionId <= cursor.transactionId)
    );
  }

  return (
    row.transactionDate > cursor.date ||
    (row.transactionDate === cursor.date &&
      row.transactionId >= cursor.transactionId)
  );
}

function publicTransactionId(
  transaction: Pick<Doc<"transactions">, "_id" | "publicTransactionId">,
) {
  return transaction.publicTransactionId ?? transaction._id;
}

function serializeTransaction(
  publicTeamId: string,
  transaction: Doc<"transactions">,
) {
  return {
    id: publicTransactionId(transaction),
    teamId: publicTeamId,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
    date: transaction.date,
    name: transaction.name,
    method: transaction.method,
    amount: transaction.amount,
    currency: transaction.currency,
    assignedId: transaction.assignedId ?? null,
    note: transaction.note ?? null,
    bankAccountId: transaction.bankAccountId ?? null,
    internalId: transaction.internalId,
    status: transaction.status,
    balance: transaction.balance ?? null,
    manual: transaction.manual,
    notified: transaction.notified ?? false,
    internal: transaction.internal ?? false,
    description: transaction.description ?? null,
    categorySlug: transaction.categorySlug ?? null,
    baseAmount: transaction.baseAmount ?? null,
    counterpartyName: transaction.counterpartyName ?? null,
    baseCurrency: transaction.baseCurrency ?? null,
    taxAmount: transaction.taxAmount ?? null,
    taxRate: transaction.taxRate ?? null,
    taxType: transaction.taxType ?? null,
    recurring: transaction.recurring ?? false,
    frequency: transaction.frequency ?? null,
    merchantName: transaction.merchantName ?? null,
    enrichmentCompleted: transaction.enrichmentCompleted ?? false,
    hasAttachment: transaction.hasAttachment ?? false,
  };
}

function getTransactionAggregateDirection(
  amount: number,
): TransactionAggregateDirection | null {
  if (amount > 0) {
    return "income";
  }

  if (amount < 0) {
    return "expense";
  }

  return null;
}

function getTransactionBaseAggregateAmount(transaction: Doc<"transactions">) {
  if (!transaction.baseCurrency) {
    return null;
  }

  if (transaction.baseAmount !== undefined && transaction.baseAmount !== null) {
    return transaction.baseAmount;
  }

  if (transaction.currency === transaction.baseCurrency) {
    return transaction.amount;
  }

  return null;
}

function shouldAggregateTransactionForMetrics(
  transaction: Doc<"transactions">,
) {
  return !transaction.internal && transaction.status !== "excluded";
}

function isRevenueCategory(slug: string | null) {
  if (!slug) {
    return false;
  }

  return (
    REVENUE_CATEGORIES.includes(slug as (typeof REVENUE_CATEGORIES)[number]) &&
    !CONTRA_REVENUE_CATEGORIES.includes(
      slug as (typeof CONTRA_REVENUE_CATEGORIES)[number],
    )
  );
}

function getEffectiveTransactionTaxRate(
  transaction: Doc<"transactions">,
  teamCountryCode: string | null | undefined,
) {
  if (transaction.taxRate !== undefined && transaction.taxRate !== null) {
    return transaction.taxRate;
  }

  if (!teamCountryCode || !transaction.categorySlug) {
    return 0;
  }

  return getTaxRateForCategory(teamCountryCode, transaction.categorySlug) ?? 0;
}

function getEffectiveTransactionTaxType(
  transaction: Doc<"transactions">,
  teamCountryCode: string | null | undefined,
) {
  return (
    transaction.taxType ??
    (teamCountryCode ? getTaxTypeForCountry(teamCountryCode) : null)
  );
}

function getTransactionNetAggregateAmount(args: {
  transaction: Doc<"transactions">;
  amount: number;
  direction: TransactionAggregateDirection;
  teamCountryCode: string | null | undefined;
}) {
  if (
    args.direction !== "income" ||
    !isRevenueCategory(args.transaction.categorySlug ?? null)
  ) {
    return args.amount;
  }

  const effectiveTaxRate = getEffectiveTransactionTaxRate(
    args.transaction,
    args.teamCountryCode,
  );

  if (effectiveTaxRate <= 0) {
    return args.amount;
  }

  return (
    Math.round(
      (args.amount -
        (args.amount * effectiveTaxRate) / (100 + effectiveTaxRate)) *
        100,
    ) / 100
  );
}

function getTransactionMetricAggregateEntries(
  transaction: Doc<"transactions">,
  teamCountryCode?: string | null,
): TransactionAggregateEntry[] {
  if (!shouldAggregateTransactionForMetrics(transaction)) {
    return [];
  }

  const entries: TransactionAggregateEntry[] = [];
  const nativeDirection = getTransactionAggregateDirection(transaction.amount);

  if (nativeDirection) {
    entries.push({
      teamId: transaction.teamId,
      scope: "native",
      date: transaction.date,
      currency: transaction.currency,
      direction: nativeDirection,
      categorySlug: transaction.categorySlug ?? null,
      recurring: transaction.recurring ?? false,
      amount: transaction.amount,
      netAmount: getTransactionNetAggregateAmount({
        transaction,
        amount: transaction.amount,
        direction: nativeDirection,
        teamCountryCode,
      }),
    });
  }

  const baseAmount = getTransactionBaseAggregateAmount(transaction);
  const baseDirection =
    baseAmount === null ? null : getTransactionAggregateDirection(baseAmount);

  if (transaction.baseCurrency && baseAmount !== null && baseDirection) {
    entries.push({
      teamId: transaction.teamId,
      scope: "base",
      date: transaction.date,
      currency: transaction.baseCurrency,
      direction: baseDirection,
      categorySlug: transaction.categorySlug ?? null,
      recurring: transaction.recurring ?? false,
      amount: baseAmount,
      netAmount: getTransactionNetAggregateAmount({
        transaction,
        amount: baseAmount,
        direction: baseDirection,
        teamCountryCode,
      }),
    });
  }

  return entries;
}

function getTransactionRecurringAggregateEntries(
  transaction: Doc<"transactions">,
): TransactionRecurringAggregateEntry[] {
  if (
    !shouldAggregateTransactionForMetrics(transaction) ||
    !transaction.recurring
  ) {
    return [];
  }

  const entries: TransactionRecurringAggregateEntry[] = [];
  const nativeDirection = getTransactionAggregateDirection(transaction.amount);

  if (nativeDirection) {
    entries.push({
      teamId: transaction.teamId,
      scope: "native",
      direction: nativeDirection,
      currency: transaction.currency,
      date: transaction.date,
      name: transaction.name,
      frequency: transaction.frequency ?? null,
      categorySlug: transaction.categorySlug ?? null,
      amount: transaction.amount,
      createdAt: transaction.createdAt,
    });
  }

  const baseAmount = getTransactionBaseAggregateAmount(transaction);
  const baseDirection =
    baseAmount === null ? null : getTransactionAggregateDirection(baseAmount);

  if (transaction.baseCurrency && baseAmount !== null && baseDirection) {
    entries.push({
      teamId: transaction.teamId,
      scope: "base",
      direction: baseDirection,
      currency: transaction.baseCurrency,
      date: transaction.date,
      name: transaction.name,
      frequency: transaction.frequency ?? null,
      categorySlug: transaction.categorySlug ?? null,
      amount: baseAmount,
      createdAt: transaction.createdAt,
    });
  }

  return entries;
}

function getTransactionTaxAggregateEntries(
  transaction: Doc<"transactions">,
  teamCountryCode: string | null | undefined,
): TransactionTaxAggregateEntry[] {
  if (!shouldAggregateTransactionForMetrics(transaction)) {
    return [];
  }

  const entries: TransactionTaxAggregateEntry[] = [];
  const effectiveTaxRate = roundAggregateTaxRate(
    getEffectiveTransactionTaxRate(transaction, teamCountryCode),
  );
  const effectiveTaxType = getEffectiveTransactionTaxType(
    transaction,
    teamCountryCode,
  );
  const buildEntry = (
    amount: number,
    scope: TransactionAggregateScope,
    currency: string,
  ) => {
    const direction = getTransactionAggregateDirection(amount);

    if (!direction) {
      return;
    }

    entries.push({
      teamId: transaction.teamId,
      scope,
      date: transaction.date,
      currency,
      direction,
      categorySlug: transaction.categorySlug ?? null,
      taxType: effectiveTaxType,
      taxRate: effectiveTaxRate,
      totalTaxAmount:
        effectiveTaxRate > 0
          ? roundAggregateAmount(
              Math.abs((amount * effectiveTaxRate) / (100 + effectiveTaxRate)),
            )
          : 0,
      totalTransactionAmount: roundAggregateAmount(Math.abs(amount)),
    });
  };

  buildEntry(transaction.amount, "native", transaction.currency);

  const baseAmount = getTransactionBaseAggregateAmount(transaction);

  if (transaction.baseCurrency && baseAmount !== null) {
    buildEntry(baseAmount, "base", transaction.baseCurrency);
  }

  return entries;
}

function serializeTransactionAggregateKey(key: TransactionAggregateKey) {
  return [
    key.teamId,
    key.scope,
    key.date,
    key.currency,
    key.direction,
    key.categorySlug ?? "",
    key.recurring ? "1" : "0",
  ].join(":");
}

function serializeTransactionRecurringAggregateKey(
  key: TransactionRecurringAggregateKey,
) {
  return JSON.stringify([
    key.teamId,
    key.scope,
    key.direction,
    key.currency,
    key.date,
    key.name,
    key.frequency,
    key.categorySlug,
  ]);
}

function serializeTransactionTaxAggregateKey(key: TransactionTaxAggregateKey) {
  return JSON.stringify([
    key.teamId,
    key.scope,
    key.date,
    key.currency,
    key.direction,
    key.categorySlug,
    key.taxType,
    key.taxRate,
  ]);
}

function matchesTransactionAggregateKey(
  entry: TransactionAggregateKey,
  key: TransactionAggregateKey,
) {
  return (
    entry.teamId === key.teamId &&
    entry.scope === key.scope &&
    entry.date === key.date &&
    entry.currency === key.currency &&
    entry.direction === key.direction &&
    entry.categorySlug === key.categorySlug &&
    entry.recurring === key.recurring
  );
}

function matchesTransactionRecurringAggregateKey(
  entry: TransactionRecurringAggregateKey,
  key: TransactionRecurringAggregateKey,
) {
  return (
    entry.teamId === key.teamId &&
    entry.scope === key.scope &&
    entry.direction === key.direction &&
    entry.currency === key.currency &&
    entry.date === key.date &&
    entry.name === key.name &&
    entry.frequency === key.frequency &&
    entry.categorySlug === key.categorySlug
  );
}

function matchesTransactionTaxAggregateKey(
  entry: TransactionTaxAggregateKey,
  key: TransactionTaxAggregateKey,
) {
  return (
    entry.teamId === key.teamId &&
    entry.scope === key.scope &&
    entry.date === key.date &&
    entry.currency === key.currency &&
    entry.direction === key.direction &&
    entry.categorySlug === key.categorySlug &&
    entry.taxType === key.taxType &&
    entry.taxRate === key.taxRate
  );
}

async function getTransactionAggregateRecord(
  ctx: TransactionCtx,
  key: TransactionAggregateKey,
) {
  return ctx.db
    .query("transactionMetricAggregates")
    .withIndex(
      "by_team_scope_currency_date_direction_category_recurring",
      (q) =>
        q
          .eq("teamId", key.teamId)
          .eq("scope", key.scope)
          .eq("currency", key.currency)
          .eq("date", key.date)
          .eq("direction", key.direction)
          .eq("categorySlug", key.categorySlug)
          .eq("recurring", key.recurring),
    )
    .unique();
}

async function getTransactionAggregateEntriesForKey(
  ctx: TransactionCtx,
  key: TransactionAggregateKey,
  teamCountryCode?: string | null,
) {
  const transactions = await ctx.db
    .query("transactions")
    .withIndex("by_team_and_date", (q) =>
      q.eq("teamId", key.teamId).eq("date", key.date),
    )
    .collect();

  return transactions.flatMap((transaction) =>
    getTransactionMetricAggregateEntries(transaction, teamCountryCode).filter(
      (entry) => matchesTransactionAggregateKey(entry, key),
    ),
  );
}

async function getTransactionRecurringAggregateRecord(
  ctx: TransactionCtx,
  key: TransactionRecurringAggregateKey,
) {
  return ctx.db
    .query("transactionRecurringAggregates")
    .withIndex(
      "by_team_scope_direction_currency_name_frequency_category_date",
      (q) =>
        q
          .eq("teamId", key.teamId)
          .eq("scope", key.scope)
          .eq("direction", key.direction)
          .eq("currency", key.currency)
          .eq("name", key.name)
          .eq("frequency", key.frequency)
          .eq("categorySlug", key.categorySlug)
          .eq("date", key.date),
    )
    .unique();
}

async function getTransactionTaxAggregateRecord(
  ctx: TransactionCtx,
  key: TransactionTaxAggregateKey,
) {
  return ctx.db
    .query("transactionTaxAggregates")
    .withIndex(
      "by_team_scope_currency_date_direction_category_tax_type_tax_rate",
      (q) =>
        q
          .eq("teamId", key.teamId)
          .eq("scope", key.scope)
          .eq("currency", key.currency)
          .eq("date", key.date)
          .eq("direction", key.direction)
          .eq("categorySlug", key.categorySlug)
          .eq("taxType", key.taxType)
          .eq("taxRate", key.taxRate),
    )
    .unique();
}

async function syncTransactionMetricAggregateKey(
  ctx: MutationCtx,
  key: TransactionAggregateKey,
) {
  const existing = await getTransactionAggregateRecord(ctx, key);
  const team = await ctx.db.get(key.teamId);
  const entries = await getTransactionAggregateEntriesForKey(
    ctx,
    key,
    team?.countryCode ?? null,
  );

  if (entries.length === 0) {
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return;
  }

  const timestamp = nowIso();
  const totalAmount =
    Math.round(entries.reduce((sum, entry) => sum + entry.amount, 0) * 100) /
    100;
  const totalNetAmount =
    Math.round(entries.reduce((sum, entry) => sum + entry.netAmount, 0) * 100) /
    100;

  if (existing) {
    await ctx.db.patch(existing._id, {
      totalAmount,
      totalNetAmount,
      transactionCount: entries.length,
      updatedAt: timestamp,
    });

    return;
  }

  await ctx.db.insert("transactionMetricAggregates", {
    teamId: key.teamId,
    scope: key.scope,
    date: key.date,
    currency: key.currency,
    direction: key.direction,
    categorySlug: key.categorySlug,
    recurring: key.recurring,
    totalAmount,
    totalNetAmount,
    transactionCount: entries.length,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

async function getTransactionRecurringAggregateEntriesForKey(
  ctx: TransactionCtx,
  key: TransactionRecurringAggregateKey,
) {
  const transactions = await ctx.db
    .query("transactions")
    .withIndex("by_team_and_date", (q) =>
      q.eq("teamId", key.teamId).eq("date", key.date),
    )
    .collect();

  return transactions.flatMap((transaction) =>
    getTransactionRecurringAggregateEntries(transaction).filter((entry) =>
      matchesTransactionRecurringAggregateKey(entry, key),
    ),
  );
}

async function syncTransactionRecurringAggregateKey(
  ctx: MutationCtx,
  key: TransactionRecurringAggregateKey,
) {
  const existing = await getTransactionRecurringAggregateRecord(ctx, key);
  const entries = await getTransactionRecurringAggregateEntriesForKey(ctx, key);

  if (entries.length === 0) {
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return;
  }

  const timestamp = nowIso();
  const totalAmount =
    Math.round(entries.reduce((sum, entry) => sum + entry.amount, 0) * 100) /
    100;
  const latestEntry = entries.reduce((latest, entry) =>
    !latest || entry.createdAt > latest.createdAt ? entry : latest,
  );

  if (existing) {
    await ctx.db.patch(existing._id, {
      totalAmount,
      transactionCount: entries.length,
      latestAmount: latestEntry.amount,
      latestTransactionCreatedAt: latestEntry.createdAt,
      updatedAt: timestamp,
    });

    return;
  }

  await ctx.db.insert("transactionRecurringAggregates", {
    teamId: key.teamId,
    scope: key.scope,
    direction: key.direction,
    currency: key.currency,
    date: key.date,
    name: key.name,
    frequency: key.frequency,
    categorySlug: key.categorySlug,
    totalAmount,
    transactionCount: entries.length,
    latestAmount: latestEntry.amount,
    latestTransactionCreatedAt: latestEntry.createdAt,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

async function getTransactionTaxAggregateEntriesForKey(
  ctx: TransactionCtx,
  key: TransactionTaxAggregateKey,
  teamCountryCode?: string | null,
) {
  const transactions = await ctx.db
    .query("transactions")
    .withIndex("by_team_and_date", (q) =>
      q.eq("teamId", key.teamId).eq("date", key.date),
    )
    .collect();

  return transactions.flatMap((transaction) =>
    getTransactionTaxAggregateEntries(transaction, teamCountryCode).filter(
      (entry) => matchesTransactionTaxAggregateKey(entry, key),
    ),
  );
}

async function syncTransactionTaxAggregateKey(
  ctx: MutationCtx,
  key: TransactionTaxAggregateKey,
) {
  const existing = await getTransactionTaxAggregateRecord(ctx, key);
  const team = await ctx.db.get(key.teamId);
  const entries = await getTransactionTaxAggregateEntriesForKey(
    ctx,
    key,
    team?.countryCode ?? null,
  );

  if (entries.length === 0) {
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return;
  }

  const timestamp = nowIso();
  const totalTaxAmount = roundAggregateAmount(
    entries.reduce((sum, entry) => sum + entry.totalTaxAmount, 0),
  );
  const totalTransactionAmount = roundAggregateAmount(
    entries.reduce((sum, entry) => sum + entry.totalTransactionAmount, 0),
  );

  if (existing) {
    await ctx.db.patch(existing._id, {
      totalTaxAmount,
      totalTransactionAmount,
      transactionCount: entries.length,
      updatedAt: timestamp,
    });

    return;
  }

  await ctx.db.insert("transactionTaxAggregates", {
    teamId: key.teamId,
    scope: key.scope,
    date: key.date,
    currency: key.currency,
    direction: key.direction,
    categorySlug: key.categorySlug,
    taxType: key.taxType,
    taxRate: key.taxRate,
    totalTaxAmount,
    totalTransactionAmount,
    transactionCount: entries.length,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

function collectTransactionMetricAggregateKeys(
  keys: Map<string, TransactionAggregateKey>,
  previous: Doc<"transactions"> | null,
  next: Doc<"transactions"> | null,
  teamCountryCode?: string | null,
) {
  for (const entry of [
    ...(previous
      ? getTransactionMetricAggregateEntries(previous, teamCountryCode)
      : []),
    ...(next
      ? getTransactionMetricAggregateEntries(next, teamCountryCode)
      : []),
  ]) {
    const { amount: _amount, netAmount: _netAmount, ...key } = entry;
    keys.set(serializeTransactionAggregateKey(key), key);
  }
}

function collectTransactionRecurringAggregateKeys(
  keys: Map<string, TransactionRecurringAggregateKey>,
  previous: Doc<"transactions"> | null,
  next: Doc<"transactions"> | null,
) {
  for (const entry of [
    ...(previous ? getTransactionRecurringAggregateEntries(previous) : []),
    ...(next ? getTransactionRecurringAggregateEntries(next) : []),
  ]) {
    const { amount: _amount, createdAt: _createdAt, ...key } = entry;
    keys.set(serializeTransactionRecurringAggregateKey(key), key);
  }
}

function collectTransactionTaxAggregateKeys(
  keys: Map<string, TransactionTaxAggregateKey>,
  previous: Doc<"transactions"> | null,
  next: Doc<"transactions"> | null,
  teamCountryCode?: string | null,
) {
  for (const entry of [
    ...(previous
      ? getTransactionTaxAggregateEntries(previous, teamCountryCode)
      : []),
    ...(next ? getTransactionTaxAggregateEntries(next, teamCountryCode) : []),
  ]) {
    const {
      totalTaxAmount: _totalTaxAmount,
      totalTransactionAmount: _totalTransactionAmount,
      ...key
    } = entry;
    keys.set(serializeTransactionTaxAggregateKey(key), key);
  }
}

function serializeTransactionMetricAggregate(
  record: TransactionMetricAggregateDoc,
) {
  return {
    scope: record.scope,
    date: record.date,
    currency: record.currency,
    direction: record.direction,
    categorySlug: record.categorySlug,
    recurring: record.recurring,
    totalAmount: record.totalAmount,
    totalNetAmount: record.totalNetAmount ?? null,
    transactionCount: record.transactionCount,
    updatedAt: record.updatedAt,
  };
}

function serializeTransactionRecurringAggregate(
  record: TransactionRecurringAggregateDoc,
) {
  return {
    scope: record.scope,
    direction: record.direction,
    currency: record.currency,
    date: record.date,
    name: record.name,
    frequency: record.frequency ?? null,
    categorySlug: record.categorySlug,
    totalAmount: record.totalAmount,
    transactionCount: record.transactionCount,
    latestAmount: record.latestAmount,
    latestTransactionCreatedAt: record.latestTransactionCreatedAt,
    updatedAt: record.updatedAt,
  };
}

function serializeTransactionTaxAggregate(record: TransactionTaxAggregateDoc) {
  return {
    scope: record.scope,
    date: record.date,
    currency: record.currency,
    direction: record.direction,
    categorySlug: record.categorySlug,
    taxType: record.taxType ?? null,
    taxRate: record.taxRate,
    totalTaxAmount: record.totalTaxAmount,
    totalTransactionAmount: record.totalTransactionAmount,
    transactionCount: record.transactionCount,
    updatedAt: record.updatedAt,
  };
}

function buildTransactionAggregateBackfillMaps(
  team: Pick<TeamDoc, "_id" | "countryCode">,
  records: Doc<"transactions">[],
) {
  const transactionMetricAggregateMap = new Map<
    string,
    TransactionMetricAggregateBackfillEntry
  >();
  const transactionRecurringAggregateMap = new Map<
    string,
    TransactionRecurringAggregateBackfillEntry
  >();
  const transactionTaxAggregateMap = new Map<
    string,
    TransactionTaxAggregateBackfillEntry
  >();

  for (const record of records) {
    for (const entry of getTransactionMetricAggregateEntries(
      record,
      team.countryCode ?? null,
    )) {
      const { amount, netAmount, ...key } = entry;
      const serializedKey = serializeTransactionAggregateKey(key);
      const existing = transactionMetricAggregateMap.get(serializedKey);

      if (existing) {
        existing.totalAmount = roundAggregateAmount(
          existing.totalAmount + amount,
        );
        existing.totalNetAmount = roundAggregateAmount(
          existing.totalNetAmount + netAmount,
        );
        existing.transactionCount += 1;
        continue;
      }

      transactionMetricAggregateMap.set(serializedKey, {
        key,
        totalAmount: roundAggregateAmount(amount),
        totalNetAmount: roundAggregateAmount(netAmount),
        transactionCount: 1,
      });
    }

    for (const entry of getTransactionRecurringAggregateEntries(record)) {
      const { amount, createdAt, ...key } = entry;
      const serializedKey = serializeTransactionRecurringAggregateKey(key);
      const existing = transactionRecurringAggregateMap.get(serializedKey);

      if (existing) {
        existing.totalAmount = roundAggregateAmount(
          existing.totalAmount + amount,
        );
        existing.transactionCount += 1;

        if (createdAt > existing.latestTransactionCreatedAt) {
          existing.latestAmount = amount;
          existing.latestTransactionCreatedAt = createdAt;
        }

        continue;
      }

      transactionRecurringAggregateMap.set(serializedKey, {
        key,
        totalAmount: roundAggregateAmount(amount),
        transactionCount: 1,
        latestAmount: amount,
        latestTransactionCreatedAt: createdAt,
      });
    }

    for (const entry of getTransactionTaxAggregateEntries(
      record,
      team.countryCode ?? null,
    )) {
      const { totalTaxAmount, totalTransactionAmount, ...key } = entry;
      const serializedKey = serializeTransactionTaxAggregateKey(key);
      const existing = transactionTaxAggregateMap.get(serializedKey);

      if (existing) {
        existing.totalTaxAmount = roundAggregateAmount(
          existing.totalTaxAmount + totalTaxAmount,
        );
        existing.totalTransactionAmount = roundAggregateAmount(
          existing.totalTransactionAmount + totalTransactionAmount,
        );
        existing.transactionCount += 1;
        continue;
      }

      transactionTaxAggregateMap.set(serializedKey, {
        key,
        totalTaxAmount: roundAggregateAmount(totalTaxAmount),
        totalTransactionAmount: roundAggregateAmount(totalTransactionAmount),
        transactionCount: 1,
      });
    }
  }

  return {
    transactionMetricAggregateMap,
    transactionRecurringAggregateMap,
    transactionTaxAggregateMap,
  };
}

async function rebuildTransactionReportAggregatesForTeam(
  ctx: MutationCtx,
  team: Pick<TeamDoc, "_id" | "publicTeamId" | "countryCode">,
) {
  const timestamp = nowIso();
  const records = await ctx.db
    .query("transactions")
    .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
    .collect();
  const {
    transactionMetricAggregateMap,
    transactionRecurringAggregateMap,
    transactionTaxAggregateMap,
  } = buildTransactionAggregateBackfillMaps(team, records);

  for (const record of await ctx.db
    .query("transactionMetricAggregates")
    .withIndex("by_team_scope_currency_date", (q) => q.eq("teamId", team._id))
    .collect()) {
    await ctx.db.delete(record._id);
  }

  for (const record of await ctx.db
    .query("transactionRecurringAggregates")
    .withIndex("by_team_scope_direction_currency_date", (q) =>
      q.eq("teamId", team._id),
    )
    .collect()) {
    await ctx.db.delete(record._id);
  }

  for (const record of await ctx.db
    .query("transactionTaxAggregates")
    .withIndex("by_team_scope_direction_currency_date", (q) =>
      q.eq("teamId", team._id),
    )
    .collect()) {
    await ctx.db.delete(record._id);
  }

  for (const entry of transactionMetricAggregateMap.values()) {
    await ctx.db.insert("transactionMetricAggregates", {
      teamId: entry.key.teamId,
      scope: entry.key.scope,
      date: entry.key.date,
      currency: entry.key.currency,
      direction: entry.key.direction,
      categorySlug: entry.key.categorySlug,
      recurring: entry.key.recurring,
      totalAmount: entry.totalAmount,
      totalNetAmount: entry.totalNetAmount,
      transactionCount: entry.transactionCount,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  for (const entry of transactionRecurringAggregateMap.values()) {
    await ctx.db.insert("transactionRecurringAggregates", {
      teamId: entry.key.teamId,
      scope: entry.key.scope,
      direction: entry.key.direction,
      currency: entry.key.currency,
      date: entry.key.date,
      name: entry.key.name,
      frequency: entry.key.frequency,
      categorySlug: entry.key.categorySlug,
      totalAmount: entry.totalAmount,
      transactionCount: entry.transactionCount,
      latestAmount: entry.latestAmount,
      latestTransactionCreatedAt: entry.latestTransactionCreatedAt,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  for (const entry of transactionTaxAggregateMap.values()) {
    await ctx.db.insert("transactionTaxAggregates", {
      teamId: entry.key.teamId,
      scope: entry.key.scope,
      date: entry.key.date,
      currency: entry.key.currency,
      direction: entry.key.direction,
      categorySlug: entry.key.categorySlug,
      taxType: entry.key.taxType,
      taxRate: entry.key.taxRate,
      totalTaxAmount: entry.totalTaxAmount,
      totalTransactionAmount: entry.totalTransactionAmount,
      transactionCount: entry.transactionCount,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  return {
    teamId: team.publicTeamId ?? String(team._id),
    transactionCount: records.length,
    transactionMetricAggregateRows: transactionMetricAggregateMap.size,
    transactionRecurringAggregateRows: transactionRecurringAggregateMap.size,
    transactionTaxAggregateRows: transactionTaxAggregateMap.size,
  };
}

async function getTeamOrThrow(ctx: TransactionCtx, publicTeamId: string) {
  const team = await getTeamByPublicTeamId(ctx, publicTeamId);

  if (!team) {
    throw new ConvexError("Convex transaction team not found");
  }

  return team;
}

async function getTransactionByPublicId(
  ctx: TransactionCtx,
  args: {
    transactionId: string;
    teamId: Id<"teams">;
  },
) {
  const byLegacyId = await ctx.db
    .query("transactions")
    .withIndex("by_public_transaction_id", (q) =>
      q.eq("publicTransactionId", args.transactionId),
    )
    .unique();

  if (byLegacyId && byLegacyId.teamId === args.teamId) {
    return byLegacyId;
  }

  const byDocId = await ctx.db.get(args.transactionId as Id<"transactions">);

  if (byDocId && byDocId.teamId === args.teamId) {
    return byDocId;
  }

  return null;
}

async function listTransactionTagAssignmentsForTransactionIds(
  ctx: TransactionCtx,
  args: {
    teamId: Id<"teams">;
    transactionIds: string[];
  },
) {
  const assignments = await Promise.all(
    [...new Set(args.transactionIds)].map((transactionId) =>
      ctx.db
        .query("transactionTags")
        .withIndex("by_team_and_transaction", (q) =>
          q.eq("teamId", args.teamId).eq("transactionId", transactionId),
        )
        .collect(),
    ),
  );

  return [
    ...new Map(
      assignments.flat().map((assignment) => [assignment._id, assignment]),
    ).values(),
  ];
}

async function syncTransactionTagAssignmentsForTransaction(
  ctx: MutationCtx,
  args: {
    teamId: Id<"teams">;
    transaction: Pick<
      Doc<"transactions">,
      "_id" | "publicTransactionId" | "date"
    >;
  },
) {
  const canonicalTransactionId = publicTransactionId(args.transaction);
  const assignments = await listTransactionTagAssignmentsForTransactionIds(
    ctx,
    {
      teamId: args.teamId,
      transactionIds: [canonicalTransactionId, args.transaction._id],
    },
  );

  if (assignments.length === 0) {
    return;
  }

  const timestamp = nowIso();

  for (const assignment of assignments) {
    if (
      assignment.transactionId === canonicalTransactionId &&
      assignment.transactionDate === args.transaction.date
    ) {
      continue;
    }

    await ctx.db.patch(assignment._id, {
      transactionId: canonicalTransactionId,
      transactionDate: args.transaction.date,
      updatedAt: timestamp,
    });
  }
}

async function deleteTransactionTagAssignmentsForTransaction(
  ctx: MutationCtx,
  args: {
    teamId: Id<"teams">;
    transaction: Pick<Doc<"transactions">, "_id" | "publicTransactionId">;
  },
) {
  const assignments = await listTransactionTagAssignmentsForTransactionIds(
    ctx,
    {
      teamId: args.teamId,
      transactionIds: [
        publicTransactionId(args.transaction),
        args.transaction._id,
      ],
    },
  );

  for (const assignment of assignments) {
    await ctx.db.delete(assignment._id);
  }
}

async function getTransactionByPublicIdAnyTeam(
  ctx: TransactionCtx,
  transactionId: string,
) {
  const byLegacyId = await ctx.db
    .query("transactions")
    .withIndex("by_public_transaction_id", (q) =>
      q.eq("publicTransactionId", transactionId),
    )
    .unique();

  if (byLegacyId) {
    return byLegacyId;
  }

  return ctx.db.get(transactionId as Id<"transactions">);
}

function sortTransactions(
  left: Doc<"transactions">,
  right: Doc<"transactions">,
) {
  const dateComparison = right.date.localeCompare(left.date);

  if (dateComparison !== 0) {
    return dateComparison;
  }

  const createdAtComparison = right.createdAt.localeCompare(left.createdAt);

  if (createdAtComparison !== 0) {
    return createdAtComparison;
  }

  return publicTransactionId(right).localeCompare(publicTransactionId(left));
}

function buildTransactionProjectionSearchText(transaction: {
  name: string;
  description?: string | null;
  merchantName?: string | null;
  counterpartyName?: string | null;
}) {
  return buildSearchIndexText([
    transaction.name,
    transaction.description,
    transaction.merchantName,
    transaction.counterpartyName,
  ]);
}

function filterTransactions(
  transactions: Doc<"transactions">[],
  args: {
    statusesNotIn?: Array<
      "posted" | "pending" | "excluded" | "completed" | "archived" | "exported"
    >;
    enrichmentCompleted?: boolean;
    dateGte?: string;
    dateLte?: string;
  },
) {
  const excludedStatuses = new Set(args.statusesNotIn ?? []);

  return transactions
    .filter((transaction) =>
      excludedStatuses.size === 0
        ? true
        : !excludedStatuses.has(transaction.status),
    )
    .filter((transaction) =>
      args.enrichmentCompleted === undefined
        ? true
        : (transaction.enrichmentCompleted ?? false) ===
          args.enrichmentCompleted,
    )
    .filter((transaction) =>
      args.dateGte === undefined ? true : transaction.date >= args.dateGte,
    )
    .filter((transaction) =>
      args.dateLte === undefined ? true : transaction.date <= args.dateLte,
    )
    .sort(sortTransactions);
}

export const serviceUpsertTransactions = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    transactions: v.array(transactionRecord),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.transactions.length === 0) {
      return [];
    }

    const team = await getTeamOrThrow(ctx, args.publicTeamId);
    const timestamp = nowIso();
    const results = [];
    const complianceJournalChanges: Array<{
      previous: Doc<"transactions"> | null;
      next: Doc<"transactions"> | null;
    }> = [];
    const aggregateKeys = new Map<string, TransactionAggregateKey>();
    const recurringAggregateKeys = new Map<
      string,
      TransactionRecurringAggregateKey
    >();
    const taxAggregateKeys = new Map<string, TransactionTaxAggregateKey>();

    for (const transaction of args.transactions) {
      const existing =
        (await ctx.db
          .query("transactions")
          .withIndex("by_public_transaction_id", (q) =>
            q.eq("publicTransactionId", transaction.id),
          )
          .unique()) ??
        (await ctx.db
          .query("transactions")
          .withIndex("by_team_and_internal_id", (q) =>
            q.eq("teamId", team._id).eq("internalId", transaction.internalId),
          )
          .unique());

      const payload = {
        teamId: team._id,
        createdAt: transaction.createdAt,
        updatedAt: timestamp,
        date: transaction.date,
        name: transaction.name,
        method: transaction.method,
        amount: transaction.amount,
        currency: transaction.currency,
        assignedId: transaction.assignedId ?? undefined,
        note: transaction.note ?? undefined,
        bankAccountId: transaction.bankAccountId ?? undefined,
        internalId: transaction.internalId,
        status: transaction.status,
        balance: transaction.balance ?? undefined,
        manual: transaction.manual,
        notified: transaction.notified ?? false,
        internal: transaction.internal ?? false,
        description: transaction.description ?? undefined,
        categorySlug: transaction.categorySlug ?? undefined,
        baseAmount: transaction.baseAmount ?? undefined,
        counterpartyName: transaction.counterpartyName ?? undefined,
        baseCurrency: transaction.baseCurrency ?? undefined,
        taxAmount: transaction.taxAmount ?? undefined,
        taxRate: transaction.taxRate ?? undefined,
        taxType: transaction.taxType ?? undefined,
        recurring: transaction.recurring ?? false,
        frequency: transaction.frequency ?? undefined,
        merchantName: transaction.merchantName ?? undefined,
        enrichmentCompleted: transaction.enrichmentCompleted ?? false,
        hasAttachment:
          transaction.hasAttachment ?? existing?.hasAttachment ?? false,
        searchText:
          buildTransactionProjectionSearchText(transaction) || undefined,
        searchAmount:
          buildAbsoluteAmountSearchValue(transaction.amount) ?? undefined,
      };

      if (existing) {
        await ctx.db.patch(existing._id, {
          publicTransactionId: existing.publicTransactionId ?? transaction.id,
          ...payload,
        });

        const updated = await ctx.db.get(existing._id);

        if (!updated) {
          throw new ConvexError("Failed to update transaction projection");
        }

        await syncTransactionTagAssignmentsForTransaction(ctx, {
          teamId: team._id,
          transaction: updated,
        });

        collectTransactionMetricAggregateKeys(
          aggregateKeys,
          existing,
          updated,
          team.countryCode ?? null,
        );
        collectTransactionRecurringAggregateKeys(
          recurringAggregateKeys,
          existing,
          updated,
        );
        collectTransactionTaxAggregateKeys(
          taxAggregateKeys,
          existing,
          updated,
          team.countryCode ?? null,
        );
        complianceJournalChanges.push({
          previous: existing,
          next: updated,
        });
        results.push(serializeTransaction(args.publicTeamId, updated));
        continue;
      }

      const insertedId = await ctx.db.insert("transactions", {
        publicTransactionId: transaction.id,
        ...payload,
      });
      const inserted = await ctx.db.get(insertedId);

      if (!inserted) {
        throw new ConvexError("Failed to create transaction projection");
      }

      await syncTransactionTagAssignmentsForTransaction(ctx, {
        teamId: team._id,
        transaction: inserted,
      });

      collectTransactionMetricAggregateKeys(
        aggregateKeys,
        null,
        inserted,
        team.countryCode ?? null,
      );
      collectTransactionRecurringAggregateKeys(
        recurringAggregateKeys,
        null,
        inserted,
      );
      collectTransactionTaxAggregateKeys(
        taxAggregateKeys,
        null,
        inserted,
        team.countryCode ?? null,
      );
      complianceJournalChanges.push({
        previous: null,
        next: inserted,
      });
      results.push(serializeTransaction(args.publicTeamId, inserted));
    }

    for (const key of aggregateKeys.values()) {
      await syncTransactionMetricAggregateKey(ctx, key);
    }

    for (const key of recurringAggregateKeys.values()) {
      await syncTransactionRecurringAggregateKey(ctx, key);
    }

    for (const key of taxAggregateKeys.values()) {
      await syncTransactionTaxAggregateKey(ctx, key);
    }

    await syncTransactionComplianceJournalEntriesForChanges(
      ctx,
      team,
      complianceJournalChanges,
    );

    return results;
  },
});

export const serviceDeleteTransactions = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    transactionIds: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.transactionIds.length === 0) {
      return [];
    }

    const team = await getTeamOrThrow(ctx, args.publicTeamId);
    const deletedIds: string[] = [];
    const complianceJournalChanges: Array<{
      previous: Doc<"transactions"> | null;
      next: Doc<"transactions"> | null;
    }> = [];
    const aggregateKeys = new Map<string, TransactionAggregateKey>();
    const recurringAggregateKeys = new Map<
      string,
      TransactionRecurringAggregateKey
    >();
    const taxAggregateKeys = new Map<string, TransactionTaxAggregateKey>();

    for (const transactionId of [...new Set(args.transactionIds)]) {
      const transaction = await getTransactionByPublicId(ctx, {
        transactionId,
        teamId: team._id,
      });

      if (!transaction) {
        continue;
      }

      deletedIds.push(publicTransactionId(transaction));
      await deleteTransactionTagAssignmentsForTransaction(ctx, {
        teamId: team._id,
        transaction,
      });
      await ctx.db.delete(transaction._id);
      collectTransactionMetricAggregateKeys(
        aggregateKeys,
        transaction,
        null,
        team.countryCode ?? null,
      );
      collectTransactionRecurringAggregateKeys(
        recurringAggregateKeys,
        transaction,
        null,
      );
      collectTransactionTaxAggregateKeys(
        taxAggregateKeys,
        transaction,
        null,
        team.countryCode ?? null,
      );
      complianceJournalChanges.push({
        previous: transaction,
        next: null,
      });
    }

    for (const key of aggregateKeys.values()) {
      await syncTransactionMetricAggregateKey(ctx, key);
    }

    for (const key of recurringAggregateKeys.values()) {
      await syncTransactionRecurringAggregateKey(ctx, key);
    }

    for (const key of taxAggregateKeys.values()) {
      await syncTransactionTaxAggregateKey(ctx, key);
    }

    await syncTransactionComplianceJournalEntriesForChanges(
      ctx,
      team,
      complianceJournalChanges,
    );

    return deletedIds;
  },
});

export const serviceGetTransactionById = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    transactionId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return null;
    }

    const transaction = await getTransactionByPublicId(ctx, {
      transactionId: args.transactionId,
      teamId: team._id,
    });

    return transaction
      ? serializeTransaction(args.publicTeamId, transaction)
      : null;
  },
});

export const serviceGetTransactionInfo = query({
  args: {
    serviceKey: v.string(),
    transactionId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const transaction = await getTransactionByPublicIdAnyTeam(
      ctx,
      args.transactionId,
    );

    if (!transaction) {
      return null;
    }

    const team = await ctx.db.get(transaction.teamId);

    if (!team?.publicTeamId) {
      return null;
    }

    return serializeTransaction(team.publicTeamId, transaction);
  },
});

export const serviceGetTransactionsByIds = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    transactionIds: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.transactionIds.length === 0) {
      return [];
    }

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const records = await Promise.all(
      [...new Set(args.transactionIds)].map((transactionId) =>
        getTransactionByPublicId(ctx, {
          transactionId,
          teamId: team._id,
        }),
      ),
    );

    return records
      .filter((record): record is Doc<"transactions"> => record !== null)
      .sort(sortTransactions)
      .map((record) => serializeTransaction(args.publicTeamId, record));
  },
});

export const serviceGetTransactionsByInternalIds = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    internalIds: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.internalIds.length === 0) {
      return [];
    }

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const records = await Promise.all(
      [...new Set(args.internalIds)].map((internalId) =>
        ctx.db
          .query("transactions")
          .withIndex("by_team_and_internal_id", (q) =>
            q.eq("teamId", team._id).eq("internalId", internalId),
          )
          .unique(),
      ),
    );

    return records
      .filter((record): record is Doc<"transactions"> => record !== null)
      .sort(sortTransactions)
      .map((record) => serializeTransaction(args.publicTeamId, record));
  },
});

export const serviceListUnnotifiedTransactions = query({
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
      .query("transactions")
      .withIndex("by_team_notified_date", (q) =>
        q.eq("teamId", team._id).eq("notified", false),
      )
      .collect();

    return records
      .sort(sortTransactions)
      .map((record) => serializeTransaction(args.publicTeamId, record));
  },
});

export const serviceSearchTransactions = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    query: v.string(),
    dateGte: nullableString,
    dateLte: nullableString,
    statusesNotIn: v.optional(v.array(transactionStatus)),
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
      .query("transactions")
      .withSearchIndex("search_by_team", (q) =>
        q.search("searchText", searchQuery).eq("teamId", team._id),
      )
      .take(Math.max(1, Math.min((args.limit ?? 100) * 4, 400)));

    return filterTransactions(records, {
      statusesNotIn: args.statusesNotIn,
      dateGte: args.dateGte ?? undefined,
      dateLte: args.dateLte ?? undefined,
    })
      .slice(0, args.limit ?? records.length)
      .map((record) => serializeTransaction(args.publicTeamId, record));
  },
});

export const serviceGetTransactionsByAmountRange = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    minAmount: v.number(),
    maxAmount: v.number(),
    dateGte: nullableString,
    dateLte: nullableString,
    statusesNotIn: v.optional(v.array(transactionStatus)),
    limit: v.optional(v.number()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const records = await ctx.db
      .query("transactions")
      .withIndex("by_team_and_search_amount", (q) =>
        q
          .eq("teamId", team._id)
          .gte("searchAmount", args.minAmount)
          .lte("searchAmount", args.maxAmount),
      )
      .take(Math.max(1, Math.min((args.limit ?? 100) * 4, 400)));

    return filterTransactions(records, {
      statusesNotIn: args.statusesNotIn,
      dateGte: args.dateGte ?? undefined,
      dateLte: args.dateLte ?? undefined,
    })
      .slice(0, args.limit ?? records.length)
      .map((record) => serializeTransaction(args.publicTeamId, record));
  },
});

export const serviceListTransactionsPage = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    dateGte: nullableString,
    dateLte: nullableString,
    statusesNotIn: v.optional(v.array(transactionStatus)),
    order: v.optional(transactionOrder),
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

    const baseTransactionsQuery = ctx.db
      .query("transactions")
      .withIndex("by_team_and_date", (q) => {
        const range = q.eq("teamId", team._id);

        if (args.dateGte && args.dateLte) {
          return range.gte("date", args.dateGte).lte("date", args.dateLte);
        }

        if (args.dateGte) {
          return range.gte("date", args.dateGte);
        }

        if (args.dateLte) {
          return range.lte("date", args.dateLte);
        }

        return range;
      });

    const orderedTransactionsQuery = baseTransactionsQuery.order(
      args.order ?? "desc",
    );

    const filteredTransactionsQuery =
      (args.statusesNotIn?.length ?? 0) > 0
        ? orderedTransactionsQuery.filter((q) => {
            const excludedStatuses = [...new Set(args.statusesNotIn)];

            return q.and(
              ...excludedStatuses.map((status) =>
                q.neq(q.field("status"), status),
              ),
            );
          })
        : orderedTransactionsQuery;

    const result = await filteredTransactionsQuery.paginate(
      args.paginationOpts,
    );

    return {
      ...result,
      page: result.page.map((record) =>
        serializeTransaction(args.publicTeamId, record),
      ),
    };
  },
});

export const serviceListTransactionsByBankAccountPage = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    bankAccountId: v.string(),
    dateGte: nullableString,
    dateLte: nullableString,
    statusesNotIn: v.optional(v.array(transactionStatus)),
    order: v.optional(transactionOrder),
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

    const baseTransactionsQuery = ctx.db
      .query("transactions")
      .withIndex("by_team_bank_account_date", (q) => {
        const range = q
          .eq("teamId", team._id)
          .eq("bankAccountId", args.bankAccountId);

        if (args.dateGte && args.dateLte) {
          return range.gte("date", args.dateGte).lte("date", args.dateLte);
        }

        if (args.dateGte) {
          return range.gte("date", args.dateGte);
        }

        if (args.dateLte) {
          return range.lte("date", args.dateLte);
        }

        return range;
      });

    const orderedTransactionsQuery = baseTransactionsQuery.order(
      args.order ?? "desc",
    );

    const filteredTransactionsQuery =
      (args.statusesNotIn?.length ?? 0) > 0
        ? orderedTransactionsQuery.filter((q) => {
            const excludedStatuses = [...new Set(args.statusesNotIn)];

            return q.and(
              ...excludedStatuses.map((status) =>
                q.neq(q.field("status"), status),
              ),
            );
          })
        : orderedTransactionsQuery;

    const result = await filteredTransactionsQuery.paginate(
      args.paginationOpts,
    );

    return {
      ...result,
      page: result.page.map((record) =>
        serializeTransaction(args.publicTeamId, record),
      ),
    };
  },
});

export const serviceListTaggedTransactionsPage = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    tagIds: v.array(v.string()),
    dateGte: nullableString,
    dateLte: nullableString,
    statusesNotIn: v.optional(v.array(transactionStatus)),
    order: v.optional(transactionOrder),
    cursor: v.optional(v.union(v.string(), v.null())),
    pageSize: v.number(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team || args.tagIds.length === 0) {
      return {
        page: [],
        isDone: true,
        continueCursor: null,
      };
    }

    const order = args.order ?? "desc";
    const pageSize = Math.max(1, Math.min(args.pageSize, 100));
    const cursor = decodeTaggedTransactionCursor(args.cursor ?? null);
    const tagIds = [...new Set(args.tagIds)];
    const lowerBound =
      order === "asc"
        ? ([args.dateGte, cursor?.date]
            .filter((value): value is string => !!value)
            .sort()
            .at(-1) ?? null)
        : (args.dateGte ?? null);
    const upperBound =
      order === "desc"
        ? ([args.dateLte, cursor?.date]
            .filter((value): value is string => !!value)
            .sort()
            .at(0) ?? null)
        : (args.dateLte ?? null);
    let takeCount = Math.max(pageSize * 4, 50);
    let mayHaveMoreRows = false;
    let lastScannedRow: Pick<
      Doc<"transactionTags">,
      "transactionDate" | "transactionId"
    > | null = null;
    let taggedRows: Array<
      Pick<Doc<"transactionTags">, "transactionDate" | "transactionId">
    > = [];

    while (true) {
      const rowsByTag = await Promise.all(
        tagIds.map((tagId) => {
          const query = ctx.db.query("transactionTags");

          if (lowerBound && upperBound) {
            return query
              .withIndex("by_team_tag_transaction_date", (range) =>
                range
                  .eq("teamId", team._id)
                  .eq("tagId", tagId)
                  .gte("transactionDate", lowerBound)
                  .lte("transactionDate", upperBound),
              )
              .order(order)
              .take(takeCount);
          }

          if (lowerBound) {
            return query
              .withIndex("by_team_tag_transaction_date", (range) =>
                range
                  .eq("teamId", team._id)
                  .eq("tagId", tagId)
                  .gte("transactionDate", lowerBound),
              )
              .order(order)
              .take(takeCount);
          }

          if (upperBound) {
            return query
              .withIndex("by_team_tag_transaction_date", (range) =>
                range
                  .eq("teamId", team._id)
                  .eq("tagId", tagId)
                  .lte("transactionDate", upperBound),
              )
              .order(order)
              .take(takeCount);
          }

          return query
            .withIndex("by_team_tag_transaction_date", (range) =>
              range.eq("teamId", team._id).eq("tagId", tagId),
            )
            .order(order)
            .take(takeCount);
        }),
      );

      mayHaveMoreRows = rowsByTag.some((rows) => rows.length === takeCount);
      taggedRows = [
        ...new Map(
          rowsByTag
            .flat()
            .filter(
              (row) =>
                row.transactionDate &&
                !isTaggedTransactionRowPastCursor(row, cursor, order),
            )
            .map((row) => [row.transactionId, row]),
        ).values(),
      ].sort((left, right) => compareTaggedTransactionRows(left, right, order));
      lastScannedRow = taggedRows.at(-1) ?? null;

      if (
        taggedRows.length >= pageSize ||
        !mayHaveMoreRows ||
        takeCount >= 400
      ) {
        break;
      }

      takeCount = Math.min(takeCount * 2, 400);
    }

    const records: Doc<"transactions">[] = [];

    for (const row of taggedRows) {
      const transaction = await getTransactionByPublicId(ctx, {
        transactionId: row.transactionId,
        teamId: team._id,
      });

      if (!transaction) {
        continue;
      }

      if (
        args.statusesNotIn?.length &&
        args.statusesNotIn.includes(transaction.status)
      ) {
        continue;
      }

      records.push(transaction);

      if (records.length === pageSize) {
        break;
      }
    }

    const hasMoreTaggedRows = taggedRows.length > records.length;
    const continueCursor =
      records.length === pageSize &&
      (hasMoreTaggedRows || mayHaveMoreRows) &&
      lastScannedRow
        ? encodeTaggedTransactionCursor({
            date: lastScannedRow.transactionDate!,
            transactionId: lastScannedRow.transactionId,
          })
        : null;

    return {
      page: records.map((record) =>
        serializeTransaction(args.publicTeamId, record),
      ),
      isDone: continueCursor === null,
      continueCursor,
    };
  },
});

export const serviceGetTransactionMetricAggregateRows = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    scope: transactionAggregateScope,
    currency: v.string(),
    dateFrom: nullableString,
    dateTo: nullableString,
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const records = await ctx.db
      .query("transactionMetricAggregates")
      .withIndex("by_team_scope_currency_date", (q) => {
        const range = q
          .eq("teamId", team._id)
          .eq("scope", args.scope)
          .eq("currency", args.currency);

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
      .order("asc")
      .collect();

    return records.map(serializeTransactionMetricAggregate);
  },
});

export const serviceGetTransactionRecurringAggregateRows = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    scope: transactionAggregateScope,
    direction: transactionAggregateDirection,
    currency: v.string(),
    dateFrom: nullableString,
    dateTo: nullableString,
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const records = await ctx.db
      .query("transactionRecurringAggregates")
      .withIndex("by_team_scope_direction_currency_date", (q) => {
        const range = q
          .eq("teamId", team._id)
          .eq("scope", args.scope)
          .eq("direction", args.direction)
          .eq("currency", args.currency);

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
      .order("asc")
      .collect();

    return records.map(serializeTransactionRecurringAggregate);
  },
});

export const serviceGetTransactionTaxAggregateRows = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    scope: transactionAggregateScope,
    direction: transactionAggregateDirection,
    currency: v.string(),
    dateFrom: nullableString,
    dateTo: nullableString,
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const records = await ctx.db
      .query("transactionTaxAggregates")
      .withIndex("by_team_scope_direction_currency_date", (q) => {
        const range = q
          .eq("teamId", team._id)
          .eq("scope", args.scope)
          .eq("direction", args.direction)
          .eq("currency", args.currency);

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
      .order("asc")
      .collect();

    return records.map(serializeTransactionTaxAggregate);
  },
});

export const serviceRebuildTransactionReportAggregates = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const teams = args.publicTeamId
      ? [await getTeamByPublicTeamId(ctx, args.publicTeamId)]
      : (await ctx.db.query("teams").collect()).filter(
          (team) => !!team.publicTeamId,
        );

    const validTeams = teams.filter(
      (team): team is NonNullable<(typeof teams)[number]> => team !== null,
    );

    if (args.publicTeamId && validTeams.length === 0) {
      throw new ConvexError("Convex transaction team not found");
    }

    const results = [];

    for (const team of validTeams) {
      results.push(await rebuildTransactionReportAggregatesForTeam(ctx, team));
    }

    return results;
  },
});

export const serviceCountTransactions = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    bankAccountId: nullableString,
    dateGte: nullableString,
    dateLte: nullableString,
    statusesNotIn: v.optional(v.array(transactionStatus)),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return 0;
    }

    const baseTransactionsQuery = args.bankAccountId
      ? ctx.db
          .query("transactions")
          .withIndex("by_team_bank_account_date", (q) => {
            const range = q
              .eq("teamId", team._id)
              .eq("bankAccountId", args.bankAccountId!);

            if (args.dateGte && args.dateLte) {
              return range.gte("date", args.dateGte).lte("date", args.dateLte);
            }

            if (args.dateGte) {
              return range.gte("date", args.dateGte);
            }

            if (args.dateLte) {
              return range.lte("date", args.dateLte);
            }

            return range;
          })
      : args.dateGte || args.dateLte
        ? ctx.db.query("transactions").withIndex("by_team_and_date", (q) => {
            const range = q.eq("teamId", team._id);

            if (args.dateGte && args.dateLte) {
              return range.gte("date", args.dateGte).lte("date", args.dateLte);
            }

            if (args.dateGte) {
              return range.gte("date", args.dateGte);
            }

            if (args.dateLte) {
              return range.lte("date", args.dateLte);
            }

            return range;
          })
        : ctx.db
            .query("transactions")
            .withIndex("by_team_id", (q) => q.eq("teamId", team._id));

    const filteredTransactionsQuery =
      (args.statusesNotIn?.length ?? 0) > 0
        ? baseTransactionsQuery.filter((q) => {
            const excludedStatuses = [...new Set(args.statusesNotIn)];

            return q.and(
              ...excludedStatuses.map((status) =>
                q.neq(q.field("status"), status),
              ),
            );
          })
        : baseTransactionsQuery;

    let count = 0;
    let cursor: string | null = null;

    while (true) {
      const result = await filteredTransactionsQuery.paginate({
        numItems: 500,
        cursor,
      });

      count += result.page.length;

      if (result.isDone) {
        return count;
      }

      cursor = result.continueCursor;
    }
  },
});
