import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import {
  CONTRA_REVENUE_CATEGORIES,
  getTaxRateForCategory,
  REVENUE_CATEGORIES,
} from "../../../packages/categories/src/index";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { nowIso } from "../../../packages/domain/src/identity";
import {
  buildAbsoluteAmountSearchValue,
  buildSearchIndexText,
  buildSearchQuery,
} from "../../../packages/domain/src/text-search";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";

type TransactionCtx = QueryCtx | MutationCtx;

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
});

type TransactionMetricAggregateDoc = Doc<"transactionMetricAggregates">;
type TransactionRecurringAggregateDoc = Doc<"transactionRecurringAggregates">;
type TransactionAggregateScope = "base" | "native";
type TransactionAggregateDirection = "income" | "expense";
type TransactionRecurringAggregateFrequency =
  NonNullable<Doc<"transactions">["frequency"]> | null;
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

function getTransactionBaseAggregateAmount(
  transaction: Doc<"transactions">,
) {
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

  return Math.round(
    (args.amount - (args.amount * effectiveTaxRate) / (100 + effectiveTaxRate)) *
      100,
  ) / 100;
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
  if (!shouldAggregateTransactionForMetrics(transaction) || !transaction.recurring) {
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

async function getTransactionAggregateRecord(
  ctx: TransactionCtx,
  key: TransactionAggregateKey,
) {
  return ctx.db
    .query("transactionMetricAggregates")
    .withIndex("by_team_scope_currency_date_direction_category_recurring", (q) =>
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
    getTransactionMetricAggregateEntries(transaction, teamCountryCode).filter((entry) =>
      matchesTransactionAggregateKey(entry, key),
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
    Math.round(
      entries.reduce((sum, entry) => sum + entry.amount, 0) * 100,
    ) / 100;
  const totalNetAmount =
    Math.round(
      entries.reduce((sum, entry) => sum + entry.netAmount, 0) * 100,
    ) / 100;

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
    Math.round(
      entries.reduce((sum, entry) => sum + entry.amount, 0) * 100,
    ) / 100;
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
    ...(next ? getTransactionMetricAggregateEntries(next, teamCountryCode) : []),
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
        : (transaction.enrichmentCompleted ?? false) === args.enrichmentCompleted,
    )
    .filter((transaction) =>
      args.dateGte === undefined ? true : transaction.date >= args.dateGte,
    )
    .sort(sortTransactions);
}

async function listTransactionsForArgs(
  ctx: QueryCtx,
  args: {
    publicTeamId: string;
    transactionIds?: string[];
    bankAccountId?: string | null;
    enrichmentCompleted?: boolean;
    dateGte?: string | null;
    statusesNotIn?: Array<
      "posted" | "pending" | "excluded" | "completed" | "archived" | "exported"
    >;
    limit?: number;
  },
) {
  const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

  if (!team) {
    return [];
  }

  let records: Doc<"transactions">[] = [];

  if (args.transactionIds && args.transactionIds.length > 0) {
    const resolved = await Promise.all(
      [...new Set(args.transactionIds)].map((transactionId) =>
        getTransactionByPublicId(ctx, {
          transactionId,
          teamId: team._id,
        }),
      ),
    );

    records = resolved.filter(
      (record): record is Doc<"transactions"> => record !== null,
    );
  } else if (args.bankAccountId) {
    records = await ctx.db
      .query("transactions")
      .withIndex("by_team_and_bank_account", (q) =>
        q.eq("teamId", team._id).eq("bankAccountId", args.bankAccountId!),
      )
      .collect();
  } else if (args.enrichmentCompleted !== undefined) {
    records = await ctx.db
      .query("transactions")
      .withIndex("by_team_and_enrichment_completed", (q) =>
        q
          .eq("teamId", team._id)
          .eq("enrichmentCompleted", args.enrichmentCompleted!),
      )
      .collect();
  } else if (args.dateGte) {
    records = await ctx.db
      .query("transactions")
      .withIndex("by_team_and_date", (q) =>
        q.eq("teamId", team._id).gte("date", args.dateGte!),
      )
      .collect();
  } else {
    records = await ctx.db
      .query("transactions")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect();
  }

  return filterTransactions(records, {
    statusesNotIn: args.statusesNotIn,
    enrichmentCompleted: args.enrichmentCompleted,
    dateGte: args.dateGte ?? undefined,
  }).slice(0, args.limit ?? records.length);
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
    const aggregateKeys = new Map<string, TransactionAggregateKey>();
    const recurringAggregateKeys = new Map<
      string,
      TransactionRecurringAggregateKey
    >();

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
      results.push(serializeTransaction(args.publicTeamId, inserted));
    }

    for (const key of aggregateKeys.values()) {
      await syncTransactionMetricAggregateKey(ctx, key);
    }

    for (const key of recurringAggregateKeys.values()) {
      await syncTransactionRecurringAggregateKey(ctx, key);
    }

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
    const aggregateKeys = new Map<string, TransactionAggregateKey>();
    const recurringAggregateKeys = new Map<
      string,
      TransactionRecurringAggregateKey
    >();

    for (const transactionId of [...new Set(args.transactionIds)]) {
      const transaction = await getTransactionByPublicId(ctx, {
        transactionId,
        teamId: team._id,
      });

      if (!transaction) {
        continue;
      }

      deletedIds.push(publicTransactionId(transaction));
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
    }

    for (const key of aggregateKeys.values()) {
      await syncTransactionMetricAggregateKey(ctx, key);
    }

    for (const key of recurringAggregateKeys.values()) {
      await syncTransactionRecurringAggregateKey(ctx, key);
    }

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

export const serviceSearchTransactions = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    query: v.string(),
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
      .take(Math.max(1, Math.min(args.limit ?? 100, 400)));

    return records.map((record) =>
      serializeTransaction(args.publicTeamId, record),
    );
  },
});

