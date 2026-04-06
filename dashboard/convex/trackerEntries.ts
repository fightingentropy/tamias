import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";
import { nowIso } from "../../packages/domain/src/identity";

type TrackerEntryCtx = QueryCtx | MutationCtx;

const trackerEntryInput = v.object({
  id: v.string(),
  date: v.string(),
  projectId: v.optional(v.union(v.string(), v.null())),
  assignedId: v.optional(v.union(v.string(), v.null())),
  description: v.optional(v.union(v.string(), v.null())),
  start: v.optional(v.union(v.string(), v.null())),
  stop: v.optional(v.union(v.string(), v.null())),
  duration: v.optional(v.union(v.number(), v.null())),
  rate: v.optional(v.union(v.number(), v.null())),
  currency: v.optional(v.union(v.string(), v.null())),
  billed: v.optional(v.union(v.boolean(), v.null())),
});

function publicTrackerEntryId(entry: Doc<"trackerEntries">) {
  return entry.publicTrackerEntryId ?? entry._id;
}

async function getTeamOrThrow(ctx: TrackerEntryCtx, teamId: string) {
  const team = await getTeamByPublicTeamId(ctx, teamId);

  if (!team) {
    throw new ConvexError("Convex tracker entry team not found");
  }

  return team;
}

async function getTrackerEntryByPublicId(
  ctx: TrackerEntryCtx,
  args: {
    entryId: string;
    teamId: Id<"teams">;
  },
) {
  const byLegacyId = await ctx.db
    .query("trackerEntries")
    .withIndex("by_public_tracker_entry_id", (q) => q.eq("publicTrackerEntryId", args.entryId))
    .unique();

  if (byLegacyId && byLegacyId.teamId === args.teamId) {
    return byLegacyId;
  }

  try {
    const byDocId = await ctx.db.get(args.entryId as Id<"trackerEntries">);

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

function serializeTrackerEntry(teamId: string, entry: Doc<"trackerEntries">) {
  return {
    id: publicTrackerEntryId(entry),
    teamId,
    projectId: entry.projectId ?? null,
    assignedId: entry.assignedId ?? null,
    description: entry.description ?? null,
    start: entry.start ?? null,
    stop: entry.stop ?? null,
    duration: entry.duration ?? null,
    date: entry.date,
    rate: entry.rate ?? null,
    currency: entry.currency ?? null,
    billed: entry.billed ?? false,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

function sortTrackerEntries(left: Doc<"trackerEntries">, right: Doc<"trackerEntries">) {
  const dateDiff = left.date.localeCompare(right.date);

  if (dateDiff !== 0) {
    return dateDiff;
  }

  const startDiff = (left.start ?? "").localeCompare(right.start ?? "");

  if (startDiff !== 0) {
    return startDiff;
  }

  return left.createdAt.localeCompare(right.createdAt);
}

async function getTeamEntries(ctx: TrackerEntryCtx, teamId: Id<"teams">) {
  return ctx.db
    .query("trackerEntries")
    .withIndex("by_team_id", (q) => q.eq("teamId", teamId))
    .collect();
}

async function getTrackerEntriesByDateIndex(args: {
  ctx: TrackerEntryCtx;
  teamId: Id<"teams">;
  date: string;
  projectId?: string | null;
  assignedId?: string | null;
}) {
  const { ctx, teamId, date, projectId, assignedId } = args;

  if (projectId) {
    return ctx.db
      .query("trackerEntries")
      .withIndex("by_team_project_date", (q) =>
        q.eq("teamId", teamId).eq("projectId", projectId).eq("date", date),
      )
      .collect();
  }

  if (assignedId) {
    return ctx.db
      .query("trackerEntries")
      .withIndex("by_team_assigned_date", (q) =>
        q.eq("teamId", teamId).eq("assignedId", assignedId).eq("date", date),
      )
      .collect();
  }

  return ctx.db
    .query("trackerEntries")
    .withIndex("by_team_and_date", (q) => q.eq("teamId", teamId).eq("date", date))
    .collect();
}

async function getTrackerEntriesByRangeIndex(args: {
  ctx: TrackerEntryCtx;
  teamId: Id<"teams">;
  from: string;
  to: string;
  projectId?: string | null;
  assignedId?: string | null;
}) {
  const { ctx, teamId, from, to, projectId, assignedId } = args;

  if (projectId) {
    const entries = await ctx.db
      .query("trackerEntries")
      .withIndex("by_team_project_date", (q) =>
        q.eq("teamId", teamId).eq("projectId", projectId).gte("date", from).lte("date", to),
      )
      .collect();

    return assignedId
      ? entries.filter((entry) => (entry.assignedId ?? null) === assignedId)
      : entries;
  }

  if (assignedId) {
    return ctx.db
      .query("trackerEntries")
      .withIndex("by_team_assigned_date", (q) =>
        q.eq("teamId", teamId).eq("assignedId", assignedId).gte("date", from).lte("date", to),
      )
      .collect();
  }

  return ctx.db
    .query("trackerEntries")
    .withIndex("by_team_and_date", (q) => q.eq("teamId", teamId).gte("date", from).lte("date", to))
    .collect();
}

async function getTrackerEntriesByProjectIdsIndex(args: {
  ctx: TrackerEntryCtx;
  teamId: Id<"teams">;
  projectIds: string[];
}) {
  const { ctx, teamId, projectIds } = args;

  const entries = await Promise.all(
    [...new Set(projectIds)].map((projectId) =>
      ctx.db
        .query("trackerEntries")
        .withIndex("by_team_project_date", (q) => q.eq("teamId", teamId).eq("projectId", projectId))
        .collect(),
    ),
  );

  return entries.flat();
}

export const serviceGetTrackerEntriesByDate = query({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    date: v.string(),
    projectId: v.optional(v.union(v.string(), v.null())),
    assignedId: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team) {
      return [];
    }

    const entries = await getTrackerEntriesByDateIndex({
      ctx,
      teamId: team._id,
      date: args.date,
      projectId: args.projectId,
      assignedId: args.assignedId,
    });

    return entries
      .sort(sortTrackerEntries)
      .map((entry) => serializeTrackerEntry(args.teamId, entry));
  },
});

export const serviceGetTrackerEntriesByRange = query({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    from: v.string(),
    to: v.string(),
    projectId: v.optional(v.union(v.string(), v.null())),
    assignedId: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team) {
      return [];
    }

    const entries = await getTrackerEntriesByRangeIndex({
      ctx,
      teamId: team._id,
      from: args.from,
      to: args.to,
      projectId: args.projectId,
      assignedId: args.assignedId,
    });

    return entries
      .sort(sortTrackerEntries)
      .map((entry) => serializeTrackerEntry(args.teamId, entry));
  },
});

