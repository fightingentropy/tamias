import { ConvexError, v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";
import { nowIso } from "../../../packages/domain/src/identity";

function serializeDocumentTag(
  teamId: string,
  record: {
    _id: string;
    publicDocumentTagId?: string;
    name: string;
    slug: string;
    createdAt: string;
  },
) {
  return {
    id: record.publicDocumentTagId ?? record._id,
    teamId,
    name: record.name,
    slug: record.slug,
    createdAt: record.createdAt,
  };
}

function serializeDocumentTagAssignment(
  teamId: string,
  assignment: {
    documentId: string;
    tagId: string;
    createdAt: string;
    updatedAt: string;
  },
  tag: {
    _id: string;
    publicDocumentTagId?: string;
    name: string;
    slug: string;
  },
) {
  const tagId = tag.publicDocumentTagId ?? tag._id;

  return {
    documentId: assignment.documentId,
    tagId,
    teamId,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
    documentTag: {
      id: tagId,
      name: tag.name,
      slug: tag.slug,
    },
  };
}

type DocumentTagContext = QueryCtx | MutationCtx;

type SerializedDocumentTagAssignment = ReturnType<
  typeof serializeDocumentTagAssignment
>;

async function getDocumentTagByExternalId(
  ctx: DocumentTagContext,
  args: { teamId: string; tagId: string },
) {
  const team = await getTeamByPublicTeamId(ctx, args.teamId);

  if (!team) {
    return { team: null, tag: null };
  }

  const tag = await ctx.db
    .query("documentTags")
    .withIndex("by_public_document_tag_id", (q) =>
      q.eq("publicDocumentTagId", args.tagId),
    )
    .unique();

  if (!tag || tag.teamId !== team._id) {
    return { team, tag: null };
  }

  return { team, tag };
}

async function upsertDocumentTagAssignmentRecord(
  ctx: MutationCtx,
  args: {
    teamId: string;
    documentId: string;
    tagId: string;
  },
): Promise<SerializedDocumentTagAssignment> {
  const { team, tag } = await getDocumentTagByExternalId(ctx, {
    teamId: args.teamId,
    tagId: args.tagId,
  });

  if (!team || !tag) {
    throw new ConvexError("Convex document tag assignment target not found");
  }

  const existing = await ctx.db
    .query("documentTagAssignments")
    .withIndex("by_team_document_tag", (q) =>
      q
        .eq("teamId", team._id)
        .eq("documentId", args.documentId)
        .eq("tagId", args.tagId),
    )
    .unique();

  if (existing) {
    return serializeDocumentTagAssignment(args.teamId, existing, tag);
  }

  const timestamp = nowIso();
  const insertedId = await ctx.db.insert("documentTagAssignments", {
    teamId: team._id,
    documentId: args.documentId,
    tagId: args.tagId,
    documentTagId: tag._id,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const inserted = await ctx.db.get(insertedId);

  if (!inserted) {
    throw new ConvexError("Failed to create document tag assignment");
  }

  return serializeDocumentTagAssignment(args.teamId, inserted, tag);
}

export const serviceGetDocumentTags = query({
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

    const tags = await ctx.db
      .query("documentTags")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect();

    return tags
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((tag) => serializeDocumentTag(args.teamId, tag));
  },
});

export const serviceCreateDocumentTag = mutation({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    name: v.string(),
    slug: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team) {
      throw new ConvexError("Convex document tag team not found");
    }

    const existing = await ctx.db
      .query("documentTags")
      .withIndex("by_team_and_slug", (q) =>
        q.eq("teamId", team._id).eq("slug", args.slug),
      )
      .unique();

    if (existing) {
      return serializeDocumentTag(args.teamId, existing);
    }

    const timestamp = nowIso();
    const insertedId = await ctx.db.insert("documentTags", {
      publicDocumentTagId: crypto.randomUUID(),
      teamId: team._id,
      name: args.name,
      slug: args.slug,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError("Failed to create document tag");
    }

    return serializeDocumentTag(args.teamId, inserted);
  },
});

export const serviceDeleteDocumentTag = mutation({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    documentTagId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const { team, tag } = await getDocumentTagByExternalId(ctx, {
      teamId: args.teamId,
      tagId: args.documentTagId,
    });

    if (!team || !tag) {
      return null;
    }

    const assignments = await ctx.db
      .query("documentTagAssignments")
      .withIndex("by_team_and_tag", (q) =>
        q.eq("teamId", team._id).eq("tagId", args.documentTagId),
      )
      .collect();

    for (const assignment of assignments) {
      await ctx.db.delete(assignment._id);
    }

    await ctx.db.delete(tag._id);

    return { id: args.documentTagId };
  },
});

