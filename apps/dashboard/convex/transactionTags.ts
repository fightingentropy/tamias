import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";
import { nowIso } from "../../../packages/domain/src/identity";

type TransactionTagCtx = QueryCtx | MutationCtx;

type TagRecord = {
  _id: string;
  publicTagId?: string;
  name: string;
};

async function getTransactionForTeamByExternalId(
  ctx: TransactionTagCtx,
  args: {
    teamId: Id<"teams">;
    transactionId: string;
  },
) {
  const byLegacyId = await ctx.db
    .query("transactions")
    .withIndex("by_public_transaction_id", (q) =>
      q.eq("publicTransactionId", args.transactionId),
    )
    .unique();

  if (byLegacyId && byLegacyId.teamId === args.teamId) {
    return byLegacyId;
  }

  try {
    const byDocId = await ctx.db.get(
      args.transactionId as Id<"transactions">,
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

function getTransactionTagSortFields(transaction: Pick<Doc<"transactions">, "date">) {
  return {
    transactionDate: transaction.date,
  };
}

function serializeTransactionTagAssignment(
  teamId: string,
  assignment: {
    _id: string;
    publicTransactionTagId?: string;
    transactionId: string;
    tagId: string;
    createdAt: string;
    updatedAt: string;
  },
  tag: TagRecord,
) {
  const externalTagId = tag.publicTagId ?? tag._id;

  return {
    id: assignment.publicTransactionTagId ?? assignment._id,
    transactionId: assignment.transactionId,
    tagId: assignment.tagId,
    teamId,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
    tag: {
      id: externalTagId,
      name: tag.name,
    },
  };
}

async function getTeamOrThrow(
  ctx: TransactionTagCtx,
  teamId: string,
) {
  const team = await getTeamByPublicTeamId(ctx, teamId);

  if (!team) {
    throw new ConvexError("Convex transaction tag team not found");
  }

  return team;
}

async function getTagOrThrow(
  ctx: TransactionTagCtx,
  args: {
    teamId: string;
    tagId: string;
  },
) {
  const team = await getTeamOrThrow(ctx, args.teamId);
  const tag = await ctx.db
    .query("tags")
    .withIndex("by_public_tag_id", (q) => q.eq("publicTagId", args.tagId))
    .unique();

  if (!tag || tag.teamId !== team._id) {
    throw new ConvexError("Convex transaction tag target not found");
  }

  return { team, tag };
}

async function hydrateAssignments(
  ctx: TransactionTagCtx,
  teamId: string,
  assignments: Array<{
    _id: string;
    publicTransactionTagId?: string;
    transactionId: string;
    tagId: string;
    createdAt: string;
    updatedAt: string;
  }>,
) {
  if (assignments.length === 0) {
    return [];
  }

  const tags = await Promise.all(
    [...new Set(assignments.map((assignment) => assignment.tagId))].map(
      (tagId) =>
        ctx.db
          .query("tags")
          .withIndex("by_public_tag_id", (q) => q.eq("publicTagId", tagId))
          .unique(),
    ),
  );
  const tagById = new Map(
    tags
      .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag))
      .map((tag) => [tag.publicTagId ?? tag._id, tag]),
  );

  return assignments
    .map((assignment) => {
      const tag = tagById.get(assignment.tagId);

      if (!tag) {
        return null;
      }

      return serializeTransactionTagAssignment(
        teamId,
        assignment,
        tag,
      );
    })
    .filter((assignment): assignment is NonNullable<typeof assignment> =>
      Boolean(assignment),
    );
}

async function upsertAssignment(
  ctx: MutationCtx,
  args: {
    teamId: string;
    transactionId: string;
    tagId: string;
  },
) {
  const { team, tag } = await getTagOrThrow(ctx, args);
  const transaction = await getTransactionForTeamByExternalId(ctx, {
    teamId: team._id,
    transactionId: args.transactionId,
  });

  if (!transaction) {
    throw new ConvexError("Convex transaction tag target not found");
  }

  const existing = await ctx.db
    .query("transactionTags")
    .withIndex("by_team_transaction_tag", (q) =>
      q
        .eq("teamId", team._id)
        .eq("transactionId", args.transactionId)
        .eq("tagId", args.tagId),
    )
    .unique();

  if (existing) {
    return serializeTransactionTagAssignment(args.teamId, existing, tag);
  }

  const timestamp = nowIso();
  const insertedId = await ctx.db.insert("transactionTags", {
    publicTransactionTagId: crypto.randomUUID(),
    teamId: team._id,
    transactionId: args.transactionId,
    tagId: args.tagId,
    ...getTransactionTagSortFields(transaction),
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const inserted = await ctx.db.get(insertedId);

  if (!inserted) {
    throw new ConvexError("Failed to create transaction tag");
  }

  return serializeTransactionTagAssignment(args.teamId, inserted, tag);
}

export const serviceGetTransactionTagAssignmentsForTransactionIds = query({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    transactionIds: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.transactionIds.length === 0) {
      return [];
    }

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team) {
      return [];
    }

    const assignments = await Promise.all(
      [...new Set(args.transactionIds)].map((transactionId) =>
        ctx.db
          .query("transactionTags")
          .withIndex("by_team_and_transaction", (q) =>
            q.eq("teamId", team._id).eq("transactionId", transactionId),
          )
          .collect(),
      ),
    );

    return hydrateAssignments(ctx, args.teamId, assignments.flat());
  },
});

