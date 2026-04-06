import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { nowIso } from "../../packages/domain/src/identity";
import {
  buildAbsoluteAmountSearchValue,
  buildSearchIndexText,
  buildSearchQuery,
} from "../../packages/domain/src/text-search";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";

type InboxCtx = QueryCtx | MutationCtx;
type InboxLiabilityAggregateDoc = Doc<"inboxLiabilityAggregates">;
type InboxStatusAggregateDoc = Doc<"inboxStatusAggregates">;
type InboxItemStatusValue = Doc<"inboxItems">["status"];

const nullableString = v.optional(v.union(v.string(), v.null()));
const nullableNumber = v.optional(v.union(v.number(), v.null()));

const inboxItemStatus = v.union(
  v.literal("new"),
  v.literal("archived"),
  v.literal("processing"),
  v.literal("done"),
  v.literal("pending"),
  v.literal("analyzing"),
  v.literal("suggested_match"),
  v.literal("no_match"),
  v.literal("other"),
  v.literal("deleted"),
);

const inboxItemType = v.union(
  v.literal("invoice"),
  v.literal("expense"),
  v.literal("other"),
);

const matchType = v.union(
  v.literal("auto_matched"),
  v.literal("high_confidence"),
  v.literal("suggested"),
);

const suggestionStatus = v.union(
  v.literal("pending"),
  v.literal("confirmed"),
  v.literal("declined"),
  v.literal("expired"),
  v.literal("unmatched"),
);
const inboxOrder = v.union(v.literal("asc"), v.literal("desc"));

const inboxItemInput = v.object({
  publicTeamId: v.string(),
  id: v.optional(v.string()),
  createdAt: v.optional(v.string()),
  updatedAt: v.optional(v.string()),
  filePath: v.array(v.string()),
  fileName: nullableString,
  transactionId: nullableString,
  amount: nullableNumber,
  currency: nullableString,
  contentType: nullableString,
  size: nullableNumber,
  attachmentId: nullableString,
  date: nullableString,
  forwardedTo: nullableString,
  referenceId: nullableString,
  meta: v.optional(v.any()),
  status: inboxItemStatus,
  website: nullableString,
  senderEmail: nullableString,
  displayName: nullableString,
  type: v.optional(v.union(inboxItemType, v.null())),
  description: nullableString,
  baseAmount: nullableNumber,
  baseCurrency: nullableString,
  taxAmount: nullableNumber,
  taxRate: nullableNumber,
  taxType: nullableString,
  inboxAccountId: nullableString,
  invoiceNumber: nullableString,
  groupedInboxId: nullableString,
});

const transactionMatchSuggestionInput = v.object({
  publicTeamId: v.string(),
  id: v.optional(v.string()),
  inboxId: v.string(),
  transactionId: v.string(),
  confidenceScore: v.number(),
  amountScore: nullableNumber,
  currencyScore: nullableNumber,
  dateScore: nullableNumber,
  nameScore: nullableNumber,
  matchType,
  matchDetails: v.optional(v.any()),
  status: suggestionStatus,
  userActionAt: nullableString,
  userId: nullableString,
  createdAt: v.optional(v.string()),
  updatedAt: v.optional(v.string()),
});

function inboxFilePathKey(filePath: string[]) {
  return filePath.join("\u0000");
}

function publicInboxId(
  inboxItem: Pick<Doc<"inboxItems">, "_id" | "publicInboxId">,
) {
  return inboxItem.publicInboxId ?? inboxItem._id;
}

function publicSuggestionId(
  suggestion: Pick<
    Doc<"transactionMatchSuggestions">,
    "_id" | "publicSuggestionId"
  >,
) {
  return suggestion.publicSuggestionId ?? suggestion._id;
}

function serializeInboxItem(
  publicTeamId: string,
  inboxItem: Doc<"inboxItems">,
) {
  return {
    id: publicInboxId(inboxItem),
    teamId: publicTeamId,
    createdAt: inboxItem.createdAt,
    updatedAt: inboxItem.updatedAt,
    filePath: inboxItem.filePath,
    fileName: inboxItem.fileName ?? null,
    transactionId: inboxItem.transactionId ?? null,
    amount: inboxItem.amount ?? null,
    currency: inboxItem.currency ?? null,
    contentType: inboxItem.contentType ?? null,
    size: inboxItem.size ?? null,
    attachmentId: inboxItem.attachmentId ?? null,
    date: inboxItem.date ?? null,
    forwardedTo: inboxItem.forwardedTo ?? null,
    referenceId: inboxItem.referenceId ?? null,
    meta:
      (inboxItem.meta as Record<string, unknown> | null | undefined) ?? null,
    status: inboxItem.status,
    website: inboxItem.website ?? null,
    senderEmail: inboxItem.senderEmail ?? null,
    displayName: inboxItem.displayName ?? null,
    type: inboxItem.type ?? null,
    description: inboxItem.description ?? null,
    baseAmount: inboxItem.baseAmount ?? null,
    baseCurrency: inboxItem.baseCurrency ?? null,
    taxAmount: inboxItem.taxAmount ?? null,
    taxRate: inboxItem.taxRate ?? null,
    taxType: inboxItem.taxType ?? null,
    inboxAccountId: inboxItem.inboxAccountId ?? null,
    invoiceNumber: inboxItem.invoiceNumber ?? null,
    groupedInboxId: inboxItem.groupedInboxId ?? null,
  };
}

