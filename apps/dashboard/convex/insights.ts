import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAppUserById } from "./lib/identity";
import { requireServiceKey } from "./lib/service";
import { nowIso } from "../../../packages/domain/src/identity";

export const serviceGetInsightUserStatuses = query({
  args: {
    serviceKey: v.string(),
    userId: v.id("appUsers"),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const appUser = await getAppUserById(ctx, args.userId);

    if (!appUser) {
      return [];
    }

    const records = await ctx.db
      .query("insightUserStatuses")
      .withIndex("by_app_user_id", (q) => q.eq("appUserId", appUser._id))
      .collect();

    return records.map((record) => ({
      insightId: record.insightId,
      userId: args.userId,
      readAt: record.readAt ?? null,
      dismissedAt: record.dismissedAt ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }));
  },
});

export const serviceMarkInsightAsRead = mutation({
  args: {
    serviceKey: v.string(),
    userId: v.id("appUsers"),
    insightId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const appUser = await getAppUserById(ctx, args.userId);

    if (!appUser) {
      throw new Error("Convex insight status user not found");
    }

    const timestamp = nowIso();
    const existing = await ctx.db
      .query("insightUserStatuses")
      .withIndex("by_app_user_insight", (q) =>
        q.eq("appUserId", appUser._id).eq("insightId", args.insightId),
      )
      .unique();

    if (existing) {
      const readAt = existing.readAt ?? timestamp;

      await ctx.db.patch(existing._id, {
        readAt,
        updatedAt: timestamp,
      });

      return {
        insightId: existing.insightId,
        userId: args.userId,
        readAt,
        dismissedAt: existing.dismissedAt ?? null,
        createdAt: existing.createdAt,
        updatedAt: timestamp,
      };
    }

    await ctx.db.insert("insightUserStatuses", {
      appUserId: appUser._id,
      insightId: args.insightId,
      readAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return {
      insightId: args.insightId,
      userId: args.userId,
      readAt: timestamp,
      dismissedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  },
});

export const serviceDismissInsight = mutation({
  args: {
    serviceKey: v.string(),
    userId: v.id("appUsers"),
    insightId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const appUser = await getAppUserById(ctx, args.userId);

    if (!appUser) {
      throw new Error("Convex insight status user not found");
    }

    const timestamp = nowIso();
    const existing = await ctx.db
      .query("insightUserStatuses")
      .withIndex("by_app_user_insight", (q) =>
        q.eq("appUserId", appUser._id).eq("insightId", args.insightId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        dismissedAt: timestamp,
        updatedAt: timestamp,
      });

      return {
        insightId: existing.insightId,
        userId: args.userId,
        readAt: existing.readAt ?? null,
        dismissedAt: timestamp,
        createdAt: existing.createdAt,
        updatedAt: timestamp,
      };
    }

    await ctx.db.insert("insightUserStatuses", {
      appUserId: appUser._id,
      insightId: args.insightId,
      dismissedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return {
      insightId: args.insightId,
      userId: args.userId,
      readAt: null,
      dismissedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  },
});

export const serviceUndoDismissInsight = mutation({
  args: {
    serviceKey: v.string(),
    userId: v.id("appUsers"),
    insightId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const appUser = await getAppUserById(ctx, args.userId);

    if (!appUser) {
      throw new Error("Convex insight status user not found");
    }

    const existing = await ctx.db
      .query("insightUserStatuses")
      .withIndex("by_app_user_insight", (q) =>
        q.eq("appUserId", appUser._id).eq("insightId", args.insightId),
      )
      .unique();

    if (!existing) {
      return null;
    }

    const timestamp = nowIso();
    await ctx.db.patch(existing._id, {
      dismissedAt: undefined,
      updatedAt: timestamp,
    });

    return {
      insightId: existing.insightId,
      userId: args.userId,
      readAt: existing.readAt ?? null,
      dismissedAt: null,
      createdAt: existing.createdAt,
      updatedAt: timestamp,
    };
  },
});
