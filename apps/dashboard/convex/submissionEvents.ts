import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";
import { nowIso } from "../../../packages/domain/src/identity";

export const serviceCreateSubmissionEvent = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    filingProfileId: v.string(),
    provider: v.string(),
    obligationType: v.string(),
    vatReturnId: v.optional(v.union(v.string(), v.null())),
    status: v.string(),
    eventType: v.string(),
    correlationId: v.optional(v.union(v.string(), v.null())),
    requestPayload: v.optional(v.any()),
    responsePayload: v.optional(v.any()),
    errorMessage: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      throw new ConvexError("Convex submission event team not found");
    }

    const timestamp = nowIso();
    const insertedId = await ctx.db.insert("submissionEvents", {
      teamId: team._id,
      filingProfileId: args.filingProfileId,
      provider: args.provider,
      obligationType: args.obligationType,
      vatReturnId: args.vatReturnId ?? undefined,
      status: args.status,
      eventType: args.eventType,
      correlationId: args.correlationId ?? undefined,
      requestPayload: args.requestPayload,
      responsePayload: args.responsePayload,
      errorMessage: args.errorMessage ?? undefined,
      createdAt: timestamp,
    });

    return ctx.db.get(insertedId);
  },
});

export const serviceListSubmissionEvents = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    provider: v.optional(v.string()),
    obligationType: v.optional(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const records = await ctx.db
      .query("submissionEvents")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect();

    return records
      .filter(
        (record) =>
          (args.provider ? record.provider === args.provider : true) &&
          (args.obligationType
            ? record.obligationType === args.obligationType
            : true),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
});