function serializeSuggestion(
  publicTeamId: string,
  suggestion: Doc<"transactionMatchSuggestions">,
) {
  return {
    id: publicSuggestionId(suggestion),
    teamId: publicTeamId,
    inboxId: suggestion.inboxId,
    transactionId: suggestion.transactionId,
    normalizedInboxName: suggestion.normalizedInboxName ?? null,
    normalizedTransactionName: suggestion.normalizedTransactionName ?? null,
    confidenceScore: suggestion.confidenceScore,
    amountScore: suggestion.amountScore ?? null,
    currencyScore: suggestion.currencyScore ?? null,
    dateScore: suggestion.dateScore ?? null,
    nameScore: suggestion.nameScore ?? null,
    matchType: suggestion.matchType,
    matchDetails:
      (suggestion.matchDetails as Record<string, unknown> | null | undefined) ??
      null,
    status: suggestion.status,
    userActionAt: suggestion.userActionAt ?? null,
    userId: suggestion.userId ?? null,
    createdAt: suggestion.createdAt,
    updatedAt: suggestion.updatedAt,
  };
}

function buildInboxItemSearchText(item: {
  displayName?: string | null;
  fileName?: string | null;
  description?: string | null;
  website?: string | null;
  senderEmail?: string | null;
  invoiceNumber?: string | null;
}) {
  return buildSearchIndexText([
    item.displayName,
    item.fileName,
    item.description,
    item.website,
    item.senderEmail,
    item.invoiceNumber,
  ]);
}

