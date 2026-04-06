import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";
import { nowIso } from "../../packages/domain/src/identity";
import { buildSearchIndexText, buildSearchQuery } from "../../packages/domain/src/text-search";

type TrackerProjectCtx = QueryCtx | MutationCtx;
type TaggedTrackerProjectCursor = {
  createdAt: string;
  trackerProjectId: string;
};

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

function getTrackerProjectSearchText(
  project: {
    name: string;
    description?: string | null;
    status?: "in_progress" | "completed" | null;
    currency?: string | null;
  },
) {
  return (
    buildSearchIndexText([
      project.name,
      project.description,
      project.status,
      project.currency,
    ]) || undefined
  );
}

function encodeTaggedTrackerProjectCursor(cursor: TaggedTrackerProjectCursor) {
  return btoa(JSON.stringify(cursor))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodeTaggedTrackerProjectCursor(
  cursor: string | null | undefined,
): TaggedTrackerProjectCursor | null {
  if (!cursor) {
    return null;
  }

  try {
    const normalizedCursor = cursor.replace(/-/g, "+").replace(/_/g, "/");
    const paddedCursor =
      normalizedCursor + "=".repeat((4 - (normalizedCursor.length % 4)) % 4);
    const parsed = JSON.parse(atob(paddedCursor)) as Partial<TaggedTrackerProjectCursor>;

    if (
      typeof parsed.createdAt !== "string" ||
      typeof parsed.trackerProjectId !== "string"
    ) {
      throw new ConvexError("Invalid tagged tracker project cursor");
    }

    return {
      createdAt: parsed.createdAt,
      trackerProjectId: parsed.trackerProjectId,
    };
  } catch {
    throw new ConvexError("Invalid tagged tracker project cursor");
  }
}

function compareTaggedTrackerProjectRows(
  left: Pick<Doc<"trackerProjectTags">, "projectCreatedAt" | "trackerProjectId">,
  right: Pick<Doc<"trackerProjectTags">, "projectCreatedAt" | "trackerProjectId">,
  order: "asc" | "desc",
) {
  const createdAtComparison =
    left.projectCreatedAt!.localeCompare(right.projectCreatedAt!);

  if (createdAtComparison !== 0) {
    return order === "asc" ? createdAtComparison : -createdAtComparison;
  }

  const trackerProjectIdComparison = left.trackerProjectId.localeCompare(
    right.trackerProjectId,
  );

  return order === "asc"
    ? trackerProjectIdComparison
    : -trackerProjectIdComparison;
}

function isTaggedTrackerProjectRowPastCursor(
  assignment: Pick<Doc<"trackerProjectTags">, "projectCreatedAt" | "trackerProjectId">,
  cursor: TaggedTrackerProjectCursor | null,
  order: "asc" | "desc",
) {
  if (!cursor || !assignment.projectCreatedAt) {
    return false;
  }

  if (order === "asc") {
    return (
      assignment.projectCreatedAt < cursor.createdAt ||
      (assignment.projectCreatedAt === cursor.createdAt &&
        assignment.trackerProjectId <= cursor.trackerProjectId)
    );
  }

  return (
    assignment.projectCreatedAt > cursor.createdAt ||
    (assignment.projectCreatedAt === cursor.createdAt &&
      assignment.trackerProjectId >= cursor.trackerProjectId)
  );
}

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

export const serviceListTaggedTrackerProjectsPage = query({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    tagIds: v.array(v.string()),
    status: v.optional(trackerProjectStatus),
    cursor: v.optional(v.union(v.string(), v.null())),
    pageSize: v.number(),
    order: v.optional(trackerProjectOrderValidator),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team || args.tagIds.length === 0) {
      return {
        page: [],
        isDone: true,
        continueCursor: null,
      };
    }

    const order = args.order ?? "desc";
    const pageSize = Math.max(1, Math.min(args.pageSize, 100));
    const cursor = decodeTaggedTrackerProjectCursor(args.cursor ?? null);
    const tagIds = [...new Set(args.tagIds)];
    let takeCount = Math.max(pageSize * 4, 50);
    let mayHaveMoreRows = false;
    let lastScannedRow: Pick<
      Doc<"trackerProjectTags">,
      "trackerProjectId" | "projectCreatedAt"
    > | null = null;
    let taggedRows: Array<
      Pick<Doc<"trackerProjectTags">, "trackerProjectId" | "projectCreatedAt">
    > = [];

    while (true) {
      const rowsByTag = await Promise.all(
        tagIds.map((tagId) =>
          ctx.db
            .query("trackerProjectTags")
            .withIndex("by_team_tag_project_created_at", (range) => {
              const scoped = range.eq("teamId", team._id).eq("tagId", tagId);

              if (cursor?.createdAt) {
                return order === "asc"
                  ? scoped.gte("projectCreatedAt", cursor.createdAt)
                  : scoped.lte("projectCreatedAt", cursor.createdAt);
              }

              return scoped;
            })
            .order(order)
            .take(takeCount),
        ),
      );

      mayHaveMoreRows = rowsByTag.some((rows) => rows.length === takeCount);
      taggedRows = [
        ...new Map(
          rowsByTag
            .flat()
            .filter(
              (assignment) =>
                assignment.projectCreatedAt &&
                !isTaggedTrackerProjectRowPastCursor(assignment, cursor, order),
            )
            .map((assignment) => [assignment.trackerProjectId, assignment]),
        ).values(),
      ].sort((left, right) => compareTaggedTrackerProjectRows(left, right, order));
      lastScannedRow = taggedRows.at(-1) ?? null;

      if (
        taggedRows.length >= pageSize ||
        !mayHaveMoreRows ||
        takeCount >= 400
      ) {
        break;
      }

      takeCount = Math.min(takeCount * 2, 400);
    }

    const serializedRows: Array<{
      row: Pick<Doc<"trackerProjectTags">, "trackerProjectId" | "projectCreatedAt">;
      project: ReturnType<typeof serializeTrackerProject>;
    }> = [];

    for (const row of taggedRows) {
      const project = await getTrackerProjectByPublicId(ctx, {
        projectId: row.trackerProjectId,
        teamId: team._id,
      });

      if (!project) {
        continue;
      }

      if (args.status && project.status !== args.status) {
        continue;
      }

      serializedRows.push({
        row,
        project: serializeTrackerProject(args.teamId, project),
      });

      if (serializedRows.length >= pageSize) {
        break;
      }
    }

    const lastReturnedRow = serializedRows.at(-1)?.row ?? null;
    const hasBufferedResults = taggedRows.length > serializedRows.length;
    const hasNextPage =
      (serializedRows.length === pageSize && (hasBufferedResults || mayHaveMoreRows)) ||
      (serializedRows.length < pageSize && mayHaveMoreRows);
    const nextCursorRow = lastReturnedRow ?? lastScannedRow;

    return {
      page: serializedRows.map((entry) => entry.project),
      isDone: !hasNextPage,
      continueCursor:
        hasNextPage && nextCursorRow?.projectCreatedAt
          ? encodeTaggedTrackerProjectCursor({
              createdAt: nextCursorRow.projectCreatedAt,
              trackerProjectId: nextCursorRow.trackerProjectId,
            })
          : null,
    };
  },
});

