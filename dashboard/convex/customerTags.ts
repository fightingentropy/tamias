import { ConvexError, v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";
import { nowIso } from "../../packages/domain/src/identity";

type CustomerTagCtx = QueryCtx | MutationCtx;

type CustomerTagAssignmentRecord = {
  customerId: string;
  tagId: string;
  createdAt: string;
  updatedAt: string;
};

function serializeCustomerTagAssignment(
  teamId: string,
  assignment: CustomerTagAssignmentRecord,
) {
  return {
    customerId: assignment.customerId,
    tagId: assignment.tagId,
    teamId,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
  };
}

async function getTeamOrThrow(ctx: CustomerTagCtx, teamId: string) {
  const team = await getTeamByPublicTeamId(ctx, teamId);

  if (!team) {
    throw new ConvexError("Convex customer tag team not found");
  }

  return team;
}

async function listAssignmentsForCustomer(
  ctx: CustomerTagCtx,
  args: {
    teamId: string;
    customerId: string;
  },
) {
  const team = await getTeamByPublicTeamId(ctx, args.teamId);

  if (!team) {
    return [];
  }

  return ctx.db
    .query("customerTags")
    .withIndex("by_team_and_customer", (q) =>
      q.eq("teamId", team._id).eq("customerId", args.customerId),
    )
    .collect();
}

export const serviceGetCustomerTagAssignmentsForCustomerIds = query({
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

    const assignments = await Promise.all(
      [...new Set(args.customerIds)].map((customerId) =>
        ctx.db
          .query("customerTags")
          .withIndex("by_team_and_customer", (q) =>
            q.eq("teamId", team._id).eq("customerId", customerId),
          )
          .collect(),
      ),
    );

    return assignments.flat().map((assignment) =>
      serializeCustomerTagAssignment(args.teamId, assignment),
    );
  },
});

export const serviceReplaceCustomerTags = mutation({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    customerId: v.string(),
    tagIds: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamOrThrow(ctx, args.teamId);
    const currentAssignments = await listAssignmentsForCustomer(ctx, args);
    const currentTagIds = new Set(
      currentAssignments.map((assignment) => assignment.tagId),
    );
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

      await ctx.db.insert("customerTags", {
        customerId: args.customerId,
        tagId,
        teamId: team._id,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    const assignments = await listAssignmentsForCustomer(ctx, args);

    return assignments.map((assignment) =>
      serializeCustomerTagAssignment(args.teamId, assignment),
    );
  },
});

export const serviceDeleteCustomerTagsForCustomer = mutation({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    customerId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const assignments = await listAssignmentsForCustomer(ctx, args);

    for (const assignment of assignments) {
      await ctx.db.delete(assignment._id);
    }

    return { customerId: args.customerId };
  },
});

export const serviceDeleteCustomerTagsForTag = mutation({
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
      .query("customerTags")
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