function normalizeSuggestionLearningName(input: string | null | undefined) {
  if (!input) return "";
  return input
    .toLowerCase()
    .replace(/[.,\-_'"()&]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isInboxItemSearchEligible(item: {
  status:
    | "new"
    | "archived"
    | "processing"
    | "done"
    | "pending"
    | "analyzing"
    | "suggested_match"
    | "no_match"
    | "other"
    | "deleted";
  type?: "invoice" | "expense" | "other" | null;
  transactionId?: string | null;
}) {
  return (
    item.status !== "deleted" &&
    item.status !== "other" &&
    item.type !== "other" &&
    !item.transactionId
  );
}

type InboxLiabilityAggregateKey = {
  teamId: Id<"teams">;
  date: string;
  currency: string | null;
};

type InboxLiabilityAggregateEntry = InboxLiabilityAggregateKey & {
  amount: number;
};

type InboxStatusAggregateKey = {
  teamId: Id<"teams">;
  status: InboxItemStatusValue;
  createdAtDay: string;
};

function shouldAggregateInboxLiability(item: Doc<"inboxItems">) {
  return (
    item.transactionId == null &&
    item.amount !== undefined &&
    item.amount !== null &&
    item.date !== undefined &&
    item.date !== null &&
    item.status !== "done" &&
    item.status !== "deleted"
  );
}

function getInboxLiabilityAggregateEntry(
  item: Doc<"inboxItems">,
): InboxLiabilityAggregateEntry | null {
  if (!shouldAggregateInboxLiability(item)) {
    return null;
  }

  const hasBaseAmount =
    item.baseAmount !== undefined &&
    item.baseAmount !== null &&
    item.baseCurrency !== undefined;

  return {
    teamId: item.teamId,
    date: item.date!,
    currency: hasBaseAmount
      ? (item.baseCurrency ?? null)
      : (item.currency ?? null),
    amount: Math.abs(hasBaseAmount ? item.baseAmount! : item.amount!),
  };
}

function serializeInboxLiabilityAggregateKey(key: InboxLiabilityAggregateKey) {
  return JSON.stringify([key.teamId, key.date, key.currency]);
}

async function getInboxLiabilityAggregateRecord(
  ctx: InboxCtx,
  key: InboxLiabilityAggregateKey,
) {
  return ctx.db
    .query("inboxLiabilityAggregates")
    .withIndex("by_team_date_currency", (q) =>
      q
        .eq("teamId", key.teamId)
        .eq("date", key.date)
        .eq("currency", key.currency),
    )
    .unique();
}

async function getInboxLiabilityAggregateEntriesForKey(
  ctx: InboxCtx,
  key: InboxLiabilityAggregateKey,
) {
  const records = await ctx.db
    .query("inboxItems")
    .withIndex("by_team_and_date", (q) =>
      q.eq("teamId", key.teamId).eq("date", key.date),
    )
    .collect();

  return records.flatMap((record) => {
    const entry = getInboxLiabilityAggregateEntry(record);

    return entry &&
      entry.date === key.date &&
      entry.currency === key.currency &&
      entry.teamId === key.teamId
      ? [entry]
      : [];
  });
}

async function syncInboxLiabilityAggregateKey(
  ctx: MutationCtx,
  key: InboxLiabilityAggregateKey,
) {
  const existing = await getInboxLiabilityAggregateRecord(ctx, key);
  const entries = await getInboxLiabilityAggregateEntriesForKey(ctx, key);

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

  if (existing) {
    await ctx.db.patch(existing._id, {
      totalAmount,
      itemCount: entries.length,
      updatedAt: timestamp,
    });

    return;
  }

  await ctx.db.insert("inboxLiabilityAggregates", {
    teamId: key.teamId,
    date: key.date,
    currency: key.currency ?? undefined,
    totalAmount,
    itemCount: entries.length,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

function collectInboxLiabilityAggregateKeys(
  keys: Map<string, InboxLiabilityAggregateKey>,
  previous: Doc<"inboxItems"> | null,
  next: Doc<"inboxItems"> | null,
) {
  for (const entry of [
    ...(previous ? [getInboxLiabilityAggregateEntry(previous)] : []),
    ...(next ? [getInboxLiabilityAggregateEntry(next)] : []),
  ]) {
    if (!entry) {
      continue;
    }

    const { amount: _amount, ...key } = entry;
    keys.set(serializeInboxLiabilityAggregateKey(key), key);
  }
}

function serializeInboxLiabilityAggregate(record: InboxLiabilityAggregateDoc) {
  return {
    date: record.date,
    currency: record.currency ?? null,
    totalAmount: record.totalAmount,
    itemCount: record.itemCount,
    updatedAt: record.updatedAt,
  };
}

function buildInboxLiabilityAggregateBackfillMap(records: Doc<"inboxItems">[]) {
  const aggregateMap = new Map<
    string,
    InboxLiabilityAggregateKey & { totalAmount: number; itemCount: number }
  >();

  for (const record of records) {
    const entry = getInboxLiabilityAggregateEntry(record);

    if (!entry) {
      continue;
    }

    const { amount, ...key } = entry;
    const serializedKey = serializeInboxLiabilityAggregateKey(key);
    const existing = aggregateMap.get(serializedKey);

    if (existing) {
      existing.totalAmount =
        Math.round((existing.totalAmount + amount) * 100) / 100;
      existing.itemCount += 1;
      continue;
    }

    aggregateMap.set(serializedKey, {
      ...key,
      totalAmount: Math.round(amount * 100) / 100,
      itemCount: 1,
    });
  }

  return aggregateMap;
}

async function rebuildInboxLiabilityAggregatesForTeam(
  ctx: MutationCtx,
  team: Pick<Doc<"teams">, "_id" | "publicTeamId">,
) {
  const timestamp = nowIso();
  const records = await ctx.db
    .query("inboxItems")
    .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
    .collect();
  const aggregateMap = buildInboxLiabilityAggregateBackfillMap(records);

  for (const record of await ctx.db
    .query("inboxLiabilityAggregates")
    .withIndex("by_team_and_date", (q) => q.eq("teamId", team._id))
    .collect()) {
    await ctx.db.delete(record._id);
  }

  for (const entry of aggregateMap.values()) {
    await ctx.db.insert("inboxLiabilityAggregates", {
      teamId: entry.teamId,
      date: entry.date,
      currency: entry.currency ?? undefined,
      totalAmount: entry.totalAmount,
      itemCount: entry.itemCount,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  return {
    teamId: team.publicTeamId ?? String(team._id),
    inboxItemCount: records.length,
    inboxLiabilityAggregateRows: aggregateMap.size,
  };
}

function getInboxStatusAggregateKey(
  item: Doc<"inboxItems">,
): InboxStatusAggregateKey {
  return {
    teamId: item.teamId,
    status: item.status,
    createdAtDay: item.createdAt.slice(0, 10),
  };
}

function serializeInboxStatusAggregateKey(key: InboxStatusAggregateKey) {
  return JSON.stringify([key.teamId, key.status, key.createdAtDay]);
}

async function getInboxStatusAggregateRecord(
  ctx: InboxCtx,
  key: InboxStatusAggregateKey,
) {
  return ctx.db
    .query("inboxStatusAggregates")
    .withIndex("by_team_status_created_at_day", (q) =>
      q
        .eq("teamId", key.teamId)
        .eq("status", key.status)
        .eq("createdAtDay", key.createdAtDay),
    )
    .unique();
}

async function getInboxStatusAggregateItemCountForKey(
  ctx: InboxCtx,
  key: InboxStatusAggregateKey,
) {
  const createdAtFrom = `${key.createdAtDay}T00:00:00.000Z`;
  const createdAtTo = `${key.createdAtDay}T23:59:59.999Z`;
  const records = await ctx.db
    .query("inboxItems")
    .withIndex("by_team_status_created_at", (q) =>
      q
        .eq("teamId", key.teamId)
        .eq("status", key.status)
        .gte("createdAt", createdAtFrom)
        .lte("createdAt", createdAtTo),
    )
    .collect();

  return records.length;
}

async function syncInboxStatusAggregateKey(
  ctx: MutationCtx,
  key: InboxStatusAggregateKey,
) {
  const existing = await getInboxStatusAggregateRecord(ctx, key);
  const itemCount = await getInboxStatusAggregateItemCountForKey(ctx, key);

  if (itemCount === 0) {
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return;
  }

  const timestamp = nowIso();

  if (existing) {
    await ctx.db.patch(existing._id, {
      itemCount,
      updatedAt: timestamp,
    });

    return;
  }

  await ctx.db.insert("inboxStatusAggregates", {
    teamId: key.teamId,
    status: key.status,
    createdAtDay: key.createdAtDay,
    itemCount,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

function collectInboxStatusAggregateKeys(
  keys: Map<string, InboxStatusAggregateKey>,
  previous: Doc<"inboxItems"> | null,
  next: Doc<"inboxItems"> | null,
) {
  for (const item of [previous, next]) {
    if (!item) {
      continue;
    }

    const key = getInboxStatusAggregateKey(item);
    keys.set(serializeInboxStatusAggregateKey(key), key);
  }
}

function createEmptyInboxStatusCounts() {
  return {
    new: 0,
    archived: 0,
    processing: 0,
    done: 0,
    pending: 0,
    analyzing: 0,
    suggested_match: 0,
    no_match: 0,
    other: 0,
    deleted: 0,
  };
}

function buildInboxStatusAggregateBackfillMap(records: Doc<"inboxItems">[]) {
  const aggregateMap = new Map<
    string,
    InboxStatusAggregateKey & { itemCount: number }
  >();

  for (const record of records) {
    const key = getInboxStatusAggregateKey(record);
    const serializedKey = serializeInboxStatusAggregateKey(key);
    const existing = aggregateMap.get(serializedKey);

    if (existing) {
      existing.itemCount += 1;
      continue;
    }

    aggregateMap.set(serializedKey, {
      ...key,
      itemCount: 1,
    });
  }

  return aggregateMap;
}

async function rebuildInboxStatusAggregatesForTeam(
  ctx: MutationCtx,
  team: Pick<Doc<"teams">, "_id" | "publicTeamId">,
) {
  const timestamp = nowIso();
  const records = await ctx.db
    .query("inboxItems")
    .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
    .collect();
  const aggregateMap = buildInboxStatusAggregateBackfillMap(records);

  for (const record of await ctx.db
    .query("inboxStatusAggregates")
    .withIndex("by_team_and_created_at_day", (q) => q.eq("teamId", team._id))
    .collect()) {
    await ctx.db.delete(record._id);
  }

  for (const entry of aggregateMap.values()) {
    await ctx.db.insert("inboxStatusAggregates", {
      teamId: entry.teamId,
      status: entry.status,
      createdAtDay: entry.createdAtDay,
      itemCount: entry.itemCount,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  return {
    teamId: team.publicTeamId ?? String(team._id),
    inboxItemCount: records.length,
    inboxStatusAggregateRows: aggregateMap.size,
  };
}

async function countInboxItemsInCreatedAtRange(
  ctx: QueryCtx,
  args: {
    teamId: Id<"teams">;
    status: InboxItemStatusValue;
    createdAtFrom: string;
    createdAtTo: string;
  },
) {
  const records = await ctx.db
    .query("inboxItems")
    .withIndex("by_team_status_created_at", (q) =>
      q
        .eq("teamId", args.teamId)
        .eq("status", args.status)
        .gte("createdAt", args.createdAtFrom)
        .lte("createdAt", args.createdAtTo),
    )
    .collect();

  return records.length;
}

async function getInboxStatusRangeCountFromAggregates(
  ctx: QueryCtx,
  args: {
    teamId: Id<"teams">;
    status: InboxItemStatusValue;
    createdAtFrom: string;
    createdAtTo: string;
    aggregateRows: InboxStatusAggregateDoc[];
  },
) {
  const fromDay = args.createdAtFrom.slice(0, 10);
  const toDay = args.createdAtTo.slice(0, 10);
  const fullFromDayStart = `${fromDay}T00:00:00.000Z`;
  const fullToDayEnd = `${toDay}T23:59:59.999Z`;
  const includesFullFromDay = args.createdAtFrom === fullFromDayStart;
  const includesFullToDay = args.createdAtTo === fullToDayEnd;

  if (fromDay === toDay) {
    if (includesFullFromDay && includesFullToDay) {
      return args.aggregateRows.reduce(
        (sum, row) =>
          row.status === args.status && row.createdAtDay === fromDay
            ? sum + row.itemCount
            : sum,
        0,
      );
    }

    return countInboxItemsInCreatedAtRange(ctx, args);
  }

  let count = 0;

  for (const row of args.aggregateRows) {
    if (row.status !== args.status) {
      continue;
    }

    if (row.createdAtDay > fromDay && row.createdAtDay < toDay) {
      count += row.itemCount;
      continue;
    }

    if (row.createdAtDay === fromDay && includesFullFromDay) {
      count += row.itemCount;
      continue;
    }

    if (row.createdAtDay === toDay && includesFullToDay) {
      count += row.itemCount;
    }
  }

  if (!includesFullFromDay) {
    count += await countInboxItemsInCreatedAtRange(ctx, {
      teamId: args.teamId,
      status: args.status,
      createdAtFrom: args.createdAtFrom,
      createdAtTo: `${fromDay}T23:59:59.999Z`,
    });
  }

  if (!includesFullToDay) {
    count += await countInboxItemsInCreatedAtRange(ctx, {
      teamId: args.teamId,
      status: args.status,
      createdAtFrom: `${toDay}T00:00:00.000Z`,
      createdAtTo: args.createdAtTo,
    });
  }

  return count;
}

async function getInboxTeamOrThrow(ctx: InboxCtx, publicTeamId: string) {
  const team = await getTeamByPublicTeamId(ctx, publicTeamId);

  if (!team) {
    throw new ConvexError("Convex inbox team not found");
  }

  return team;
}

async function getInboxItemByPublicId(
  ctx: InboxCtx,
  args: {
    inboxId: string;
    teamId: Id<"teams">;
  },
) {
  const byLegacyId = await ctx.db
    .query("inboxItems")
    .withIndex("by_public_inbox_id", (q) => q.eq("publicInboxId", args.inboxId))
    .unique();

  if (byLegacyId && byLegacyId.teamId === args.teamId) {
    return byLegacyId;
  }

  try {
    const byDocId = await ctx.db.get(args.inboxId as Id<"inboxItems">);

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

async function getInboxItemByPublicIdAnyTeam(ctx: InboxCtx, inboxId: string) {
  const byLegacyId = await ctx.db
    .query("inboxItems")
    .withIndex("by_public_inbox_id", (q) => q.eq("publicInboxId", inboxId))
    .unique();

  if (byLegacyId) {
    return byLegacyId;
  }

  try {
    return await ctx.db.get(inboxId as Id<"inboxItems">);
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.includes("db.get") ||
      !error.message.includes("Unable to decode ID")
    ) {
      throw error;
    }

    return null;
  }
}

async function getTransactionByPublicId(
  ctx: InboxCtx,
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

  try {
    const byDocId = await ctx.db.get(args.transactionId as Id<"transactions">);

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

type SuggestionLookupCache = {
  inboxItems: Map<string, Promise<Doc<"inboxItems"> | null>>;
  transactions: Map<string, Promise<Doc<"transactions"> | null>>;
};

async function getSuggestionLearningFields(
  ctx: InboxCtx,
  args: {
    teamId: Id<"teams">;
    inboxId: string;
    transactionId: string;
    cache?: SuggestionLookupCache;
  },
) {
  const inboxLookup = args.cache?.inboxItems.get(args.inboxId);
  const inboxPromise =
    inboxLookup ??
    getInboxItemByPublicId(ctx, {
      inboxId: args.inboxId,
      teamId: args.teamId,
    });
  if (!inboxLookup) {
    args.cache?.inboxItems.set(args.inboxId, inboxPromise);
  }

  const transactionLookup = args.cache?.transactions.get(args.transactionId);
  const transactionPromise =
    transactionLookup ??
    getTransactionByPublicId(ctx, {
      transactionId: args.transactionId,
      teamId: args.teamId,
    });
  if (!transactionLookup) {
    args.cache?.transactions.set(args.transactionId, transactionPromise);
  }

  const [inboxItem, transaction] = await Promise.all([
    inboxPromise,
    transactionPromise,
  ]);
  const normalizedInboxName = normalizeSuggestionLearningName(
    inboxItem?.displayName,
  );
  const normalizedTransactionName = normalizeSuggestionLearningName(
    transaction?.merchantName || transaction?.name,
  );

  if (!normalizedInboxName || !normalizedTransactionName) {
    return {
      normalizedInboxName: undefined,
      normalizedTransactionName: undefined,
    };
  }

  return {
    normalizedInboxName,
    normalizedTransactionName,
  };
}

async function getSuggestionByPublicId(ctx: InboxCtx, suggestionId: string) {
  const byLegacyId = await ctx.db
    .query("transactionMatchSuggestions")
    .withIndex("by_public_suggestion_id", (q) =>
      q.eq("publicSuggestionId", suggestionId),
    )
    .unique();

  if (byLegacyId) {
    return byLegacyId;
  }

  try {
    return await ctx.db.get(suggestionId as Id<"transactionMatchSuggestions">);
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.includes("db.get") ||
      !error.message.includes("Unable to decode ID")
    ) {
      throw error;
    }

    return null;
  }
}

export const serviceGetInboxItems = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    ids: v.optional(v.array(v.string())),
    referenceIds: v.optional(v.array(v.string())),
    groupedInboxIds: v.optional(v.array(v.string())),
    transactionIds: v.optional(v.array(v.string())),
    invoiceNumber: nullableString,
    date: nullableString,
    filePath: v.optional(v.array(v.string())),
    statuses: v.optional(v.array(inboxItemStatus)),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    let records: Doc<"inboxItems">[] = [];

    if (args.ids && args.ids.length > 0) {
      const resolved = await Promise.all(
        [...new Set(args.ids)].map((inboxId) =>
          getInboxItemByPublicId(ctx, {
            inboxId,
            teamId: team._id,
          }),
        ),
      );

      records = resolved.filter(
        (record): record is Doc<"inboxItems"> => record !== null,
      );
    } else if (args.referenceIds && args.referenceIds.length > 0) {
      const resolved = await Promise.all(
        [...new Set(args.referenceIds)].map((referenceId) =>
          ctx.db
            .query("inboxItems")
            .withIndex("by_team_and_reference_id", (q) =>
              q.eq("teamId", team._id).eq("referenceId", referenceId),
            )
            .unique(),
        ),
      );

      records = resolved.filter(
        (record): record is Doc<"inboxItems"> => record !== null,
      );
    } else if (args.transactionIds && args.transactionIds.length > 0) {
      const collected = await Promise.all(
        [...new Set(args.transactionIds)].map((transactionId) =>
          ctx.db
            .query("inboxItems")
            .withIndex("by_team_and_transaction", (q) =>
              q.eq("teamId", team._id).eq("transactionId", transactionId),
            )
            .collect(),
        ),
      );

      records = collected.flat();
    } else if (args.groupedInboxIds && args.groupedInboxIds.length > 0) {
      const collected = await Promise.all(
        [...new Set(args.groupedInboxIds)].map((groupedInboxId) =>
          ctx.db
            .query("inboxItems")
            .withIndex("by_team_and_grouped_inbox", (q) =>
              q.eq("teamId", team._id).eq("groupedInboxId", groupedInboxId),
            )
            .collect(),
        ),
      );

      records = collected.flat();
    } else if (args.invoiceNumber) {
      records = await ctx.db
        .query("inboxItems")
        .withIndex("by_team_and_invoice_number", (q) =>
          q.eq("teamId", team._id).eq("invoiceNumber", args.invoiceNumber!),
        )
        .collect();
    } else if (args.filePath && args.filePath.length > 0) {
      records = await ctx.db
        .query("inboxItems")
        .withIndex("by_team_and_file_path_key", (q) =>
          q
            .eq("teamId", team._id)
            .eq("filePathKey", inboxFilePathKey(args.filePath!)),
        )
        .collect();
    } else if (args.date) {
      records = await ctx.db
        .query("inboxItems")
        .withIndex("by_team_and_date", (q) =>
          q.eq("teamId", team._id).eq("date", args.date!),
        )
        .collect();
    } else if (args.statuses && args.statuses.length === 1) {
      records = await ctx.db
        .query("inboxItems")
        .withIndex("by_team_and_status", (q) =>
          q.eq("teamId", team._id).eq("status", args.statuses![0]!),
        )
        .collect();
    } else {
      records = await ctx.db
        .query("inboxItems")
        .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
        .collect();
    }

    const statuses = args.statuses ? new Set(args.statuses) : null;

    return records
      .filter((record) => (statuses ? statuses.has(record.status) : true))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((record) => serializeInboxItem(args.publicTeamId, record));
  },
});

export const serviceListInboxItemsByDatePage = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    dateGte: nullableString,
    dateLte: nullableString,
    order: v.optional(inboxOrder),
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

    const baseQuery = ctx.db
      .query("inboxItems")
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

    const result = await baseQuery
      .order(args.order ?? "desc")
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: result.page.map((record) =>
        serializeInboxItem(args.publicTeamId, record),
      ),
    };
  },
});

export const serviceListInboxItemsPage = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    status: v.optional(inboxItemStatus),
    order: v.optional(inboxOrder),
    createdAtFrom: nullableString,
    createdAtTo: nullableString,
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

    const baseQuery = args.status
      ? ctx.db
          .query("inboxItems")
          .withIndex("by_team_status_created_at", (q) => {
            const range = q.eq("teamId", team._id).eq("status", args.status!);

            if (args.createdAtFrom && args.createdAtTo) {
              return range
                .gte("createdAt", args.createdAtFrom)
                .lte("createdAt", args.createdAtTo);
            }

            if (args.createdAtFrom) {
              return range.gte("createdAt", args.createdAtFrom);
            }

            if (args.createdAtTo) {
              return range.lte("createdAt", args.createdAtTo);
            }

            return range;
          })
      : ctx.db.query("inboxItems").withIndex("by_team_and_created_at", (q) => {
          const range = q.eq("teamId", team._id);

          if (args.createdAtFrom && args.createdAtTo) {
            return range
              .gte("createdAt", args.createdAtFrom)
              .lte("createdAt", args.createdAtTo);
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
      page: result.page.map((record) =>
        serializeInboxItem(args.publicTeamId, record),
      ),
    };
  },
});

export const serviceSearchInboxItems = query({
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
      .query("inboxItems")
      .withSearchIndex("search_by_team_and_search_eligible", (q) =>
        q
          .search("searchText", searchQuery)
          .eq("teamId", team._id)
          .eq("searchEligible", true),
      )
      .take(Math.max(1, Math.min(args.limit ?? 100, 400)));

    return records.map((record) =>
      serializeInboxItem(args.publicTeamId, record),
    );
  },
});

export const serviceGetInboxItemsByAmountRange = query({
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
      .query("inboxItems")
      .withIndex("by_team_search_eligible_amount", (q) =>
        q
          .eq("teamId", team._id)
          .eq("searchEligible", true)
          .gte("searchAmount", args.minAmount)
          .lte("searchAmount", args.maxAmount),
      )
      .take(Math.max(1, Math.min(args.limit ?? 100, 400)));

    return records
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((record) => serializeInboxItem(args.publicTeamId, record));
  },
});

export const serviceGetInboxItemById = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    inboxId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return null;
    }

    const record = await getInboxItemByPublicId(ctx, {
      inboxId: args.inboxId,
      teamId: team._id,
    });

    return record ? serializeInboxItem(args.publicTeamId, record) : null;
  },
});

export const serviceGetInboxItemInfo = query({
  args: {
    serviceKey: v.string(),
    inboxId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const record = await getInboxItemByPublicIdAnyTeam(ctx, args.inboxId);

    if (!record) {
      return null;
    }

    const team = await ctx.db.get(record.teamId);

    if (!team?.publicTeamId) {
      return null;
    }

    return serializeInboxItem(team.publicTeamId, record);
  },
});

export const serviceListPendingInboxItemsToNoMatch = query({
  args: {
    serviceKey: v.string(),
    createdAtTo: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const result = await ctx.db
      .query("inboxItems")
      .withIndex("by_status_created_at", (q) =>
        q.eq("status", "pending").lte("createdAt", args.createdAtTo),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    const records = result.page.filter(
      (record) => record.transactionId == null,
    );
    const teamIds = [...new Set(records.map((record) => record.teamId))];
    const teams = new Map<Id<"teams">, string | null>();

    for (const teamId of teamIds) {
      const team = await ctx.db.get(teamId);
      teams.set(teamId, team?.publicTeamId ?? null);
    }

    return {
      ...result,
      page: records.flatMap((record) => {
        const publicTeamId = teams.get(record.teamId);

        return publicTeamId ? [serializeInboxItem(publicTeamId, record)] : [];
      }),
    };
  },
});

export const serviceUpsertInboxItems = mutation({
  args: {
    serviceKey: v.string(),
    items: v.array(inboxItemInput),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.items.length === 0) {
      return [];
    }

    const teamCache = new Map<
      string,
      Awaited<ReturnType<typeof getInboxTeamOrThrow>>
    >();
    const results = [];
    const liabilityAggregateKeys = new Map<
      string,
      InboxLiabilityAggregateKey
    >();
    const statusAggregateKeys = new Map<string, InboxStatusAggregateKey>();

    for (const item of args.items) {
      let team = teamCache.get(item.publicTeamId);

      if (!team) {
        team = await getInboxTeamOrThrow(ctx, item.publicTeamId);
        teamCache.set(item.publicTeamId, team);
      }

      const existing =
        (item.id
          ? await getInboxItemByPublicId(ctx, {
              inboxId: item.id,
              teamId: team._id,
            })
          : null) ??
        (item.referenceId
          ? await ctx.db
              .query("inboxItems")
              .withIndex("by_team_and_reference_id", (q) =>
                q.eq("teamId", team._id).eq("referenceId", item.referenceId!),
              )
              .unique()
          : null);

      const timestamp = item.updatedAt ?? nowIso();
      const payload = {
        teamId: team._id,
        createdAt: item.createdAt ?? existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
        filePath: item.filePath,
        filePathKey: inboxFilePathKey(item.filePath),
        fileName: item.fileName ?? undefined,
        transactionId: item.transactionId ?? undefined,
        amount: item.amount ?? undefined,
        currency: item.currency ?? undefined,
        contentType: item.contentType ?? undefined,
        size: item.size ?? undefined,
        attachmentId: item.attachmentId ?? undefined,
        date: item.date ?? undefined,
        forwardedTo: item.forwardedTo ?? undefined,
        referenceId: item.referenceId ?? undefined,
        meta: item.meta,
        status: item.status,
        website: item.website ?? undefined,
        senderEmail: item.senderEmail ?? undefined,
        displayName: item.displayName ?? undefined,
        type: item.type ?? undefined,
        description: item.description ?? undefined,
        baseAmount: item.baseAmount ?? undefined,
        baseCurrency: item.baseCurrency ?? undefined,
        taxAmount: item.taxAmount ?? undefined,
        taxRate: item.taxRate ?? undefined,
        taxType: item.taxType ?? undefined,
        inboxAccountId: item.inboxAccountId ?? undefined,
        invoiceNumber: item.invoiceNumber ?? undefined,
        groupedInboxId: item.groupedInboxId ?? undefined,
        searchText: buildInboxItemSearchText(item) || undefined,
        searchEligible: isInboxItemSearchEligible(item),
        searchAmount: buildAbsoluteAmountSearchValue(item.amount) ?? undefined,
      };

      if (existing) {
        await ctx.db.patch(existing._id, {
          publicInboxId:
            existing.publicInboxId ?? item.id ?? crypto.randomUUID(),
          ...payload,
        });

        const updated = await ctx.db.get(existing._id);

        if (!updated) {
          throw new ConvexError("Failed to update inbox item");
        }

        collectInboxLiabilityAggregateKeys(
          liabilityAggregateKeys,
          existing,
          updated,
        );
        collectInboxStatusAggregateKeys(statusAggregateKeys, existing, updated);
        results.push(serializeInboxItem(item.publicTeamId, updated));
        continue;
      }

      const insertedId = await ctx.db.insert("inboxItems", {
        publicInboxId: item.id ?? crypto.randomUUID(),
        ...payload,
      });
      const inserted = await ctx.db.get(insertedId);

      if (!inserted) {
        throw new ConvexError("Failed to create inbox item");
      }

      collectInboxLiabilityAggregateKeys(
        liabilityAggregateKeys,
        null,
        inserted,
      );
      collectInboxStatusAggregateKeys(statusAggregateKeys, null, inserted);
      results.push(serializeInboxItem(item.publicTeamId, inserted));
    }

    for (const key of liabilityAggregateKeys.values()) {
      await syncInboxLiabilityAggregateKey(ctx, key);
    }

    for (const key of statusAggregateKeys.values()) {
      await syncInboxStatusAggregateKey(ctx, key);
    }

    return results;
  },
});

export const serviceGetTransactionMatchSuggestions = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    inboxId: v.optional(v.string()),
    transactionId: v.optional(v.string()),
    transactionIds: v.optional(v.array(v.string())),
    statuses: v.optional(v.array(suggestionStatus)),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    let records: Doc<"transactionMatchSuggestions">[] = [];

    if (args.inboxId) {
      records = await ctx.db
        .query("transactionMatchSuggestions")
        .withIndex("by_team_and_inbox", (q) =>
          q.eq("teamId", team._id).eq("inboxId", args.inboxId!),
        )
        .collect();
    } else if (args.transactionId) {
      records = await ctx.db
        .query("transactionMatchSuggestions")
        .withIndex("by_team_and_transaction", (q) =>
          q.eq("teamId", team._id).eq("transactionId", args.transactionId!),
        )
        .collect();
    } else if (args.transactionIds && args.transactionIds.length > 0) {
      const existing = await Promise.all(
        [...new Set(args.transactionIds)].map((transactionId) =>
          ctx.db
            .query("transactionMatchSuggestions")
            .withIndex("by_team_and_transaction", (q) =>
              q.eq("teamId", team._id).eq("transactionId", transactionId),
            )
            .collect(),
        ),
      );

      records = existing.flat() as Doc<"transactionMatchSuggestions">[];
    } else if (args.statuses && args.statuses.length === 1) {
      records = await ctx.db
        .query("transactionMatchSuggestions")
        .withIndex("by_team_status_created_at", (q) =>
          q.eq("teamId", team._id).eq("status", args.statuses![0]!),
        )
        .collect();
    } else {
      records = await ctx.db
        .query("transactionMatchSuggestions")
        .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
        .collect();
    }

    const statuses = args.statuses ? new Set(args.statuses) : null;

    return records
      .filter((record) => (statuses ? statuses.has(record.status) : true))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((record) => serializeSuggestion(args.publicTeamId, record));
  },
});

