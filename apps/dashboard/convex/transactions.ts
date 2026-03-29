import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
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

      results.push(serializeTransaction(args.publicTeamId, inserted));
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
