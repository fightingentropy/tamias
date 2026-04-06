import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getAppUserById, getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";
import { nowIso } from "../../packages/domain/src/identity";

const sortByValidator = v.union(v.literal("popular"), v.literal("recent"));

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

function serializeInvoiceProduct(
  publicTeamId: string,
  record: {
    _id: string;
    publicInvoiceProductId?: string;
    createdByAppUserId?: Id<"appUsers">;
    name: string;
    description?: string | null;
    price?: number | null;
    currency?: string | null;
    unit?: string | null;
    taxRate?: number | null;
    isActive: boolean;
    usageCount: number;
    lastUsedAt?: string | null;
    createdAt: string;
    updatedAt?: string | null;
  },
) {
  return {
    id: record.publicInvoiceProductId ?? record._id,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt ?? null,
    teamId: publicTeamId,
    createdBy: record.createdByAppUserId ?? null,
    name: record.name,
    description: record.description ?? null,
    price: record.price ?? null,
    currency: record.currency ?? null,
    unit: record.unit ?? null,
    taxRate: record.taxRate ?? null,
    isActive: record.isActive,
    usageCount: record.usageCount,
    lastUsedAt: record.lastUsedAt ?? null,
  };
}

async function getInvoiceProductRecordForTeam(
  ctx: QueryCtx | MutationCtx,
  publicTeamId: string,
  invoiceProductId: string,
) {
  const [team, record] = await Promise.all([
    getTeamByPublicTeamId(ctx, publicTeamId),
    ctx.db
      .query("invoiceProducts")
      .withIndex("by_public_invoice_product_id", (q) =>
        q.eq("publicInvoiceProductId", invoiceProductId),
      )
      .unique(),
  ]);

  if (!team || !record || record.teamId !== team._id) {
    return { team: null, record: null };
  }

  return { team, record };
}

async function ensureUniqueInvoiceProductKey(
  ctx: QueryCtx | MutationCtx,
  args: {
    teamId: Id<"teams">;
    name: string;
    currency?: string | null;
    price?: number | null;
    ignorePublicInvoiceProductId?: string;
  },
) {
  const existing = await ctx.db
    .query("invoiceProducts")
    .withIndex("by_team_name_currency_price", (q) =>
      q
        .eq("teamId", args.teamId)
        .eq("nameKey", toNameKey(args.name))
        .eq("currencyKey", toCurrencyKey(args.currency))
        .eq("priceKey", toPriceKey(args.price)),
    )
    .unique();

  if (existing && existing.publicInvoiceProductId !== args.ignorePublicInvoiceProductId) {
    throw new ConvexError("Invoice product already exists");
  }
}

export const serviceGetInvoiceProducts = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    sortBy: v.optional(sortByValidator),
    limit: v.optional(v.number()),
    includeInactive: v.optional(v.boolean()),
    currency: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const sortBy = args.sortBy ?? "popular";
    const limit = args.limit ?? 50;
    const includeInactive = args.includeInactive ?? false;
    const currency = args.currency ?? null;

    const records = includeInactive
      ? await ctx.db
          .query("invoiceProducts")
          .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
          .collect()
      : await ctx.db
          .query("invoiceProducts")
          .withIndex("by_team_active", (q) => q.eq("teamId", team._id).eq("isActive", true))
          .collect();

    return records
      .filter((record) => currency === null || record.currency === currency)
      .sort((left, right) => {
        if (sortBy === "recent") {
          const leftRecent = left.lastUsedAt ?? "";
          const rightRecent = right.lastUsedAt ?? "";

          if (leftRecent !== rightRecent) {
            return rightRecent.localeCompare(leftRecent);
          }

          return right.usageCount - left.usageCount;
        }

        if (left.usageCount !== right.usageCount) {
          return right.usageCount - left.usageCount;
        }

        const leftRecent = left.lastUsedAt ?? "";
        const rightRecent = right.lastUsedAt ?? "";
        return rightRecent.localeCompare(leftRecent);
      })
      .slice(0, limit)
      .map((record) => serializeInvoiceProduct(args.publicTeamId, record));
  },
});

