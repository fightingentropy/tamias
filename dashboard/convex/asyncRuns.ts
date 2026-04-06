import { nowIso } from "../../packages/domain/src/identity";
import type { Doc } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx, mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import {
  getAppUserById,
  getTeamByPublicTeamId,
  publicTeamId,
  publicUserId,
  requireCurrentAppUser,
  requireMembership,
} from "./lib/identity";
import { requireServiceKey } from "./lib/service";

const asyncRunProviderValidator = v.union(
  v.literal("cloudflare-queue"),
  v.literal("cloudflare-workflow"),
  v.literal("cloudflare-schedule"),
);
const asyncRunKindValidator = v.union(
  v.literal("job"),
  v.literal("workflow"),
  v.literal("schedule"),
);
const asyncRunStatusValidator = v.union(
  v.literal("waiting"),
  v.literal("active"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("delayed"),
  v.literal("canceled"),
  v.literal("unknown"),
);
type AsyncRunsCtx = QueryCtx | MutationCtx;

async function getAsyncRunByPublicRunId(
  ctx: AsyncRunsCtx,
  publicRunId: string,
): Promise<Doc<"asyncRuns"> | null> {
  return ctx.db
    .query("asyncRuns")
    .withIndex("by_public_run_id", (q) => q.eq("publicRunId", publicRunId))
    .unique();
}

async function serializeAsyncRun(ctx: AsyncRunsCtx, run: Doc<"asyncRuns">) {
  const [team, appUser] = await Promise.all([
    run.teamId ? ctx.db.get(run.teamId) : null,
    run.appUserId ? ctx.db.get(run.appUserId) : null,
  ]);

  return {
    id: run.publicRunId ?? run._id,
    teamId: publicTeamId(team),
    appUserId: publicUserId(appUser),
    provider: run.provider,
    kind: run.kind,
    providerRunId: run.providerRunId ?? null,
    providerQueueName: run.providerQueueName ?? null,
    providerJobName: run.providerJobName ?? null,
    status: run.status,
    progress: run.progress ?? null,
    progressStep: run.progressStep ?? null,
    result: run.result,
    error: run.error ?? null,
    metadata: run.metadata ?? null,
    startedAt: run.startedAt ?? null,
    completedAt: run.completedAt ?? null,
    canceledAt: run.canceledAt ?? null,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  };
}

export const currentUserRun = query({
  args: {
    runId: v.string(),
  },
  async handler(ctx, args) {
    const appUser = await requireCurrentAppUser(ctx).catch(() => null);

    if (!appUser) {
      return null;
    }

    const run = await getAsyncRunByPublicRunId(ctx, args.runId);

    if (!run) {
      return null;
    }

    if (run.appUserId === appUser._id) {
      return serializeAsyncRun(ctx, run);
    }

    if (!run.teamId) {
      return null;
    }

    const membership = await requireMembership(ctx, run.teamId, appUser._id).catch(() => null);

    if (!membership) {
      return null;
    }

    return serializeAsyncRun(ctx, run);
  },
});

export const serviceGetAsyncRunByPublicRunId = query({
  args: {
    serviceKey: v.string(),
    runId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const run = await getAsyncRunByPublicRunId(ctx, args.runId);

    if (!run) {
      return null;
    }

    return serializeAsyncRun(ctx, run);
  },
});

export const serviceGetAsyncRunByProviderRunId = query({
  args: {
    serviceKey: v.string(),
    provider: asyncRunProviderValidator,
    providerRunId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const run = await ctx.db
      .query("asyncRuns")
      .withIndex("by_provider_run", (q) =>
        q.eq("provider", args.provider).eq("providerRunId", args.providerRunId),
      )
      .unique();

    if (!run) {
      return null;
    }

    return serializeAsyncRun(ctx, run);
  },
});

export const serviceCreateAsyncRun = mutation({
  args: {
    serviceKey: v.string(),
    publicRunId: v.optional(v.string()),
    publicTeamId: v.optional(v.string()),
    appUserId: v.optional(v.id("appUsers")),
    provider: asyncRunProviderValidator,
    kind: asyncRunKindValidator,
    providerRunId: v.optional(v.string()),
    providerQueueName: v.optional(v.string()),
    providerJobName: v.optional(v.string()),
    status: v.optional(asyncRunStatusValidator),
    progress: v.optional(v.number()),
    progressStep: v.optional(v.string()),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
    metadata: v.optional(v.any()),
    startedAt: v.optional(v.string()),
    completedAt: v.optional(v.string()),
    canceledAt: v.optional(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const timestamp = nowIso();
    const [team, appUser] = await Promise.all([
      args.publicTeamId ? getTeamByPublicTeamId(ctx, args.publicTeamId) : null,
      args.appUserId ? getAppUserById(ctx, args.appUserId) : null,
    ]);

    if (args.publicTeamId && !team) {
      throw new ConvexError("Missing team for async run");
    }

    if (args.appUserId && !appUser) {
      throw new ConvexError("Missing user for async run");
    }

    const insertedId = await ctx.db.insert("asyncRuns", {
      publicRunId: args.publicRunId ?? crypto.randomUUID(),
      teamId: team?._id,
      appUserId: appUser?._id,
      provider: args.provider,
      kind: args.kind,
      providerRunId: args.providerRunId,
      providerQueueName: args.providerQueueName,
      providerJobName: args.providerJobName,
      status: args.status ?? "waiting",
      progress: args.progress,
      progressStep: args.progressStep,
      result: args.result,
      error: args.error,
      metadata: args.metadata,
      startedAt: args.startedAt,
      completedAt: args.completedAt,
      canceledAt: args.canceledAt,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError("Failed to create async run");
    }

    return serializeAsyncRun(ctx, inserted);
  },
});

export const serviceUpdateAsyncRun = mutation({
  args: {
    serviceKey: v.string(),
    runId: v.string(),
    providerRunId: v.optional(v.string()),
    providerQueueName: v.optional(v.string()),
    providerJobName: v.optional(v.string()),
    status: v.optional(asyncRunStatusValidator),
    progress: v.optional(v.number()),
    progressStep: v.optional(v.string()),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
    metadata: v.optional(v.any()),
    startedAt: v.optional(v.string()),
    completedAt: v.optional(v.string()),
    canceledAt: v.optional(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const run = await getAsyncRunByPublicRunId(ctx, args.runId);

    if (!run) {
      return null;
    }

    const timestamp = nowIso();
    const patch: Record<string, unknown> = {
      updatedAt: timestamp,
    };

    if (args.providerRunId !== undefined) {
      patch.providerRunId = args.providerRunId;
    }

    if (args.providerQueueName !== undefined) {
      patch.providerQueueName = args.providerQueueName;
    }

    if (args.providerJobName !== undefined) {
      patch.providerJobName = args.providerJobName;
    }

    if (args.status !== undefined) {
      patch.status = args.status;

      if (args.status === "active" && !run.startedAt && args.startedAt === undefined) {
        patch.startedAt = timestamp;
      }

      if (
        (args.status === "completed" || args.status === "failed") &&
        !run.completedAt &&
        args.completedAt === undefined
      ) {
        patch.completedAt = timestamp;
      }

      if (args.status === "canceled" && !run.canceledAt && args.canceledAt === undefined) {
        patch.canceledAt = timestamp;
      }
    }

    if (args.progress !== undefined) {
      patch.progress = args.progress;
    }

    if (args.progressStep !== undefined) {
      patch.progressStep = args.progressStep;
    }

    if (args.result !== undefined) {
      patch.result = args.result;
    }

    if (args.error !== undefined) {
      patch.error = args.error;
    }

    if (args.metadata !== undefined) {
      patch.metadata = args.metadata;
    }

    if (args.startedAt !== undefined) {
      patch.startedAt = args.startedAt;
    }

    if (args.completedAt !== undefined) {
      patch.completedAt = args.completedAt;
    }

    if (args.canceledAt !== undefined) {
      patch.canceledAt = args.canceledAt;
    }

    await ctx.db.patch(run._id, patch);

    const updated = await ctx.db.get(run._id);

    if (!updated) {
      return null;
    }

    return serializeAsyncRun(ctx, updated as Doc<"asyncRuns">);
  },
});
