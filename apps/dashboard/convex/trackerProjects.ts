import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";
import { nowIso } from "../../../packages/domain/src/identity";

type TrackerProjectCtx = QueryCtx | MutationCtx;

const trackerProjectStatus = v.union(
  v.literal("in_progress"),
  v.literal("completed"),
);
const trackerProjectOrderValidator = v.union(
  v.literal("asc"),
  v.literal("desc"),
);

function publicTrackerProjectId(project: Doc<"trackerProjects">) {
  return project.publicTrackerProjectId ?? project._id;
}

async function getTeamOrThrow(ctx: TrackerProjectCtx, teamId: string) {
  const team = await getTeamByPublicTeamId(ctx, teamId);

  if (!team) {
    throw new ConvexError("Convex tracker project team not found");
  }

  return team;
}

async function getTrackerProjectByPublicId(
  ctx: TrackerProjectCtx,
  args: {
    projectId: string;
    teamId: Id<"teams">;
  },
) {
  const byLegacyId = await ctx.db
    .query("trackerProjects")
    .withIndex("by_public_tracker_project_id", (q) =>
      q.eq("publicTrackerProjectId", args.projectId),
    )
    .unique();

  if (byLegacyId && byLegacyId.teamId === args.teamId) {
    return byLegacyId;
  }

  try {
    const byDocId = await ctx.db.get(args.projectId as Id<"trackerProjects">);

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

function serializeTrackerProject(
  teamId: string,
  project: Doc<"trackerProjects">,
) {
  return {
    id: publicTrackerProjectId(project),
    teamId,
    name: project.name,
    description: project.description ?? null,
    status: project.status,
    customerId: project.customerId ?? null,
    estimate: project.estimate ?? null,
    currency: project.currency ?? null,
    billable: project.billable ?? false,
    rate: project.rate ?? null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export const serviceGetTrackerProjects = query({
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

    const projects = await ctx.db
      .query("trackerProjects")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect();

    return projects
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((project) => serializeTrackerProject(args.teamId, project));
  },
});

export const serviceListTrackerProjectsPage = query({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    status: v.optional(trackerProjectStatus),
    order: v.optional(trackerProjectOrderValidator),
    paginationOpts: paginationOptsValidator,
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team) {
      return {
        page: [],
        isDone: true,
        continueCursor: args.paginationOpts.cursor ?? "",
        splitCursor: null,
        pageStatus: null,
      };
    }

    const baseQuery = args.status
      ? ctx.db
          .query("trackerProjects")
          .withIndex("by_team_status_created_at", (q) =>
            q.eq("teamId", team._id).eq("status", args.status!),
          )
      : ctx.db
          .query("trackerProjects")
          .withIndex("by_team_created_at", (q) => q.eq("teamId", team._id));
    const result = await baseQuery
      .order(args.order ?? "desc")
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: result.page.map((project) =>
        serializeTrackerProject(args.teamId, project),
      ),
    };
  },
});

export const serviceGetTrackerProjectsByIds = query({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    projectIds: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.projectIds.length === 0) {
      return [];
    }

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team) {
      return [];
    }

    const projects = await Promise.all(
      [...new Set(args.projectIds)].map((projectId) =>
        getTrackerProjectByPublicId(ctx, {
          projectId,
          teamId: team._id,
        }),
      ),
    );

    return projects
      .filter((project): project is NonNullable<typeof project> => project !== null)
      .map((project) => serializeTrackerProject(args.teamId, project));
  },
});

export const serviceGetTrackerProjectsByCustomerIds = query({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    customerIds: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.customerIds.length === 0) {
      return [];
    }

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team) {
      return [];
    }

    const projects = await Promise.all(
      [...new Set(args.customerIds)].map((customerId) =>
        ctx.db
          .query("trackerProjects")
          .withIndex("by_team_and_customer", (q) =>
            q.eq("teamId", team._id).eq("customerId", customerId),
          )
          .collect(),
      ),
    );

    return projects.flat().map((project) =>
      serializeTrackerProject(args.teamId, project),
    );
  },
});

export const serviceGetTrackerProjectById = query({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    id: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team) {
      return null;
    }

    const project = await getTrackerProjectByPublicId(ctx, {
      projectId: args.id,
      teamId: team._id,
    });

    return project ? serializeTrackerProject(args.teamId, project) : null;
  },
});

export const serviceUpsertTrackerProject = mutation({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    id: v.string(),
    name: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    status: v.optional(trackerProjectStatus),
    customerId: v.optional(v.union(v.string(), v.null())),
    estimate: v.optional(v.union(v.number(), v.null())),
    currency: v.optional(v.union(v.string(), v.null())),
    billable: v.optional(v.union(v.boolean(), v.null())),
    rate: v.optional(v.union(v.number(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamOrThrow(ctx, args.teamId);
    const timestamp = nowIso();
    const existing = await getTrackerProjectByPublicId(ctx, {
      projectId: args.id,
      teamId: team._id,
    });

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        description: args.description ?? undefined,
        status: args.status ?? existing.status,
        customerId: args.customerId ?? undefined,
        estimate: args.estimate ?? undefined,
        currency: args.currency ?? undefined,
        billable: args.billable ?? undefined,
        rate: args.rate ?? undefined,
        updatedAt: timestamp,
      });

      const updated = await ctx.db.get(existing._id);

      if (!updated) {
        throw new ConvexError("Failed to update tracker project");
      }

      return serializeTrackerProject(args.teamId, updated);
    }

    const insertedId = await ctx.db.insert("trackerProjects", {
      publicTrackerProjectId: args.id,
      teamId: team._id,
      name: args.name,
      description: args.description ?? undefined,
      status: args.status ?? "in_progress",
      customerId: args.customerId ?? undefined,
      estimate: args.estimate ?? undefined,
      currency: args.currency ?? undefined,
      billable: args.billable ?? false,
      rate: args.rate ?? undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError("Failed to create tracker project");
    }

    return serializeTrackerProject(args.teamId, inserted);
  },
});

export const serviceDeleteTrackerProject = mutation({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    id: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team) {
      return null;
    }

    const project = await getTrackerProjectByPublicId(ctx, {
      projectId: args.id,
      teamId: team._id,
    });

    if (!project) {
      return null;
    }

    const publicId = publicTrackerProjectId(project);
    const [entries, tags] = await Promise.all([
      ctx.db
        .query("trackerEntries")
        .withIndex("by_team_and_project", (q) =>
          q.eq("teamId", team._id).eq("projectId", publicId),
        )
        .collect(),
      ctx.db
        .query("trackerProjectTags")
        .withIndex("by_team_and_project", (q) =>
          q.eq("teamId", team._id).eq("trackerProjectId", publicId),
        )
        .collect(),
    ]);

    for (const entry of entries) {
      await ctx.db.delete(entry._id);
    }

    for (const tag of tags) {
      await ctx.db.delete(tag._id);
    }

    await ctx.db.delete(project._id);

    return { id: publicId };
  },
});
