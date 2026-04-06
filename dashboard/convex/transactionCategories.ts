import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { rebuildDerivedComplianceJournalEntriesForTeam } from "./complianceLedger";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";
import { nowIso } from "../../packages/domain/src/identity";

type TransactionCategoryCtx = QueryCtx | MutationCtx;

type TransactionCategoryRecord = Doc<"transactionCategories">;

function slugifyCategoryName(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "category"
  );
}

function serializeTransactionCategory(
  publicTeamId: string,
  record: TransactionCategoryRecord,
) {
  return {
    id: record.publicTransactionCategoryId ?? record._id,
    teamId: publicTeamId,
    name: record.name,
    color: record.color ?? null,
    slug: record.slug,
    description: record.description ?? null,
    system: record.system,
    taxRate: record.taxRate ?? null,
    taxType: record.taxType ?? null,
    taxReportingCode: record.taxReportingCode ?? null,
    excluded: record.excluded ?? false,
    parentId: record.parentId ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

async function getTeamOrThrow(
  ctx: TransactionCategoryCtx,
  publicTeamId: string,
) {
  const team = await getTeamByPublicTeamId(ctx, publicTeamId);

  if (!team) {
    throw new ConvexError("Convex transaction category team not found");
  }

  return team;
}

async function getCategoryByExternalId(
  ctx: TransactionCategoryCtx,
  teamId: Id<"teams">,
  categoryId: string,
) {
  const category = await ctx.db
    .query("transactionCategories")
    .withIndex("by_public_transaction_category_id", (q) =>
      q.eq("publicTransactionCategoryId", categoryId),
    )
    .unique();

  if (!category || category.teamId !== teamId) {
    return null;
  }

  return category;
}

async function findUniqueSlug(
  ctx: MutationCtx,
  args: {
    teamId: Id<"teams">;
    baseSlug: string;
    excludeCategoryId?: Id<"transactionCategories">;
  },
) {
  let slug = args.baseSlug || "category";
  let counter = 1;

  while (true) {
    const existing = await ctx.db
      .query("transactionCategories")
      .withIndex("by_team_and_slug", (q) =>
        q.eq("teamId", args.teamId).eq("slug", slug),
      )
      .unique();

    if (!existing || existing._id === args.excludeCategoryId) {
      return slug;
    }

    slug = `${args.baseSlug}-${counter}`;
    counter += 1;
  }
}

async function upsertTransactionCategoryRecord(
  ctx: MutationCtx,
  args: {
    publicTeamId: string;
    teamId: Id<"teams">;
    id?: string;
    name: string;
    slug?: string;
    color?: string | null;
    description?: string | null;
    system?: boolean;
    taxRate?: number | null;
    taxType?: string | null;
    taxReportingCode?: string | null;
    excluded?: boolean | null;
    parentId?: string | null;
  },
) {
  const existing =
    (args.id
      ? await getCategoryByExternalId(ctx, args.teamId, args.id)
      : null) ??
    (args.slug
      ? await ctx.db
          .query("transactionCategories")
          .withIndex("by_team_and_slug", (q) =>
            q.eq("teamId", args.teamId).eq("slug", args.slug!),
          )
          .unique()
      : null);

  const parent =
    args.parentId !== undefined && args.parentId !== null
      ? await getCategoryByExternalId(ctx, args.teamId, args.parentId)
      : null;

  if (args.parentId && !parent) {
    throw new ConvexError("Parent transaction category not found");
  }

  const timestamp = nowIso();

  if (existing) {
    const nextSlug =
      args.slug === undefined
        ? existing.slug
        : await findUniqueSlug(ctx, {
            teamId: args.teamId,
            baseSlug: slugifyCategoryName(args.slug),
            excludeCategoryId: existing._id,
          });

    await ctx.db.patch(existing._id, {
      name: args.name,
      slug: nextSlug,
      color: args.color ?? undefined,
      description: args.description ?? undefined,
      system: args.system ?? existing.system,
      taxRate: args.taxRate ?? undefined,
      taxType: args.taxType ?? undefined,
      taxReportingCode: args.taxReportingCode ?? undefined,
      excluded: args.excluded ?? undefined,
      parentId: parent
        ? (parent.publicTransactionCategoryId ?? parent._id)
        : undefined,
      updatedAt: timestamp,
    });

    const updated = await ctx.db.get(existing._id);

    if (!updated) {
      throw new ConvexError("Failed to update transaction category");
    }

    return serializeTransactionCategory(args.publicTeamId, updated);
  }

  const slug = await findUniqueSlug(ctx, {
    teamId: args.teamId,
    baseSlug: slugifyCategoryName(args.slug ?? args.name),
  });

  const insertedId = await ctx.db.insert("transactionCategories", {
    publicTransactionCategoryId: args.id ?? crypto.randomUUID(),
    teamId: args.teamId,
    name: args.name,
    color: args.color ?? undefined,
    slug,
    description: args.description ?? undefined,
    system: args.system ?? false,
    taxRate: args.taxRate ?? undefined,
    taxType: args.taxType ?? undefined,
    taxReportingCode: args.taxReportingCode ?? undefined,
    excluded: args.excluded ?? undefined,
    parentId: parent
      ? (parent.publicTransactionCategoryId ?? parent._id)
      : undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const inserted = await ctx.db.get(insertedId);

  if (!inserted) {
    throw new ConvexError("Failed to create transaction category");
  }

  return serializeTransactionCategory(args.publicTeamId, inserted);
}

export const serviceListTransactionCategories = query({
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

    const categories = await ctx.db
      .query("transactionCategories")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect();

    return categories
      .sort(
        (a, b) =>
          Number(b.system) - Number(a.system) || a.name.localeCompare(b.name),
      )
      .map((category) =>
        serializeTransactionCategory(args.publicTeamId, category),
      );
  },
});

export const serviceGetTransactionCategoryById = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    categoryId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return null;
    }

    const category = await getCategoryByExternalId(
      ctx,
      team._id,
      args.categoryId,
    );

    if (!category) {
      return null;
    }

    return serializeTransactionCategory(args.publicTeamId, category);
  },
});

