import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { nowIso } from "../../../packages/domain/src/identity";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";

type DocumentCtx = QueryCtx | MutationCtx;

const documentProcessingStatus = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("completed"),
  v.literal("failed"),
);

const nullableString = v.optional(v.union(v.string(), v.null()));
const documentOrderValidator = v.union(v.literal("asc"), v.literal("desc"));

const documentUpsertInput = v.object({
  teamId: v.string(),
  id: v.optional(v.string()),
  name: v.string(),
  createdAt: v.optional(v.string()),
  updatedAt: v.optional(v.string()),
  metadata: v.optional(v.any()),
  pathTokens: v.optional(v.array(v.string())),
  parentId: nullableString,
  objectId: nullableString,
  ownerId: nullableString,
  tag: nullableString,
  title: nullableString,
  body: nullableString,
  summary: nullableString,
  content: nullableString,
  date: nullableString,
  language: nullableString,
  processingStatus: v.optional(documentProcessingStatus),
});

function publicDocumentId(
  document: Pick<Doc<"documents">, "_id" | "publicDocumentId">,
) {
  return document.publicDocumentId ?? document._id;
}

function serializeDocument(
  teamId: string,
  document: Doc<"documents">,
) {
  return {
    id: publicDocumentId(document),
    teamId,
    name: document.name,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    metadata: document.metadata ?? null,
    pathTokens: document.pathTokens,
    parentId: document.parentId ?? null,
    objectId: document.objectId ?? null,
    ownerId: document.ownerUserId ?? null,
    tag: document.tag ?? null,
    title: document.title ?? null,
    body: document.body ?? null,
    summary: document.summary ?? null,
    content: document.content ?? null,
    date: document.date ?? null,
    language: document.language ?? null,
    processingStatus: document.processingStatus,
  };
}

async function getDocumentByPublicId(
  ctx: DocumentCtx,
  args: {
    documentId: string;
    teamId?: Id<"teams">;
  },
) {
  const byLegacyId = await ctx.db
    .query("documents")
    .withIndex("by_public_document_id", (q) =>
      q.eq("publicDocumentId", args.documentId),
    )
    .unique();

  if (byLegacyId && (!args.teamId || byLegacyId.teamId === args.teamId)) {
    return byLegacyId;
  }

  try {
    const byDocId = await ctx.db.get(args.documentId as Id<"documents">);

    if (byDocId && (!args.teamId || byDocId.teamId === args.teamId)) {
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

async function getDocumentByName(
  ctx: DocumentCtx,
  args: {
    teamId: Id<"teams">;
    name: string;
  },
) {
  return ctx.db
    .query("documents")
    .withIndex("by_team_and_name", (q) =>
      q.eq("teamId", args.teamId).eq("name", args.name),
    )
    .unique();
}

export const serviceGetDocuments = query({
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

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_team_and_created_at", (q) => q.eq("teamId", team._id))
      .collect();

    return documents
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((document) => serializeDocument(args.teamId, document));
  },
});

export const serviceListDocumentsPage = query({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    order: v.optional(documentOrderValidator),
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

    const result = await ctx.db
      .query("documents")
      .withIndex("by_team_and_created_at", (q) => q.eq("teamId", team._id))
      .order(args.order ?? "desc")
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: result.page.map((document) =>
        serializeDocument(args.teamId, document),
      ),
    };
  },
});

export const serviceGetDocumentsByIds = query({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    documentIds: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.documentIds.length === 0) {
      return [];
    }

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team) {
      return [];
    }

    const documents = await Promise.all(
      [...new Set(args.documentIds)].map((documentId) =>
        getDocumentByPublicId(ctx, {
          documentId,
          teamId: team._id,
        }),
      ),
    );

    return documents
      .filter((document): document is NonNullable<typeof document> => document !== null)
      .map((document) => serializeDocument(args.teamId, document));
  },
});

export const serviceGetDocumentById = query({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    documentId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team) {
      return null;
    }

    const document = await getDocumentByPublicId(ctx, {
      documentId: args.documentId,
      teamId: team._id,
    });

    return document ? serializeDocument(args.teamId, document) : null;
  },
});

export const serviceGetDocumentByName = query({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    name: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team) {
      return null;
    }

    const document = await getDocumentByName(ctx, {
      teamId: team._id,
      name: args.name,
    });

    return document ? serializeDocument(args.teamId, document) : null;
  },
});

