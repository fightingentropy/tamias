import { ConvexError, v } from "convex/values";
import { nanoid } from "nanoid";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getAppUserById, getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";
import { nowIso } from "../../packages/domain/src/identity";

const reportType = v.union(
  v.literal("profit"),
  v.literal("revenue"),
  v.literal("burn_rate"),
  v.literal("expense"),
  v.literal("monthly_revenue"),
  v.literal("revenue_forecast"),
  v.literal("runway"),
  v.literal("category_expenses"),
);

async function generateUniqueLinkId(ctx: MutationCtx) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const linkId = nanoid(21);
    const existing = await ctx.db
      .query("reportLinks")
      .withIndex("by_link_id", (q) => q.eq("linkId", linkId))
      .unique();

    if (!existing) {
      return linkId;
    }
  }

  throw new ConvexError("Failed to generate a unique report link");
}

export const serviceCreateReportLink = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    userId: v.id("appUsers"),
    type: reportType,
    from: v.string(),
    to: v.string(),
    currency: v.optional(v.union(v.string(), v.null())),
    expireAt: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [team, appUser] = await Promise.all([
      getTeamByPublicTeamId(ctx, args.publicTeamId),
      getAppUserById(ctx, args.userId),
    ]);

    if (!team || !appUser) {
      throw new ConvexError("Convex report link target not found");
    }

    const timestamp = nowIso();
    const linkId = await generateUniqueLinkId(ctx);
    const insertedId = await ctx.db.insert("reportLinks", {
      publicReportId: crypto.randomUUID(),
      linkId,
      teamId: team._id,
      createdByAppUserId: appUser._id,
      type: args.type,
      from: args.from,
      to: args.to,
      currency: args.currency ?? undefined,
      expireAt: args.expireAt ?? undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError("Failed to create report link");
    }

    return {
      id: inserted.publicReportId ?? inserted._id,
      linkId: inserted.linkId,
      type: inserted.type,
      from: inserted.from,
      to: inserted.to,
      currency: inserted.currency ?? null,
      teamId: team.publicTeamId ?? team._id,
      createdAt: inserted.createdAt,
      expireAt: inserted.expireAt ?? null,
      teamName: team.name ?? null,
      teamLogoUrl: team.logoUrl ?? null,
    };
  },
});

export const serviceGetReportLinkByLinkId = query({
  args: {
    serviceKey: v.string(),
    linkId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const record = await ctx.db
      .query("reportLinks")
      .withIndex("by_link_id", (q) => q.eq("linkId", args.linkId))
      .unique();

    if (!record) {
      return null;
    }

    const team = await ctx.db.get(record.teamId);

    return {
      id: record.publicReportId ?? record._id,
      linkId: record.linkId,
      type: record.type,
      from: record.from,
      to: record.to,
      currency: record.currency ?? null,
      teamId: team?.publicTeamId ?? null,
      createdAt: record.createdAt,
      expireAt: record.expireAt ?? null,
      teamName: team?.name ?? null,
      teamLogoUrl: team?.logoUrl ?? null,
    };
  },
});
