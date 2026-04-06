import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";
import { nowIso } from "../../packages/domain/src/identity";

const insightPeriodTypeValidator = v.union(
  v.literal("weekly"),
  v.literal("monthly"),
  v.literal("quarterly"),
  v.literal("yearly"),
);

const insightStatusValidator = v.union(
  v.literal("pending"),
  v.literal("generating"),
  v.literal("completed"),
  v.literal("failed"),
);

function serializeInsight(
  publicTeamId: string,
  record: {
    _id: string;
    publicInsightId?: string;
    periodType: "weekly" | "monthly" | "quarterly" | "yearly";
    periodStart: string;
    periodEnd: string;
    periodYear: number;
    periodNumber: number;
    status: "pending" | "generating" | "completed" | "failed";
    selectedMetrics?: unknown;
    allMetrics?: unknown;
    anomalies?: unknown;
    expenseAnomalies?: unknown;
    milestones?: unknown;
    activity?: unknown;
    currency: string;
    title?: string;
    content?: unknown;
    predictions?: unknown;
    audioPath?: string;
    generatedAt?: string;
    createdAt: string;
    updatedAt: string;
  },
) {
  return {
    id: record.publicInsightId ?? record._id,
    teamId: publicTeamId,
    periodType: record.periodType,
    periodStart: record.periodStart,
    periodEnd: record.periodEnd,
    periodYear: record.periodYear,
    periodNumber: record.periodNumber,
    status: record.status,
    selectedMetrics: record.selectedMetrics ?? null,
    allMetrics: record.allMetrics ?? null,
    anomalies: record.anomalies ?? null,
    expenseAnomalies: record.expenseAnomalies ?? null,
    milestones: record.milestones ?? null,
    activity: record.activity ?? null,
    currency: record.currency,
    title: record.title ?? null,
    content: record.content ?? null,
    predictions: record.predictions ?? null,
    audioPath: record.audioPath ?? null,
    generatedAt: record.generatedAt ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export const serviceCreateInsight = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    periodType: insightPeriodTypeValidator,
    periodStart: v.string(),
    periodEnd: v.string(),
    periodYear: v.number(),
    periodNumber: v.number(),
    currency: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      throw new ConvexError("Convex insight team not found");
    }

    const existing = await ctx.db
      .query("insightRecords")
      .withIndex("by_team_and_period", (q) =>
        q
          .eq("teamId", team._id)
          .eq("periodType", args.periodType)
          .eq("periodYear", args.periodYear)
          .eq("periodNumber", args.periodNumber),
      )
      .unique();

    if (existing) {
      return null;
    }

    const timestamp = nowIso();
    const insertedId = await ctx.db.insert("insightRecords", {
      publicInsightId: crypto.randomUUID(),
      teamId: team._id,
      periodType: args.periodType,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      periodYear: args.periodYear,
      periodNumber: args.periodNumber,
      status: "pending",
      currency: args.currency,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError("Failed to create insight");
    }

    return serializeInsight(args.publicTeamId, inserted as never);
  },
});

export const serviceUpdateInsight = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    insightId: v.string(),
    status: v.optional(insightStatusValidator),
    title: v.optional(v.union(v.string(), v.null())),
    selectedMetrics: v.optional(v.any()),
    allMetrics: v.optional(v.any()),
    anomalies: v.optional(v.any()),
    expenseAnomalies: v.optional(v.any()),
    milestones: v.optional(v.any()),
    activity: v.optional(v.any()),
    content: v.optional(v.any()),
    predictions: v.optional(v.any()),
    audioPath: v.optional(v.union(v.string(), v.null())),
    generatedAt: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      throw new ConvexError("Convex insight team not found");
    }

    const existing = await ctx.db
      .query("insightRecords")
      .withIndex("by_public_insight_id", (q) => q.eq("publicInsightId", args.insightId))
      .unique();

    if (!existing || existing.teamId !== team._id) {
      return null;
    }

    await ctx.db.patch(existing._id, {
      ...(args.status !== undefined ? { status: args.status } : {}),
      ...(args.title !== undefined ? { title: args.title ?? undefined } : {}),
      ...(args.selectedMetrics !== undefined
        ? { selectedMetrics: args.selectedMetrics ?? undefined }
        : {}),
      ...(args.allMetrics !== undefined ? { allMetrics: args.allMetrics ?? undefined } : {}),
      ...(args.anomalies !== undefined ? { anomalies: args.anomalies ?? undefined } : {}),
      ...(args.expenseAnomalies !== undefined
        ? { expenseAnomalies: args.expenseAnomalies ?? undefined }
        : {}),
      ...(args.milestones !== undefined ? { milestones: args.milestones ?? undefined } : {}),
      ...(args.activity !== undefined ? { activity: args.activity ?? undefined } : {}),
      ...(args.content !== undefined ? { content: args.content ?? undefined } : {}),
      ...(args.predictions !== undefined ? { predictions: args.predictions ?? undefined } : {}),
      ...(args.audioPath !== undefined ? { audioPath: args.audioPath ?? undefined } : {}),
      ...(args.generatedAt !== undefined ? { generatedAt: args.generatedAt ?? undefined } : {}),
      updatedAt: nowIso(),
    });

    const updated = await ctx.db.get(existing._id);

    if (!updated) {
      throw new ConvexError("Failed to update insight");
    }

    return serializeInsight(args.publicTeamId, updated as never);
  },
});

export const serviceListInsights = query({
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
      .query("insightRecords")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect();

    return records.map((record) => serializeInsight(args.publicTeamId, record as never));
  },
});

export const serviceGetInsightById = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    insightId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return null;
    }

    const record = await ctx.db
      .query("insightRecords")
      .withIndex("by_public_insight_id", (q) => q.eq("publicInsightId", args.insightId))
      .unique();

    if (!record || record.teamId !== team._id) {
      return null;
    }

    return serializeInsight(args.publicTeamId, record as never);
  },
});