export const serviceUpsertDocumentTags = mutation({
  args: {
    serviceKey: v.string(),
    tags: v.array(
      v.object({
        teamId: v.string(),
        name: v.string(),
        slug: v.string(),
      }),
    ),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const timestamp = nowIso();
    const teamCache = new Map<string, Awaited<ReturnType<typeof getTeamByPublicTeamId>>>();
    const results: { id: string; slug: string }[] = [];

    for (const tagInput of args.tags) {
      let team = teamCache.get(tagInput.teamId);
      if (!team) {
        team = await getTeamByPublicTeamId(ctx, tagInput.teamId);
        teamCache.set(tagInput.teamId, team);
      }

      if (!team) {
        throw new ConvexError("Convex document tag team not found");
      }

      const existing = await ctx.db
        .query("documentTags")
        .withIndex("by_team_and_slug", (q) =>
          q.eq("teamId", team._id).eq("slug", tagInput.slug),
        )
        .unique();

      if (existing) {
        if (existing.name !== tagInput.name) {
          await ctx.db.patch(existing._id, {
            name: tagInput.name,
            updatedAt: timestamp,
          });
        }

        results.push({
          id: existing.publicDocumentTagId ?? existing._id,
          slug: existing.slug,
        });
        continue;
      }

      const insertedId = await ctx.db.insert("documentTags", {
        publicDocumentTagId: crypto.randomUUID(),
        teamId: team._id,
        name: tagInput.name,
        slug: tagInput.slug,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      const inserted = await ctx.db.get(insertedId);

      if (!inserted) {
        throw new ConvexError("Failed to upsert document tag");
      }

      results.push({
        id: inserted.publicDocumentTagId ?? inserted._id,
        slug: inserted.slug,
      });
    }

    return results;
  },
});

export const serviceCreateDocumentTagAssignment = mutation({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    documentId: v.string(),
    tagId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);
    return upsertDocumentTagAssignmentRecord(ctx, {
      teamId: args.teamId,
      documentId: args.documentId,
      tagId: args.tagId,
    });
  },
});

export const serviceDeleteDocumentTagAssignment = mutation({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    documentId: v.string(),
    tagId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const { team, tag } = await getDocumentTagByExternalId(ctx, {
      teamId: args.teamId,
      tagId: args.tagId,
    });

    if (!team || !tag) {
      return null;
    }

    const existing = await ctx.db
      .query("documentTagAssignments")
      .withIndex("by_team_document_tag", (q) =>
        q
          .eq("teamId", team._id)
          .eq("documentId", args.documentId)
          .eq("tagId", args.tagId),
      )
      .unique();

    if (!existing) {
      return null;
    }

    const serialized = serializeDocumentTagAssignment(
      args.teamId,
      existing,
      tag,
    );

    await ctx.db.delete(existing._id);

    return serialized;
  },
});

export const serviceUpsertDocumentTagAssignments = mutation({
  args: {
    serviceKey: v.string(),
    assignments: v.array(
      v.object({
        teamId: v.string(),
        documentId: v.string(),
        tagId: v.string(),
      }),
    ),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const results: SerializedDocumentTagAssignment[] = [];

    for (const assignmentInput of args.assignments) {
      const result = await upsertDocumentTagAssignmentRecord(ctx, {
        teamId: assignmentInput.teamId,
        documentId: assignmentInput.documentId,
        tagId: assignmentInput.tagId,
      });

      results.push(result);
    }

    return results;
  },
});

export const serviceGetDocumentTagAssignmentsForDocumentIds = query({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    documentIds: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team || args.documentIds.length === 0) {
      return [];
    }

    const assignmentsByDocument = await Promise.all(
      args.documentIds.map((documentId) =>
        ctx.db
          .query("documentTagAssignments")
          .withIndex("by_team_and_document", (q) =>
            q.eq("teamId", team._id).eq("documentId", documentId),
          )
          .collect(),
      ),
    );

    const results: {
      documentId: string;
      tagId: string;
      teamId: string;
      createdAt: string;
      updatedAt: string;
      documentTag: {
        id: string;
        name: string;
        slug: string;
      };
    }[] = [];

    for (const assignments of assignmentsByDocument) {
      for (const assignment of assignments) {
        const tag = await ctx.db.get(assignment.documentTagId);
        if (!tag) {
          continue;
        }

        results.push(
          serializeDocumentTagAssignment(args.teamId, assignment, tag),
        );
      }
    }

    return results;
  },
});

export const serviceGetDocumentIdsForTagIds = query({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    tagIds: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team || args.tagIds.length === 0) {
      return [];
    }

    const assignmentsByTag = await Promise.all(
      args.tagIds.map((tagId) =>
        ctx.db
          .query("documentTagAssignments")
          .withIndex("by_team_and_tag", (q) =>
            q.eq("teamId", team._id).eq("tagId", tagId),
          )
          .collect(),
      ),
    );

    return [...new Set(assignmentsByTag.flat().map((entry) => entry.documentId))];
  },
});
