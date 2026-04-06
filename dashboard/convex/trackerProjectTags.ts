import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";
import { nowIso } from "../../packages/domain/src/identity";

type TrackerProjectTagCtx = QueryCtx | MutationCtx;

async function getTrackerProjectForTeamByExternalId(
  ctx: TrackerProjectTagCtx,
  args: {
    teamId: Id<"teams">;
    trackerProjectId: string;
  },
) {
  const byLegacyId = await ctx.db
    .query("trackerProjects")
    .withIndex("by_public_tracker_project_id", (q) =>
      q.eq("publicTrackerProjectId", args.trackerProjectId),
    )
    .unique();

  if (byLegacyId && byLegacyId.teamId === args.teamId) {
    return byLegacyId;
  }

  try {
    const byDocId = await ctx.db.get(
      args.trackerProjectId as Id<"trackerProjects">,
    );

    if (byDocId && byDocId.teamId === args.teamId) {
      return byDocId;
    }
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.includes("db.get") ||
      !error.message.includes("Unable to decode ID")
    ) {
      throw error;
    }
  }

  return null;
}

function getTrackerProjectTagSortFields(project: { createdAt: string }) {
  return {
    projectCreatedAt: project.createdAt,
  };
}

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

export const serviceRebuildTrackerProjectTagSortFields = mutation({
  args: {
    serviceKey: v.string(),
    teamId: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const teams = args.teamId
      ? [await getTeamByPublicTeamId(ctx, args.teamId)]
      : (await ctx.db.query("teams").collect()).filter(
          (team) => !!team.publicTeamId,
        );

    const validTeams = teams.filter(
      (team): team is NonNullable<(typeof teams)[number]> => team !== null,
    );

    if (args.teamId && validTeams.length === 0) {
      throw new ConvexError("Convex tracker project tag team not found");
    }

    const results = [];

    for (const team of validTeams) {
      const assignments = await ctx.db
        .query("trackerProjectTags")
        .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
        .collect();
      let updatedAssignmentCount = 0;
      let deletedAssignmentCount = 0;

      for (const assignment of assignments) {
        const project = await getTrackerProjectForTeamByExternalId(ctx, {
          teamId: team._id,
          trackerProjectId: assignment.trackerProjectId,
        });

        if (!project) {
          await ctx.db.delete(assignment._id);
          deletedAssignmentCount += 1;
          continue;
        }

        const sortFields = getTrackerProjectTagSortFields(project);

        if (assignment.projectCreatedAt === sortFields.projectCreatedAt) {
          continue;
        }

        await ctx.db.patch(assignment._id, sortFields);
        updatedAssignmentCount += 1;
      }

      results.push({
        teamId: team.publicTeamId ?? team._id,
        assignmentCount: assignments.length,
        updatedAssignmentCount,
        deletedAssignmentCount,
      });
    }

    return results;
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
    const project = await getTrackerProjectForTeamByExternalId(ctx, {
      teamId: team._id,
      trackerProjectId: args.trackerProjectId,
    });

    if (!project) {
      throw new ConvexError("Convex tracker project tag target not found");
    }

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
        ...getTrackerProjectTagSortFields(project),
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