export const serviceGetTransactionsByAmountRange = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    minAmount: v.number(),
    maxAmount: v.number(),
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
      .take(Math.max(1, Math.min(args.limit ?? 100, 400)));

    return records
      .sort(sortTransactions)
      .map((record) => serializeTransaction(args.publicTeamId, record));
  },
});

export const serviceListTransactions = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    transactionIds: v.optional(v.array(v.string())),
    bankAccountId: nullableString,
    enrichmentCompleted: v.optional(v.boolean()),
    dateGte: nullableString,
    statusesNotIn: v.optional(v.array(transactionStatus)),
    limit: v.optional(v.number()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    return (await listTransactionsForArgs(ctx, args))
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

export const serviceCountTransactions = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    bankAccountId: nullableString,
    dateGte: nullableString,
    statusesNotIn: v.optional(v.array(transactionStatus)),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const transactions = await listTransactionsForArgs(ctx, {
      publicTeamId: args.publicTeamId,
      bankAccountId: args.bankAccountId,
      dateGte: args.dateGte,
      statusesNotIn: args.statusesNotIn,
    });

    return transactions.length;
  },
});

export const serviceGetAllTransactions = query({
  args: {
    serviceKey: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const records = await ctx.db.query("transactions").collect();
    const teamIds = [...new Set(records.map((record) => record.teamId))];
    const teams = new Map<Id<"teams">, string | null>();

    for (const teamId of teamIds) {
      const team = await ctx.db.get(teamId);
      teams.set(teamId, team?.publicTeamId ?? null);
    }

    const serialized = records
      .flatMap((record) => {
        const publicTeamId = teams.get(record.teamId);

        return publicTeamId
          ? [serializeTransaction(publicTeamId, record)]
          : [];
      });

    serialized.sort((left, right) => {
      const dateComparison = right.date.localeCompare(left.date);

      if (dateComparison !== 0) {
        return dateComparison;
      }

      const createdAtComparison = right.createdAt.localeCompare(left.createdAt);

      if (createdAtComparison !== 0) {
        return createdAtComparison;
      }

      return right.id.localeCompare(left.id);
    });

    return serialized;
  },
});