export const serviceGetTaggedTransactionIds = query({
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

    const assignments = await ctx.db
      .query("transactionTags")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect();

    return [...new Set(assignments.map((assignment) => assignment.transactionId))];
  },
});

export const serviceRebuildTransactionTagSortFields = mutation({
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
      throw new ConvexError("Convex transaction tag team not found");
    }

    const results = [];

    for (const team of validTeams) {
      const assignments = await ctx.db
        .query("transactionTags")
        .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
        .collect();
      let updatedAssignmentCount = 0;
      let deletedAssignmentCount = 0;

      for (const assignment of assignments) {
        const transaction = await getTransactionForTeamByExternalId(ctx, {
          teamId: team._id,
          transactionId: assignment.transactionId,
        });

        if (!transaction) {
          await ctx.db.delete(assignment._id);
          deletedAssignmentCount += 1;
          continue;
        }

        const canonicalTransactionId =
          transaction.publicTransactionId ?? transaction._id;
        const sortFields = getTransactionTagSortFields(transaction);

        if (
          assignment.transactionId === canonicalTransactionId &&
          assignment.transactionDate === sortFields.transactionDate
        ) {
          continue;
        }

        await ctx.db.patch(assignment._id, {
          transactionId: canonicalTransactionId,
          ...sortFields,
        });
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

export const serviceCreateTransactionTag = mutation({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    transactionId: v.string(),
    tagId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);
    return upsertAssignment(ctx, args);
  },
});

export const serviceDeleteTransactionTag = mutation({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    transactionId: v.string(),
    tagId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team) {
      return null;
    }

    const existing = await ctx.db
      .query("transactionTags")
      .withIndex("by_team_transaction_tag", (q) =>
        q
          .eq("teamId", team._id)
          .eq("transactionId", args.transactionId)
          .eq("tagId", args.tagId),
      )
      .unique();

    if (!existing) {
      return null;
    }

    await ctx.db.delete(existing._id);

    return { id: existing.publicTransactionTagId ?? existing._id };
  },
});

export const serviceAddTransactionTagToTransactions = mutation({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    transactionIds: v.array(v.string()),
    tagId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const assignments = await Promise.all(
      [...new Set(args.transactionIds)].map((transactionId) =>
        upsertAssignment(ctx, {
          teamId: args.teamId,
          transactionId,
          tagId: args.tagId,
        }),
      ),
    );

    return assignments;
  },
});

export const serviceDeleteTransactionTagsForTag = mutation({
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
      .query("transactionTags")
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

export const serviceDeleteTransactionTagsForTransactionIds = mutation({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    transactionIds: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team || args.transactionIds.length === 0) {
      return { transactionIds: [...new Set(args.transactionIds)] };
    }

    for (const transactionId of [...new Set(args.transactionIds)]) {
      const assignments = await ctx.db
        .query("transactionTags")
        .withIndex("by_team_and_transaction", (q) =>
          q.eq("teamId", team._id).eq("transactionId", transactionId),
        )
        .collect();

      for (const assignment of assignments) {
        await ctx.db.delete(assignment._id);
      }
    }

    return { transactionIds: [...new Set(args.transactionIds)] };
  },
});