export const serviceGetInvoiceProductById = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    invoiceProductId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const { record } = await getInvoiceProductRecordForTeam(
      ctx,
      args.publicTeamId,
      args.invoiceProductId,
    );

    return record ? serializeInvoiceProduct(args.publicTeamId, record) : null;
  },
});

export const serviceCreateInvoiceProduct = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    userId: v.id("appUsers"),
    name: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    price: v.optional(v.union(v.number(), v.null())),
    currency: v.optional(v.union(v.string(), v.null())),
    unit: v.optional(v.union(v.string(), v.null())),
    taxRate: v.optional(v.union(v.number(), v.null())),
    isActive: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [team, appUser] = await Promise.all([
      getTeamByPublicTeamId(ctx, args.publicTeamId),
      getAppUserById(ctx, args.userId),
    ]);

    if (!team || !appUser) {
      throw new ConvexError("Convex invoice product target not found");
    }

    await ensureUniqueInvoiceProductKey(ctx, {
      teamId: team._id,
      name: args.name,
      currency: args.currency ?? null,
      price: args.price ?? null,
    });

    const timestamp = nowIso();
    const insertedId = await ctx.db.insert("invoiceProducts", {
      publicInvoiceProductId: crypto.randomUUID(),
      teamId: team._id,
      createdByAppUserId: appUser._id,
      name: args.name,
      nameKey: toNameKey(args.name),
      normalizedName: normalizeName(args.name),
      description: args.description ?? null,
      price: args.price ?? null,
      priceKey: toPriceKey(args.price ?? null),
      currency: args.currency ?? null,
      currencyKey: toCurrencyKey(args.currency ?? null),
      unit: args.unit ?? null,
      taxRate: args.taxRate ?? null,
      isActive: args.isActive ?? true,
      usageCount: 0,
      lastUsedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError("Failed to create invoice product");
    }

    return serializeInvoiceProduct(args.publicTeamId, inserted);
  },
});

export const serviceUpsertInvoiceProduct = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    userId: v.id("appUsers"),
    name: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    price: v.optional(v.union(v.number(), v.null())),
    currency: v.optional(v.union(v.string(), v.null())),
    unit: v.optional(v.union(v.string(), v.null())),
    taxRate: v.optional(v.union(v.number(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [team, appUser] = await Promise.all([
      getTeamByPublicTeamId(ctx, args.publicTeamId),
      getAppUserById(ctx, args.userId),
    ]);

    if (!team || !appUser) {
      throw new ConvexError("Convex invoice product target not found");
    }

    const existing = await ctx.db
      .query("invoiceProducts")
      .withIndex("by_team_name_currency_price", (q) =>
        q
          .eq("teamId", team._id)
          .eq("nameKey", toNameKey(args.name))
          .eq("currencyKey", toCurrencyKey(args.currency ?? null))
          .eq("priceKey", toPriceKey(args.price ?? null)),
      )
      .unique();

    const timestamp = nowIso();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(args.description !== undefined && {
          description: args.description ?? null,
        }),
        ...(args.unit !== undefined && { unit: args.unit ?? null }),
        ...(args.taxRate !== undefined && { taxRate: args.taxRate ?? null }),
        usageCount: existing.usageCount + 1,
        lastUsedAt: timestamp,
        updatedAt: timestamp,
      });

      return serializeInvoiceProduct(args.publicTeamId, {
        ...existing,
        description:
          args.description !== undefined ? (args.description ?? null) : existing.description,
        unit: args.unit !== undefined ? (args.unit ?? null) : existing.unit,
        taxRate: args.taxRate !== undefined ? (args.taxRate ?? null) : existing.taxRate,
        usageCount: existing.usageCount + 1,
        lastUsedAt: timestamp,
        updatedAt: timestamp,
      });
    }

    const insertedId = await ctx.db.insert("invoiceProducts", {
      publicInvoiceProductId: crypto.randomUUID(),
      teamId: team._id,
      createdByAppUserId: appUser._id,
      name: args.name,
      nameKey: toNameKey(args.name),
      normalizedName: normalizeName(args.name),
      description: args.description ?? null,
      price: args.price ?? null,
      priceKey: toPriceKey(args.price ?? null),
      currency: args.currency ?? null,
      currencyKey: toCurrencyKey(args.currency ?? null),
      unit: args.unit ?? null,
      taxRate: args.taxRate ?? null,
      isActive: true,
      usageCount: 1,
      lastUsedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError("Failed to upsert invoice product");
    }

    return serializeInvoiceProduct(args.publicTeamId, inserted);
  },
});

