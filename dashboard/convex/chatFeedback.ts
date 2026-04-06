import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getAppUserById, getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";
import { nowIso } from "../../packages/domain/src/identity";

export const serviceUpsertChatFeedback = mutation({
  args: {
    serviceKey: v.string(),
    chatId: v.string(),
    messageId: v.string(),
    userId: v.id("appUsers"),
    teamId: v.string(),
    type: v.union(
      v.literal("positive"),
      v.literal("negative"),
      v.literal("other"),
    ),
    comment: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [appUser, team] = await Promise.all([
      getAppUserById(ctx, args.userId),
      getTeamByPublicTeamId(ctx, args.teamId),
    ]);

    if (!appUser || !team) {
      throw new Error("Convex chat feedback target not found");
    }

    const timestamp = nowIso();
    const existing = await ctx.db
      .query("chatFeedback")
      .withIndex("by_chat_message_user", (q) =>
        q
          .eq("chatId", args.chatId)
          .eq("messageId", args.messageId)
          .eq("appUserId", appUser._id),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        teamId: team._id,
        type: args.type,
        comment: args.comment ?? undefined,
        updatedAt: timestamp,
      });
    } else {
      await ctx.db.insert("chatFeedback", {
        chatId: args.chatId,
        messageId: args.messageId,
        appUserId: appUser._id,
        teamId: team._id,
        type: args.type,
        comment: args.comment ?? undefined,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    return { success: true };
  },
});

export const serviceDeleteChatFeedback = mutation({
  args: {
    serviceKey: v.string(),
    chatId: v.string(),
    messageId: v.string(),
    userId: v.id("appUsers"),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const appUser = await getAppUserById(ctx, args.userId);

    if (!appUser) {
      throw new Error("Convex chat feedback user not found");
    }

    const existing = await ctx.db
      .query("chatFeedback")
      .withIndex("by_chat_message_user", (q) =>
        q
          .eq("chatId", args.chatId)
          .eq("messageId", args.messageId)
          .eq("appUserId", appUser._id),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return { success: true };
  },
});
