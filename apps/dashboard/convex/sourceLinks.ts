import { ConvexError, v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";
import { nowIso } from "../../../packages/domain/src/identity";

type SourceLinkType =
  | "transaction"
  | "invoice"
  | "invoice_refund"
  | "inbox"
  | "manual_adjustment"
  | "payroll_import";

type SourceLinkCtx = QueryCtx | MutationCtx;

function serializeSourceLink(
  publicTeamId: string,
  record: {
    _id: string;
    publicSourceLinkId?: string;
    sourceType: SourceLinkType;
    sourceId: string;
    journalEntryId: string;
    meta?: unknown;
    createdAt: string;
    updatedAt: string;
  },
) {
  return {
    id: record.publicSourceLinkId ?? record._id,
    teamId: publicTeamId,
    sourceType: record.sourceType,
    sourceId: record.sourceId,
    journalEntryId: record.journalEntryId,
    meta: (record.meta ?? null) as Record<string, unknown> | null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

async function getTeamOrThrow(
  ctx: SourceLinkCtx,
  publicTeamId: string,
) {
  const team = await getTeamByPublicTeamId(ctx, publicTeamId);

  if (!team) {
    throw new ConvexError("Convex source link team not found");
  }

  return team;
}

export const serviceGetSourceLinksBySourceTypes = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    sourceTypes: v.array(
      v.union(
        v.literal("transaction"),
        v.literal("invoice"),
        v.literal("invoice_refund"),
        v.literal("inbox"),
        v.literal("manual_adjustment"),
        v.literal("payroll_import"),
      ),
    ),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.sourceTypes.length === 0) {
      return [];
    }

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const records = await Promise.all(
      [...new Set(args.sourceTypes)].map((sourceType) =>
        ctx.db
          .query("sourceLinks")
          .withIndex("by_team_and_source_type", (q) =>
            q.eq("teamId", team._id).eq("sourceType", sourceType),
          )
          .collect(),
      ),
    );

    return records
      .flat()
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map((record) => serializeSourceLink(args.publicTeamId, record));
  },
});

export const serviceCountSourceLinksBySourceTypes = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    sourceTypes: v.array(
      v.union(
        v.literal("transaction"),
        v.literal("invoice"),
        v.literal("invoice_refund"),
        v.literal("inbox"),
        v.literal("manual_adjustment"),
        v.literal("payroll_import"),
      ),
    ),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.sourceTypes.length === 0) {
      return 0;
    }

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return 0;
    }

    const counts = await Promise.all(
      [...new Set(args.sourceTypes)].map(async (sourceType) => {
        const records = await ctx.db
          .query("sourceLinks")
          .withIndex("by_team_and_source_type", (q) =>
            q.eq("teamId", team._id).eq("sourceType", sourceType),
          )
          .collect();

        return records.length;
      }),
    );

    return counts.reduce((total, count) => total + count, 0);
  },
});

export const serviceUpsertSourceLink = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    sourceType: v.union(
      v.literal("transaction"),
      v.literal("invoice"),
      v.literal("invoice_refund"),
      v.literal("inbox"),
      v.literal("manual_adjustment"),
      v.literal("payroll_import"),
    ),
    sourceId: v.string(),
    journalEntryId: v.string(),
    meta: v.optional(v.any()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamOrThrow(ctx, args.publicTeamId);
    const existing = await ctx.db
      .query("sourceLinks")
      .withIndex("by_team_source_type_source_id", (q) =>
        q
          .eq("teamId", team._id)
          .eq("sourceType", args.sourceType)
          .eq("sourceId", args.sourceId),
      )
      .unique();
    const timestamp = nowIso();

    if (existing) {
      await ctx.db.patch(existing._id, {
        journalEntryId: args.journalEntryId,
        meta: args.meta,
        updatedAt: timestamp,
      });

      const updated = await ctx.db.get(existing._id);

      if (!updated) {
        throw new ConvexError("Failed to update source link");
      }

      return serializeSourceLink(args.publicTeamId, updated);
    }

    const insertedId = await ctx.db.insert("sourceLinks", {
      publicSourceLinkId: crypto.randomUUID(),
      teamId: team._id,
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      journalEntryId: args.journalEntryId,
      meta: args.meta,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError("Failed to create source link");
    }

    return serializeSourceLink(args.publicTeamId, inserted);
  },
});

export const serviceDeleteSourceLinksByIds = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    sourceLinkIds: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.sourceLinkIds.length === 0) {
      return { sourceLinkIds: [] };
    }

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return { sourceLinkIds: [...new Set(args.sourceLinkIds)] };
    }

    for (const sourceLinkId of [...new Set(args.sourceLinkIds)]) {
      const record = await ctx.db
        .query("sourceLinks")
        .withIndex("by_public_source_link_id", (q) =>
          q.eq("publicSourceLinkId", sourceLinkId),
        )
        .unique();

      if (!record || record.teamId !== team._id) {
        continue;
      }

      await ctx.db.delete(record._id);
    }

    return { sourceLinkIds: [...new Set(args.sourceLinkIds)] };
  },
});