export const serviceSearchTrackerProjects = query({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    query: v.string(),
    status: v.optional(trackerProjectStatus),
    limit: v.optional(v.number()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.teamId);
    const searchQuery = buildSearchQuery(args.query);

    if (!team || searchQuery.length === 0) {
      return [];
    }

    const projects = await ctx.db
      .query("trackerProjects")
      .withSearchIndex("search_by_team", (q) =>
        q.search("searchText", searchQuery).eq("teamId", team._id),
      )
      .take(Math.max(1, Math.min((args.limit ?? 100) * 4, 400)));

    return projects
      .filter((project) =>
        args.status === undefined ? true : project.status === args.status,
      )
      .slice(0, args.limit ?? projects.length)
      .map((project) => serializeTrackerProject(args.teamId, project));
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
      const searchText = getTrackerProjectSearchText({
        name: args.name,
        description: args.description ?? undefined,
        status: args.status ?? existing.status,
        currency: args.currency ?? undefined,
      });

      await ctx.db.patch(existing._id, {
        name: args.name,
        description: args.description ?? undefined,
        status: args.status ?? existing.status,
        customerId: args.customerId ?? undefined,
        estimate: args.estimate ?? undefined,
        currency: args.currency ?? undefined,
        billable: args.billable ?? undefined,
        rate: args.rate ?? undefined,
        searchText,
        updatedAt: timestamp,
      });

      const updated = await ctx.db.get(existing._id);

      if (!updated) {
        throw new ConvexError("Failed to update tracker project");
      }

      return serializeTrackerProject(args.teamId, updated);
    }

    const searchText = getTrackerProjectSearchText({
      name: args.name,
      description: args.description ?? undefined,
      status: args.status ?? "in_progress",
      currency: args.currency ?? undefined,
    });

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
      searchText,
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

export const serviceRebuildTrackerProjectSearchTexts = mutation({
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
      throw new ConvexError("Convex tracker project team not found");
    }

    const results = [];

    for (const team of validTeams) {
      const projects = await ctx.db
        .query("trackerProjects")
        .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
        .collect();
      let updatedProjectCount = 0;

      for (const project of projects) {
        const searchText = getTrackerProjectSearchText(project);

        if (project.searchText === searchText) {
          continue;
        }

        await ctx.db.patch(project._id, {
          searchText,
        });
        updatedProjectCount += 1;
      }

      results.push({
        teamId: team.publicTeamId ?? team._id,
        projectCount: projects.length,
        updatedProjectCount,
      });
    }

    return results;
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