export const serviceGetTrackerEntriesByProjectIds = query({
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

    const projectIds = new Set(args.projectIds);
    const entries = await getTrackerEntriesByProjectIdsIndex({
      ctx,
      teamId: team._id,
      projectIds: [...projectIds],
    });

    return entries
      .sort(sortTrackerEntries)
      .map((entry) => serializeTrackerEntry(args.teamId, entry));
  },
});

export const serviceGetTrackerEntryById = query({
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

    const entry = await getTrackerEntryByPublicId(ctx, {
      entryId: args.id,
      teamId: team._id,
    });

    return entry ? serializeTrackerEntry(args.teamId, entry) : null;
  },
});

export const serviceUpsertTrackerEntries = mutation({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    entries: v.array(trackerEntryInput),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.entries.length === 0) {
      return [];
    }

    const team = await getTeamOrThrow(ctx, args.teamId);
    const results: Array<ReturnType<typeof serializeTrackerEntry>> = [];

    for (const item of args.entries) {
      const timestamp = nowIso();
      const existing = await getTrackerEntryByPublicId(ctx, {
        entryId: item.id,
        teamId: team._id,
      });

      if (existing) {
        await ctx.db.patch(existing._id, {
          projectId: item.projectId ?? undefined,
          assignedId: item.assignedId ?? undefined,
          description: item.description ?? undefined,
          start: item.start ?? undefined,
          stop: item.stop ?? undefined,
          duration: item.duration ?? undefined,
          date: item.date,
          rate: item.rate ?? undefined,
          currency: item.currency ?? undefined,
          billed: item.billed ?? undefined,
          updatedAt: timestamp,
        });

        const updated = await ctx.db.get(existing._id);

        if (!updated) {
          throw new ConvexError("Failed to update tracker entry");
        }

        results.push(serializeTrackerEntry(args.teamId, updated));
        continue;
      }

      const insertedId = await ctx.db.insert("trackerEntries", {
        publicTrackerEntryId: item.id,
        teamId: team._id,
        projectId: item.projectId ?? undefined,
        assignedId: item.assignedId ?? undefined,
        description: item.description ?? undefined,
        start: item.start ?? undefined,
        stop: item.stop ?? undefined,
        duration: item.duration ?? undefined,
        date: item.date,
        rate: item.rate ?? undefined,
        currency: item.currency ?? undefined,
        billed: item.billed ?? false,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      const inserted = await ctx.db.get(insertedId);

      if (!inserted) {
        throw new ConvexError("Failed to create tracker entry");
      }

      results.push(serializeTrackerEntry(args.teamId, inserted));
    }

    return results;
  },
});