export const serviceCreateTransactionCategory = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    id: v.optional(v.string()),
    name: v.string(),
    color: v.optional(v.union(v.string(), v.null())),
    description: v.optional(v.union(v.string(), v.null())),
    taxRate: v.optional(v.union(v.number(), v.null())),
    taxType: v.optional(v.union(v.string(), v.null())),
    taxReportingCode: v.optional(v.union(v.string(), v.null())),
    parentId: v.optional(v.union(v.string(), v.null())),
    system: v.optional(v.boolean()),
    excluded: v.optional(v.union(v.boolean(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamOrThrow(ctx, args.publicTeamId);

    const result = await upsertTransactionCategoryRecord(ctx, {
      publicTeamId: args.publicTeamId,
      teamId: team._id,
      id: args.id,
      name: args.name,
      color: args.color,
      description: args.description,
      taxRate: args.taxRate,
      taxType: args.taxType,
      taxReportingCode: args.taxReportingCode,
      parentId: args.parentId,
      system: args.system,
      excluded: args.excluded,
    });

    await rebuildDerivedComplianceJournalEntriesForTeam(ctx, team);

    return result;
  },
});

export const serviceUpdateTransactionCategory = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    id: v.string(),
    name: v.optional(v.string()),
    color: v.optional(v.union(v.string(), v.null())),
    description: v.optional(v.union(v.string(), v.null())),
    taxRate: v.optional(v.union(v.number(), v.null())),
    taxType: v.optional(v.union(v.string(), v.null())),
    taxReportingCode: v.optional(v.union(v.string(), v.null())),
    parentId: v.optional(v.union(v.string(), v.null())),
    excluded: v.optional(v.union(v.boolean(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamOrThrow(ctx, args.publicTeamId);
    const category = await getCategoryByExternalId(ctx, team._id, args.id);

    if (!category) {
      throw new ConvexError("Transaction category not found");
    }

    if (args.parentId !== undefined) {
      const children = await ctx.db
        .query("transactionCategories")
        .withIndex("by_team_and_parent", (q) =>
          q
            .eq("teamId", team._id)
            .eq(
              "parentId",
              category.publicTransactionCategoryId ?? category._id,
            ),
        )
        .collect();

      if (children.length > 0) {
        throw new ConvexError(
          "Cannot change parent of a category that has children",
        );
      }
    }

    const result = await upsertTransactionCategoryRecord(ctx, {
      publicTeamId: args.publicTeamId,
      teamId: team._id,
      id: args.id,
      name: args.name ?? category.name,
      slug: category.slug,
      color: args.color !== undefined ? args.color : (category.color ?? null),
      description:
        args.description !== undefined
          ? args.description
          : (category.description ?? null),
      taxRate:
        args.taxRate !== undefined ? args.taxRate : (category.taxRate ?? null),
      taxType:
        args.taxType !== undefined ? args.taxType : (category.taxType ?? null),
      taxReportingCode:
        args.taxReportingCode !== undefined
          ? args.taxReportingCode
          : (category.taxReportingCode ?? null),
      parentId:
        args.parentId !== undefined
          ? args.parentId
          : (category.parentId ?? null),
      system: category.system,
      excluded:
        args.excluded !== undefined
          ? args.excluded
          : (category.excluded ?? false),
    });

    await rebuildDerivedComplianceJournalEntriesForTeam(ctx, team);

    return result;
  },
});

export const serviceDeleteTransactionCategory = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    id: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return null;
    }

    const category = await getCategoryByExternalId(ctx, team._id, args.id);

    if (!category || category.system) {
      return null;
    }

    const publicId = category.publicTransactionCategoryId ?? category._id;
    const children = await ctx.db
      .query("transactionCategories")
      .withIndex("by_team_and_parent", (q) =>
        q.eq("teamId", team._id).eq("parentId", publicId),
      )
      .collect();

    for (const child of children) {
      await ctx.db.patch(child._id, {
        parentId: undefined,
        updatedAt: nowIso(),
      });
    }

    await ctx.db.delete(category._id);
    await rebuildDerivedComplianceJournalEntriesForTeam(ctx, team);

    return { id: publicId };
  },
});

export const serviceUpsertTransactionCategories = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    categories: v.array(
      v.object({
        id: v.optional(v.string()),
        name: v.string(),
        slug: v.optional(v.string()),
        color: v.optional(v.union(v.string(), v.null())),
        description: v.optional(v.union(v.string(), v.null())),
        system: v.optional(v.boolean()),
        taxRate: v.optional(v.union(v.number(), v.null())),
        taxType: v.optional(v.union(v.string(), v.null())),
        taxReportingCode: v.optional(v.union(v.string(), v.null())),
        excluded: v.optional(v.union(v.boolean(), v.null())),
        parentId: v.optional(v.union(v.string(), v.null())),
      }),
    ),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.categories.length === 0) {
      return [];
    }

    const team = await getTeamOrThrow(ctx, args.publicTeamId);
    const results = [];

    for (const category of args.categories) {
      results.push(
        await upsertTransactionCategoryRecord(ctx, {
          publicTeamId: args.publicTeamId,
          teamId: team._id,
          ...category,
        }),
      );
    }

    await rebuildDerivedComplianceJournalEntriesForTeam(ctx, team);

    return results;
  },
});
