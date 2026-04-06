import { v } from "convex/values";
import { nowIso } from "../../../packages/domain/src/identity";
import {
  buildWidgetPreferencesFromPrimaryWidgets,
  DEFAULT_WIDGET_PREFERENCES,
  normalizeWidgetPreferences,
  validateWidgetPreferences,
  type WidgetType,
} from "../../../packages/domain/src/index";
import { mutation, query } from "./_generated/server";
import {
  getAppUserById,
  getTeamByPublicTeamId,
  requireCurrentAppUser,
  resolveCurrentTeam,
} from "./lib/identity";
import { requireServiceKey } from "./lib/service";

export const myWidgetPreferences = query({
  args: {},
  async handler(ctx) {
    const appUser = await requireCurrentAppUser(ctx).catch(() => null);

    if (!appUser) {
      return DEFAULT_WIDGET_PREFERENCES;
    }

    const team = await resolveCurrentTeam(ctx, appUser);

    if (!team) {
      return DEFAULT_WIDGET_PREFERENCES;
    }

    const record = await ctx.db
      .query("widgetPreferences")
      .withIndex("by_app_user_and_team", (q) =>
        q.eq("appUserId", appUser._id).eq("teamId", team._id),
      )
      .unique();

    if (!record) {
      return DEFAULT_WIDGET_PREFERENCES;
    }

    return normalizeWidgetPreferences({
      primaryWidgets: record.primaryWidgets,
      availableWidgets: record.availableWidgets,
    });
  },
});

export const serviceGetWidgetPreferences = query({
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
      return DEFAULT_WIDGET_PREFERENCES;
    }

    const record = await ctx.db
      .query("widgetPreferences")
      .withIndex("by_app_user_and_team", (q) =>
        q.eq("appUserId", appUser._id).eq("teamId", team._id),
      )
      .unique();

    if (!record) {
      return DEFAULT_WIDGET_PREFERENCES;
    }

    const normalized = normalizeWidgetPreferences({
      primaryWidgets: record.primaryWidgets,
      availableWidgets: record.availableWidgets,
    });

    return normalized;
  },
});

export const serviceUpdateWidgetPreferences = mutation({
  args: {
    serviceKey: v.string(),
    userId: v.id("appUsers"),
    teamId: v.string(),
    primaryWidgets: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [appUser, team] = await Promise.all([
      getAppUserById(ctx, args.userId),
      getTeamByPublicTeamId(ctx, args.teamId),
    ]);

    if (!appUser || !team) {
      throw new Error("Convex widget preferences target not found");
    }

    const preferences = buildWidgetPreferencesFromPrimaryWidgets(
      args.primaryWidgets as WidgetType[],
    );

    validateWidgetPreferences(preferences);

    const timestamp = nowIso();
    const existing = await ctx.db
      .query("widgetPreferences")
      .withIndex("by_app_user_and_team", (q) =>
        q.eq("appUserId", appUser._id).eq("teamId", team._id),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        primaryWidgets: preferences.primaryWidgets,
        availableWidgets: preferences.availableWidgets,
        updatedAt: timestamp,
      });
    } else {
      await ctx.db.insert("widgetPreferences", {
        appUserId: appUser._id,
        teamId: team._id,
        primaryWidgets: preferences.primaryWidgets,
        availableWidgets: preferences.availableWidgets,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    return preferences;
  },
});
