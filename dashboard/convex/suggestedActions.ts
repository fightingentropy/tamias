import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAppUserById, getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";
import { nowIso } from "../../packages/domain/src/identity";

const SUGGESTED_ACTION_USAGE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const serviceGetSuggestedActionUsage = query({
  args: {
    serviceKey: v.string(),
    userId: v.id("appUsers"),
    teamId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [appUser, team] = await Promise.all([
      getAppUserById(ctx, args.userId),
      getTeamByPublicTeamId(ctx, args.teamId),
    ]);

    if (!appUser || !team) {
      return {};
    }

    const cutoff = Date.now() - SUGGESTED_ACTION_USAGE_WINDOW_MS;
    const rows = await ctx.db
      .query("suggestedActionUsage")
      .withIndex("by_app_user_and_team", (q) =>
        q.eq("appUserId", appUser._id).eq("teamId", team._id),
      )
      .collect();

    return Object.fromEntries(
      rows
        .filter((row) => Date.parse(row.lastUsedAt) >= cutoff)
        .map((row) => [
          row.actionId,
          {
            actionId: row.actionId,
            count: row.count,
            lastUsed: row.lastUsedAt,
          },
        ]),
    );
  },
});

export const serviceIncrementSuggestedActionUsage = mutation({
  args: {
    serviceKey: v.string(),
    userId: v.id("appUsers"),
    teamId: v.string(),
    actionId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [appUser, team] = await Promise.all([
      getAppUserById(ctx, args.userId),
      getTeamByPublicTeamId(ctx, args.teamId),
    ]);

    if (!appUser || !team) {
      throw new Error("Convex suggested action usage target not found");
    }

    const now = nowIso();
    const cutoff = Date.now() - SUGGESTED_ACTION_USAGE_WINDOW_MS;
    const existing = await ctx.db
      .query("suggestedActionUsage")
      .withIndex("by_app_user_team_action", (q) =>
        q
          .eq("appUserId", appUser._id)
          .eq("teamId", team._id)
          .eq("actionId", args.actionId),
      )
      .unique();

    const nextCount =
      existing && Date.parse(existing.lastUsedAt) >= cutoff
        ? existing.count + 1
        : 1;

    if (existing) {
      await ctx.db.patch(existing._id, {
        count: nextCount,
        lastUsedAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("suggestedActionUsage", {
        appUserId: appUser._id,
        teamId: team._id,
        actionId: args.actionId,
        count: nextCount,
        lastUsedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { success: true };
  },
});