export const serviceUpdateInvoiceProduct = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    invoiceProductId: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    price: v.optional(v.union(v.number(), v.null())),
    currency: v.optional(v.union(v.string(), v.null())),
    unit: v.optional(v.union(v.string(), v.null())),
    taxRate: v.optional(v.union(v.number(), v.null())),
    isActive: v.optional(v.boolean()),
    usageCount: v.optional(v.number()),
    lastUsedAt: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const { team, record } = await getInvoiceProductRecordForTeam(
      ctx,
      args.publicTeamId,
      args.invoiceProductId,
    );

    if (!team || !record) {
      return null;
    }

    const nextName = args.name ?? record.name;
    const nextCurrency = args.currency !== undefined ? (args.currency ?? null) : record.currency;
    const nextPrice = args.price !== undefined ? (args.price ?? null) : record.price;

    await ensureUniqueInvoiceProductKey(ctx, {
      teamId: team._id,
      name: nextName,
      currency: nextCurrency,
      price: nextPrice,
      ignorePublicInvoiceProductId: args.invoiceProductId,
    });

    const updatedAt = nowIso();
    const patch: Record<string, unknown> = {
      updatedAt,
    };

    if (args.name !== undefined) {
      patch.name = args.name;
      patch.nameKey = toNameKey(args.name);
      patch.normalizedName = normalizeName(args.name);
    }
    if (args.description !== undefined) {
      patch.description = args.description ?? null;
    }
    if (args.price !== undefined) {
      patch.price = args.price ?? null;
      patch.priceKey = toPriceKey(args.price ?? null);
    }
    if (args.currency !== undefined) {
      patch.currency = args.currency ?? null;
      patch.currencyKey = toCurrencyKey(args.currency ?? null);
    }
    if (args.unit !== undefined) {
      patch.unit = args.unit ?? null;
    }
    if (args.taxRate !== undefined) {
      patch.taxRate = args.taxRate ?? null;
    }
    if (args.isActive !== undefined) {
      patch.isActive = args.isActive;
    }
    if (args.usageCount !== undefined) {
      patch.usageCount = args.usageCount;
    }
    if (args.lastUsedAt !== undefined) {
      patch.lastUsedAt = args.lastUsedAt ?? null;
    }

    await ctx.db.patch(record._id, patch);

    return serializeInvoiceProduct(args.publicTeamId, {
      ...record,
      name: args.name ?? record.name,
      description: args.description !== undefined ? (args.description ?? null) : record.description,
      price: args.price !== undefined ? (args.price ?? null) : record.price,
      currency: args.currency !== undefined ? (args.currency ?? null) : record.currency,
      unit: args.unit !== undefined ? (args.unit ?? null) : record.unit,
      taxRate: args.taxRate !== undefined ? (args.taxRate ?? null) : record.taxRate,
      isActive: args.isActive ?? record.isActive,
      usageCount: args.usageCount ?? record.usageCount,
      lastUsedAt: args.lastUsedAt !== undefined ? (args.lastUsedAt ?? null) : record.lastUsedAt,
      updatedAt,
    });
  },
});

export const serviceDeleteInvoiceProduct = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    invoiceProductId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const { record } = await getInvoiceProductRecordForTeam(
      ctx,
      args.publicTeamId,
      args.invoiceProductId,
    );

    if (!record) {
      return false;
    }

    await ctx.db.delete(record._id);
    return true;
  },
});

export const serviceIncrementInvoiceProductUsage = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    invoiceProductId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const { record } = await getInvoiceProductRecordForTeam(
      ctx,
      args.publicTeamId,
      args.invoiceProductId,
    );

    if (!record) {
      return { success: false };
    }

    const timestamp = nowIso();
    await ctx.db.patch(record._id, {
      usageCount: record.usageCount + 1,
      lastUsedAt: timestamp,
      updatedAt: timestamp,
    });

    return { success: true };
  },
});
