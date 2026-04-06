import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";
import { nowIso } from "../../packages/domain/src/identity";

type InboxBlocklistType = "email" | "domain";

function normalizeBlocklistValue(value: string) {
  return value.trim().toLowerCase();
}

function serializeInboxBlocklistEntry(
  publicTeamId: string,
  record: {
    _id: string;
    publicInboxBlocklistId?: string;
    type: InboxBlocklistType;
    value: string;
    createdAt: string;
  },
) {
  return {
    id: record.publicInboxBlocklistId ?? record._id,
    teamId: publicTeamId,
    type: record.type,
    value: record.value,
    createdAt: record.createdAt,
  };
}

export const serviceGetInboxBlocklist = query({
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

    const records = await ctx.db
      .query("inboxBlocklist")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect();

    return records
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((record) =>
        serializeInboxBlocklistEntry(args.publicTeamId, {
          _id: record._id,
          publicInboxBlocklistId: record.publicInboxBlocklistId,
          type: record.type,
          value: record.value,
          createdAt: record.createdAt,
        }),
      );
  },
});

export const serviceCreateInboxBlocklist = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    type: v.union(v.literal("email"), v.literal("domain")),
    value: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      throw new ConvexError("Convex inbox blocklist team not found");
    }

    const value = args.value.trim();
    const normalizedValue = normalizeBlocklistValue(args.value);

    if (!normalizedValue) {
      throw new ConvexError("Inbox blocklist value is required");
    }

    const existing = await ctx.db
      .query("inboxBlocklist")
      .withIndex("by_team_type_value", (q) =>
        q
          .eq("teamId", team._id)
          .eq("type", args.type)
          .eq("normalizedValue", normalizedValue),
      )
      .unique();

    if (existing) {
      return serializeInboxBlocklistEntry(args.publicTeamId, {
        _id: existing._id,
        publicInboxBlocklistId: existing.publicInboxBlocklistId,
        type: existing.type,
        value: existing.value,
        createdAt: existing.createdAt,
      });
    }

    const timestamp = nowIso();
    const insertedId = await ctx.db.insert("inboxBlocklist", {
      publicInboxBlocklistId: crypto.randomUUID(),
      teamId: team._id,
      type: args.type,
      value,
      normalizedValue,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError("Failed to create inbox blocklist entry");
    }

    return serializeInboxBlocklistEntry(args.publicTeamId, {
      _id: inserted._id,
      publicInboxBlocklistId: inserted.publicInboxBlocklistId,
      type: inserted.type,
      value: inserted.value,
      createdAt: inserted.createdAt,
    });
  },
});

export const serviceDeleteInboxBlocklist = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    inboxBlocklistId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return null;
    }

    const existing = await ctx.db
      .query("inboxBlocklist")
      .withIndex("by_public_inbox_blocklist_id", (q) =>
        q.eq("publicInboxBlocklistId", args.inboxBlocklistId),
      )
      .unique();

    if (!existing || existing.teamId !== team._id) {
      return null;
    }

    const serialized = serializeInboxBlocklistEntry(args.publicTeamId, {
      _id: existing._id,
      publicInboxBlocklistId: existing.publicInboxBlocklistId,
      type: existing.type,
      value: existing.value,
      createdAt: existing.createdAt,
    });

    await ctx.db.delete(existing._id);

    return serialized;
  },
});