export const serviceListTransactionMatchSuggestionsPage = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    status: suggestionStatus,
    order: v.optional(inboxOrder),
    createdAtFrom: nullableString,
    createdAtTo: nullableString,
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

    const result = await ctx.db
      .query("transactionMatchSuggestions")
      .withIndex("by_team_status_created_at", (q) => {
        const range = q.eq("teamId", team._id).eq("status", args.status);

        if (args.createdAtFrom && args.createdAtTo) {
          return range
            .gte("createdAt", args.createdAtFrom)
            .lte("createdAt", args.createdAtTo);
        }

        if (args.createdAtFrom) {
          return range.gte("createdAt", args.createdAtFrom);
        }

        if (args.createdAtTo) {
          return range.lte("createdAt", args.createdAtTo);
        }

        return range;
      })
      .order(args.order ?? "desc")
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: result.page.map((record) =>
        serializeSuggestion(args.publicTeamId, record),
      ),
    };
  },
});

export const serviceUpsertTransactionMatchSuggestions = mutation({
  args: {
    serviceKey: v.string(),
    suggestions: v.array(transactionMatchSuggestionInput),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.suggestions.length === 0) {
      return [];
    }

    const teamCache = new Map<
      string,
      Awaited<ReturnType<typeof getInboxTeamOrThrow>>
    >();
    const suggestionLookupCache: SuggestionLookupCache = {
      inboxItems: new Map(),
      transactions: new Map(),
    };
    const results = [];

    for (const suggestion of args.suggestions) {
      let team = teamCache.get(suggestion.publicTeamId);

      if (!team) {
        team = await getInboxTeamOrThrow(ctx, suggestion.publicTeamId);
        teamCache.set(suggestion.publicTeamId, team);
      }

      const existing =
        (suggestion.id
          ? await getSuggestionByPublicId(ctx, suggestion.id)
          : null) ??
        (await ctx.db
          .query("transactionMatchSuggestions")
          .withIndex("by_team_inbox_transaction", (q) =>
            q
              .eq("teamId", team._id)
              .eq("inboxId", suggestion.inboxId)
              .eq("transactionId", suggestion.transactionId),
          )
          .unique());

      const timestamp = suggestion.updatedAt ?? nowIso();
      const learningFields = await getSuggestionLearningFields(ctx, {
        teamId: team._id,
        inboxId: suggestion.inboxId,
        transactionId: suggestion.transactionId,
        cache: suggestionLookupCache,
      });
      const payload = {
        teamId: team._id,
        inboxId: suggestion.inboxId,
        transactionId: suggestion.transactionId,
        ...learningFields,
        confidenceScore: suggestion.confidenceScore,
        amountScore: suggestion.amountScore ?? undefined,
        currencyScore: suggestion.currencyScore ?? undefined,
        dateScore: suggestion.dateScore ?? undefined,
        nameScore: suggestion.nameScore ?? undefined,
        matchType: suggestion.matchType,
        matchDetails: suggestion.matchDetails,
        status: suggestion.status,
        userActionAt: suggestion.userActionAt ?? undefined,
        userId: suggestion.userId ?? undefined,
        createdAt: suggestion.createdAt ?? existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };

      if (existing) {
        await ctx.db.patch(existing._id, {
          publicSuggestionId:
            existing.publicSuggestionId ?? suggestion.id ?? crypto.randomUUID(),
          ...payload,
        });

        const updated = await ctx.db.get(existing._id);

        if (!updated) {
          throw new ConvexError(
            "Failed to update transaction match suggestion",
          );
        }

        results.push(serializeSuggestion(suggestion.publicTeamId, updated));
        continue;
      }

      const insertedId = await ctx.db.insert("transactionMatchSuggestions", {
        publicSuggestionId: suggestion.id ?? crypto.randomUUID(),
        ...payload,
      });
      const inserted = await ctx.db.get(insertedId);

      if (!inserted) {
        throw new ConvexError("Failed to create transaction match suggestion");
      }

      results.push(serializeSuggestion(suggestion.publicTeamId, inserted));
    }

    return results;
  },
});