export const serviceUpsertDocuments = mutation({
  args: {
    serviceKey: v.string(),
    documents: v.array(documentUpsertInput),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const teamsById = new Map<string, Doc<"teams">>();
    const results: Array<ReturnType<typeof serializeDocument>> = [];

    for (const input of args.documents) {
      let team = teamsById.get(input.teamId);

      if (!team) {
        const resolvedTeam = await getTeamByPublicTeamId(ctx, input.teamId);

        if (!resolvedTeam) {
          throw new ConvexError("Convex document team not found");
        }

        team = resolvedTeam;
        teamsById.set(input.teamId, team);
      }

      const existing =
        (input.id
          ? await getDocumentByPublicId(ctx, {
              documentId: input.id,
              teamId: team._id,
            })
          : null) ??
        (await getDocumentByName(ctx, {
          teamId: team._id,
          name: input.name,
        }));

      const patch = {
        name: input.name,
        updatedAt: input.updatedAt ?? nowIso(),
        metadata: input.metadata,
        pathTokens: input.pathTokens ?? input.name.split("/").filter(Boolean),
        parentId: input.parentId ?? undefined,
        objectId: input.objectId ?? undefined,
        ownerUserId: input.ownerId ?? undefined,
        tag: input.tag ?? undefined,
        title: input.title ?? undefined,
        body: input.body ?? undefined,
        summary: input.summary ?? undefined,
        content: input.content ?? undefined,
        date: input.date ?? undefined,
        language: input.language ?? undefined,
        processingStatus: input.processingStatus ?? "pending",
      };

      if (existing) {
        await ctx.db.patch(existing._id, patch);

        const updated = await ctx.db.get(existing._id);

        if (updated) {
          results.push(serializeDocument(input.teamId, updated));
        }

        continue;
      }

      const insertedId = await ctx.db.insert("documents", {
        publicDocumentId: input.id ?? crypto.randomUUID(),
        teamId: team._id,
        name: input.name,
        createdAt: input.createdAt ?? nowIso(),
        updatedAt: patch.updatedAt,
        metadata: patch.metadata,
        pathTokens: patch.pathTokens,
        parentId: patch.parentId,
        objectId: patch.objectId,
        ownerUserId: patch.ownerUserId,
        tag: patch.tag,
        title: patch.title,
        body: patch.body,
        summary: patch.summary,
        content: patch.content,
        date: patch.date,
        language: patch.language,
        processingStatus: patch.processingStatus,
      });

      const inserted = await ctx.db.get(insertedId);

      if (!inserted) {
        throw new ConvexError("Failed to create document");
      }

      results.push(serializeDocument(input.teamId, inserted));
    }

    return results;
  },
});

export const serviceDeleteDocument = mutation({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    documentId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team) {
      return null;
    }

    const document = await getDocumentByPublicId(ctx, {
      documentId: args.documentId,
      teamId: team._id,
    });

    if (!document) {
      return null;
    }

    await ctx.db.delete(document._id);

    return serializeDocument(args.teamId, document);
  },
});

export const serviceUpdateDocumentsStatusByNames = mutation({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    names: v.array(v.string()),
    processingStatus: documentProcessingStatus,
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team) {
      return [];
    }

    const results: Array<ReturnType<typeof serializeDocument>> = [];

    for (const name of args.names) {
      const document = await getDocumentByName(ctx, {
        teamId: team._id,
        name,
      });

      if (!document) {
        continue;
      }

      await ctx.db.patch(document._id, {
        processingStatus: args.processingStatus,
        updatedAt: nowIso(),
      });

      const updated = await ctx.db.get(document._id);

      if (updated) {
        results.push(serializeDocument(args.teamId, updated));
      }
    }

    return results;
  },
});

export const serviceUpdateDocumentByName = mutation({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    name: v.string(),
    title: nullableString,
    summary: nullableString,
    content: nullableString,
    body: nullableString,
    tag: nullableString,
    date: nullableString,
    language: nullableString,
    processingStatus: v.optional(documentProcessingStatus),
    metadata: v.optional(v.any()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team) {
      return [];
    }

    const document = await getDocumentByName(ctx, {
      teamId: team._id,
      name: args.name,
    });

    if (!document) {
      return [];
    }

    await ctx.db.patch(document._id, {
      title: args.title ?? undefined,
      summary: args.summary ?? undefined,
      content: args.content ?? undefined,
      body: args.body ?? undefined,
      tag: args.tag ?? undefined,
      date: args.date ?? undefined,
      language: args.language ?? undefined,
      processingStatus: args.processingStatus ?? document.processingStatus,
      metadata: args.metadata ?? document.metadata,
      updatedAt: nowIso(),
    });

    const updated = await ctx.db.get(document._id);

    return updated ? [serializeDocument(args.teamId, updated)] : [];
  },
});

export const serviceUpdateDocumentProcessingStatus = mutation({
  args: {
    serviceKey: v.string(),
    documentId: v.string(),
    processingStatus: documentProcessingStatus,
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const document = await getDocumentByPublicId(ctx, {
      documentId: args.documentId,
    });

    if (!document) {
      return [];
    }

    await ctx.db.patch(document._id, {
      processingStatus: args.processingStatus,
      updatedAt: nowIso(),
    });

    return [{ id: publicDocumentId(document) }];
  },
});
