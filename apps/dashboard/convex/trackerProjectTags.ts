import { ConvexError, v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";
import { nowIso } from "../../../packages/domain/src/identity";

type TrackerProjectTagCtx = QueryCtx | MutationCtx;

function serializeTrackerProjectTagAssignment(
  teamId: string,
  assignment: {
    trackerProjectId: string;
    tagId: string;
    createdAt: string;
    updatedAt: string;
  },
) {
  return {
    trackerProjectId: assignment.trackerProjectId,
    tagId: assignment.tagId,
    teamId,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
  };
}

async function getTeamOrThrow(ctx: TrackerProjectTagCtx, teamId: string) {
  const team = await getTeamByPublicTeamId(ctx, teamId);

  if (!team) {
    throw new ConvexError("Convex tracker project tag team not found");
  }

  return team;
}

async function listAssignmentsForProject(
  ctx: TrackerProjectTagCtx,
  args: {
    teamId: string;
    trackerProjectId: string;
  },
) {
  const team = await getTeamByPublicTeamId(ctx, args.teamId);

  if (!team) {
    return [];
  }

  return ctx.db
    .query("trackerProjectTags")
    .withIndex("by_team_and_project", (q) =>
      q.eq("teamId", team._id).eq("trackerProjectId", args.trackerProjectId),
    )
    .collect();
}

export const serviceGetTrackerProjectTagAssignmentsForProjectIds = query({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    trackerProjectIds: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.trackerProjectIds.length === 0) {
      return [];
    }

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team) {
      return [];
    }

    const assignments = await Promise.all(
      [...new Set(args.trackerProjectIds)].map((trackerProjectId) =>
        ctx.db
          .query("trackerProjectTags")
          .withIndex("by_team_and_project", (q) =>
            q.eq("teamId", team._id).eq("trackerProjectId", trackerProjectId),
          )
          .collect(),
      ),
    );

    return assignments
      .flat()
      .map((assignment) =>
        serializeTrackerProjectTagAssignment(args.teamId, assignment),
      );
  },
});

export const serviceGetTrackerProjectIdsForTagIds = query({
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

    const assignments = await Promise.all(
      [...new Set(args.tagIds)].map((tagId) =>
        ctx.db
          .query("trackerProjectTags")
          .withIndex("by_team_and_tag", (q) =>
            q.eq("teamId", team._id).eq("tagId", tagId),
          )
          .collect(),
      ),
    );

    return [...new Set(assignments.flat().map((assignment) => assignment.trackerProjectId))];
  },
});

export const serviceReplaceTrackerProjectTags = mutation({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    trackerProjectId: v.string(),
    tagIds: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamOrThrow(ctx, args.teamId);
    const currentAssignments = await listAssignmentsForProject(ctx, args);
    const currentTagIds = new Set(currentAssignments.map((assignment) => assignment.tagId));
    const nextTagIds = [...new Set(args.tagIds)];
    const nextTagIdSet = new Set(nextTagIds);
    const timestamp = nowIso();

    for (const assignment of currentAssignments) {
      if (!nextTagIdSet.has(assignment.tagId)) {
        await ctx.db.delete(assignment._id);
      }
    }

    for (const tagId of nextTagIds) {
      if (currentTagIds.has(tagId)) {
        continue;
      }

      await ctx.db.insert("trackerProjectTags", {
        teamId: team._id,
        trackerProjectId: args.trackerProjectId,
        tagId,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    const assignments = await listAssignmentsForProject(ctx, args);

    return assignments.map((assignment) =>
      serializeTrackerProjectTagAssignment(args.teamId, assignment),
    );
  },
});

export const serviceDeleteTrackerProjectTagsForProject = mutation({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    trackerProjectId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const assignments = await listAssignmentsForProject(ctx, args);

    for (const assignment of assignments) {
      await ctx.db.delete(assignment._id);
    }

    return { trackerProjectId: args.trackerProjectId };
  },
});

export const serviceDeleteTrackerProjectTagsForTag = mutation({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    tagId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team) {
      return { tagId: args.tagId };
    }

    const assignments = await ctx.db
      .query("trackerProjectTags")
      .withIndex("by_team_and_tag", (q) =>
        q.eq("teamId", team._id).eq("tagId", args.tagId),
      )
      .collect();

    for (const assignment of assignments) {
      await ctx.db.delete(assignment._id);
    }

    return { tagId: args.tagId };
  },
});
