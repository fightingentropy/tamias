import { ConvexError, v } from "convex/values";
import { nanoid } from "nanoid";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getAppUserById, getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";
import { nowIso } from "../../packages/domain/src/identity";

async function generateUniqueShortId(ctx: MutationCtx) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const shortId = nanoid(21);
    const existing = await ctx.db
      .query("shortLinks")
      .withIndex("by_short_id", (q) => q.eq("shortId", shortId))
      .unique();

    if (!existing) {
      return shortId;
    }
  }

  throw new ConvexError("Failed to generate a unique short link");
}

export const serviceGetShortLinkByShortId = query({
  args: {
    serviceKey: v.string(),
    shortId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const record = await ctx.db
      .query("shortLinks")
      .withIndex("by_short_id", (q) => q.eq("shortId", args.shortId))
      .unique();

    if (!record) {
      return null;
    }

    const [team, appUser] = await Promise.all([
      ctx.db.get(record.teamId),
      ctx.db.get(record.appUserId),
    ]);

    return {
      id: record.publicShortLinkId ?? record._id,
      shortId: record.shortId,
      url: record.url,
      teamId: team?.publicTeamId ?? null,
      userId: appUser?._id ?? null,
      createdAt: record.createdAt,
      fileName: record.fileName ?? null,
      teamName: team?.name ?? null,
      type: record.type ?? null,
      size: record.size ?? null,
      mimeType: record.mimeType ?? null,
      expiresAt: record.expiresAt ?? null,
    };
  },
});

export const serviceCreateShortLink = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    userId: v.id("appUsers"),
    url: v.string(),
    type: v.union(v.literal("redirect"), v.literal("download")),
    fileName: v.optional(v.union(v.string(), v.null())),
    mimeType: v.optional(v.union(v.string(), v.null())),
    size: v.optional(v.union(v.number(), v.null())),
    expiresAt: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [team, appUser] = await Promise.all([
      getTeamByPublicTeamId(ctx, args.publicTeamId),
      getAppUserById(ctx, args.userId),
    ]);

    if (!team || !appUser) {
      throw new ConvexError("Convex short link target not found");
    }

    const timestamp = nowIso();
    const shortId = await generateUniqueShortId(ctx);
    const insertedId = await ctx.db.insert("shortLinks", {
      publicShortLinkId: crypto.randomUUID(),
      shortId,
      url: args.url,
      type: args.type,
      size: args.size ?? undefined,
      mimeType: args.mimeType ?? undefined,
      fileName: args.fileName ?? undefined,
      teamId: team._id,
      appUserId: appUser._id,
      expiresAt: args.expiresAt ?? undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError("Failed to create short link");
    }

    return {
      id: inserted.publicShortLinkId ?? inserted._id,
      shortId: inserted.shortId,
      url: inserted.url,
      type: inserted.type ?? null,
      fileName: inserted.fileName ?? null,
      mimeType: inserted.mimeType ?? null,
      size: inserted.size ?? null,
      createdAt: inserted.createdAt,
      expiresAt: inserted.expiresAt ?? null,
    };
  },
});