export const serviceRebuildTransactionMatchSuggestionLearningFields = mutation({
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
      throw new ConvexError("Convex inbox team not found");
    }

    const results = [];

    for (const team of validTeams) {
      const cache: SuggestionLookupCache = {
        inboxItems: new Map(),
        transactions: new Map(),
      };
      const suggestions = await ctx.db
        .query("transactionMatchSuggestions")
        .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
        .collect();
      let updatedSuggestionCount = 0;

      for (const suggestion of suggestions) {
        const learningFields = await getSuggestionLearningFields(ctx, {
          teamId: team._id,
          inboxId: suggestion.inboxId,
          transactionId: suggestion.transactionId,
          cache,
        });

        if (
          suggestion.normalizedInboxName ===
            learningFields.normalizedInboxName &&
          suggestion.normalizedTransactionName ===
            learningFields.normalizedTransactionName
        ) {
          continue;
        }

        await ctx.db.patch(suggestion._id, learningFields);
        updatedSuggestionCount++;
      }

      results.push({
        teamId: team.publicTeamId ?? team._id,
        suggestionCount: suggestions.length,
        updatedSuggestionCount,
      });
    }

    return results;
  },
});

export const serviceGetInboxLiabilityAggregateRows = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
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
      .query("inboxLiabilityAggregates")
      .withIndex("by_team_and_date", (q) => {
        const range = q.eq("teamId", team._id);

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

    return records.map(serializeInboxLiabilityAggregate);
  },
});

