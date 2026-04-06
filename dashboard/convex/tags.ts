import { ConvexError, v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";
import { nowIso } from "../../packages/domain/src/identity";

type TagCtx = QueryCtx | MutationCtx;

function serializeTag(
  teamId: string,
  record: {
    _id: string;
    publicTagId?: string;
    name: string;
    createdAt: string;
  },
) {
  return {
    id: record.publicTagId ?? record._id,
    teamId,
    name: record.name,
    createdAt: record.createdAt,
  };
}

async function getTeamOrThrow(ctx: TagCtx, teamId: string) {
  const team = await getTeamByPublicTeamId(ctx, teamId);

  if (!team) {
    throw new ConvexError("Convex tag team not found");
  }

  return team;
}

async function getTagByExternalId(
  ctx: TagCtx,
  args: {
    teamId: string;
    tagId: string;
  },
) {
  const team = await getTeamByPublicTeamId(ctx, args.teamId);

  if (!team) {
    return { team: null, tag: null };
  }

  const tag = await ctx.db
    .query("tags")
    .withIndex("by_public_tag_id", (q) => q.eq("publicTagId", args.tagId))
    .unique();

  if (!tag || tag.teamId !== team._id) {
    return { team, tag: null };
  }

  return { team, tag };
}

export const serviceGetTags = query({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team) {
      return [];
    }

    const tags = await ctx.db
      .query("tags")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect();

    return tags
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((tag) => serializeTag(args.teamId, tag));
  },
});

export const serviceGetTagsByIds = query({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    tagIds: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.tagIds.length === 0) {
      return [];
    }

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team) {
      return [];
    }

    const tags = await Promise.all(
      [...new Set(args.tagIds)].map((tagId) =>
        ctx.db
          .query("tags")
          .withIndex("by_public_tag_id", (q) => q.eq("publicTagId", tagId))
          .unique(),
      ),
    );

    return tags
      .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag))
      .filter((tag) => tag.teamId === team._id)
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((tag) => serializeTag(args.teamId, tag));
  },
});

export const serviceGetTagById = query({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    tagId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const { tag } = await getTagByExternalId(ctx, args);

    if (!tag) {
      return null;
    }

    return serializeTag(args.teamId, tag);
  },
});

export const serviceCreateTag = mutation({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    name: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamOrThrow(ctx, args.teamId);
    const existing = await ctx.db
      .query("tags")
      .withIndex("by_team_and_name", (q) =>
        q.eq("teamId", team._id).eq("name", args.name),
      )
      .unique();

    if (existing) {
      throw new ConvexError("Tag already exists");
    }

    const timestamp = nowIso();
    const insertedId = await ctx.db.insert("tags", {
      publicTagId: crypto.randomUUID(),
      teamId: team._id,
      name: args.name,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError("Failed to create tag");
    }

    return serializeTag(args.teamId, inserted);
  },
});

export const serviceUpdateTag = mutation({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    tagId: v.string(),
    name: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const { team, tag } = await getTagByExternalId(ctx, args);

    if (!team || !tag) {
      throw new ConvexError("Tag not found");
    }

    const conflicting = await ctx.db
      .query("tags")
      .withIndex("by_team_and_name", (q) =>
        q.eq("teamId", team._id).eq("name", args.name),
      )
      .unique();

    if (conflicting && conflicting._id !== tag._id) {
      throw new ConvexError("Tag already exists");
    }

    await ctx.db.patch(tag._id, {
      name: args.name,
      updatedAt: nowIso(),
    });

    const updated = await ctx.db.get(tag._id);

    if (!updated) {
      throw new ConvexError("Failed to update tag");
    }

    return serializeTag(args.teamId, updated);
  },
});

export const serviceDeleteTag = mutation({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    tagId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const { tag } = await getTagByExternalId(ctx, args);

    if (!tag) {
      return null;
    }

    await ctx.db.delete(tag._id);

    return { id: args.tagId, name: tag.name };
  },
});