export const serviceDeleteTrackerEntry = mutation({
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

    const entry = await getTrackerEntryByPublicId(ctx, {
      entryId: args.id,
      teamId: team._id,
    });

    if (!entry) {
      return null;
    }

    await ctx.db.delete(entry._id);

    return { id: publicTrackerEntryId(entry) };
  },
});

export const serviceGetCurrentTrackerTimer = query({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    assignedId: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team) {
      return null;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    const entries = await getTeamEntries(ctx, team._id);
    const current = entries
      .filter((entry) => !entry.stop)
      .filter((entry) => (entry.start ?? "") >= today && (entry.start ?? "") <= tomorrow)
      .filter((entry) =>
        args.assignedId === undefined || args.assignedId === null
          ? true
          : (entry.assignedId ?? null) === args.assignedId,
      )
      .sort((left, right) => (right.start ?? "").localeCompare(left.start ?? ""))[0];

    return current ? serializeTrackerEntry(args.teamId, current) : null;
  },
});

export const serviceStartTrackerTimer = mutation({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    id: v.string(),
    projectId: v.string(),
    assignedId: v.optional(v.union(v.string(), v.null())),
    description: v.optional(v.union(v.string(), v.null())),
    start: v.optional(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamOrThrow(ctx, args.teamId);
    const startTime = args.start ?? nowIso();
    const currentDate = new Date(startTime).toISOString().split("T")[0] ?? startTime;
    const existingEntries = await getTeamEntries(ctx, team._id);
    const current = existingEntries.find(
      (entry) =>
        !entry.stop &&
        (args.assignedId === undefined || args.assignedId === null
          ? true
          : (entry.assignedId ?? null) === args.assignedId),
    );

    if (current?.start) {
      const stopTime = nowIso();
      const duration = Math.floor(
        (new Date(stopTime).getTime() - new Date(current.start).getTime()) / 1000,
      );

      await ctx.db.patch(current._id, {
        stop: stopTime,
        duration,
        updatedAt: stopTime,
      });
    }

    const timestamp = nowIso();
    const insertedId = await ctx.db.insert("trackerEntries", {
      publicTrackerEntryId: args.id,
      teamId: team._id,
      projectId: args.projectId,
      assignedId: args.assignedId ?? undefined,
      description: args.description ?? undefined,
      start: startTime,
      duration: undefined,
      date: currentDate,
      billed: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError("Failed to start tracker timer");
    }

    return serializeTrackerEntry(args.teamId, inserted);
  },
});

export const serviceStopTrackerTimer = mutation({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    id: v.optional(v.string()),
    assignedId: v.optional(v.union(v.string(), v.null())),
    stop: v.optional(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamOrThrow(ctx, args.teamId);
    const stopTime = args.stop ?? nowIso();
    const entry =
      (args.id
        ? await getTrackerEntryByPublicId(ctx, {
            entryId: args.id,
            teamId: team._id,
          })
        : null) ??
      (await (async () => {
        const entries = await getTeamEntries(ctx, team._id);
        return (
          entries.find(
            (candidate) =>
              !candidate.stop &&
              (args.assignedId === undefined || args.assignedId === null
                ? true
                : (candidate.assignedId ?? null) === args.assignedId),
          ) ?? null
        );
      })());

    if (!entry) {
      throw new ConvexError("No running timer found to stop");
    }

    if (entry.stop) {
      throw new ConvexError("Timer is already stopped");
    }

    if (!entry.start) {
      throw new ConvexError("Timer has no start time");
    }

    const duration = Math.floor(
      (new Date(stopTime).getTime() - new Date(entry.start).getTime()) / 1000,
    );

    if (duration < 60) {
      await ctx.db.delete(entry._id);

      return {
        id: publicTrackerEntryId(entry),
        discarded: true,
        duration,
        projectId: entry.projectId ?? null,
        description: entry.description ?? null,
        start: entry.start,
        stop: entry.stop ?? null,
      };
    }

    await ctx.db.patch(entry._id, {
      stop: stopTime,
      duration,
      updatedAt: nowIso(),
    });

    const updated = await ctx.db.get(entry._id);

    if (!updated) {
      throw new ConvexError("Failed to update tracker timer");
    }

    return {
      ...serializeTrackerEntry(args.teamId, updated),
      discarded: false,
    };
  },
});