export const serviceGetInboxStatusCountSummary = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    createdAtFrom: nullableString,
    createdAtTo: nullableString,
    rangeStatus: v.optional(inboxItemStatus),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);
    const totals = createEmptyInboxStatusCounts();

    if (!team) {
      return {
        totals,
        rangeCount: 0,
      };
    }

    const aggregateRows = await ctx.db
      .query("inboxStatusAggregates")
      .withIndex("by_team_and_created_at_day", (q) => q.eq("teamId", team._id))
      .collect();

    for (const row of aggregateRows) {
      totals[row.status] += row.itemCount;
    }

    const rangeCount =
      args.rangeStatus && args.createdAtFrom && args.createdAtTo
        ? await getInboxStatusRangeCountFromAggregates(ctx, {
            teamId: team._id,
            status: args.rangeStatus,
            createdAtFrom: args.createdAtFrom,
            createdAtTo: args.createdAtTo,
            aggregateRows,
          })
        : 0;

    return {
      totals,
      rangeCount,
    };
  },
});

export const serviceRebuildInboxLiabilityAggregates = mutation({
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
      throw new ConvexError("Convex inbox team not found");
    }

    const results = [];

    for (const team of validTeams) {
      results.push(await rebuildInboxLiabilityAggregatesForTeam(ctx, team));
    }

    return results;
  },
});

export const serviceRebuildInboxStatusAggregates = mutation({
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
      throw new ConvexError("Convex inbox team not found");
    }

    const results = [];

    for (const team of validTeams) {
      results.push(await rebuildInboxStatusAggregatesForTeam(ctx, team));
    }

    return results;
  },
});

export const serviceDeleteTransactionMatchSuggestions = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    suggestionIds: v.optional(v.array(v.string())),
    inboxIds: v.optional(v.array(v.string())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const deletedIds: string[] = [];
    const suggestionIds = new Set(args.suggestionIds ?? []);
    const inboxIds = new Set(args.inboxIds ?? []);

    if (suggestionIds.size === 0 && inboxIds.size === 0) {
      return deletedIds;
    }

    const records = await ctx.db
      .query("transactionMatchSuggestions")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect();

    for (const record of records) {
      if (
        (suggestionIds.size > 0 &&
          suggestionIds.has(publicSuggestionId(record))) ||
        (inboxIds.size > 0 && inboxIds.has(record.inboxId))
      ) {
        deletedIds.push(publicSuggestionId(record));
        await ctx.db.delete(record._id);
      }
    }

    return deletedIds;
  },
});
