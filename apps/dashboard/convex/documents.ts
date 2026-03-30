import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { nowIso } from "../../../packages/domain/src/identity";
import { buildSearchIndexText, buildSearchQuery } from "../../../packages/domain/src/text-search";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";

type DocumentCtx = QueryCtx | MutationCtx;
type TaggedDocumentCursor = {
  createdAt: string;
  documentId: string;
};

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

const DOCUMENT_SEARCH_SNIPPET_LIMIT = 4000;

function getDocumentSearchSnippet(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  return value.slice(0, DOCUMENT_SEARCH_SNIPPET_LIMIT);
}

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

function getDocumentSearchText(
  document: {
    name: string;
    pathTokens?: string[];
    title?: string | null;
    summary?: string | null;
    body?: string | null;
    content?: string | null;
    tag?: string | null;
    language?: string | null;
  },
) {
  return (
    buildSearchIndexText([
      document.name,
      document.pathTokens?.join(" "),
      document.title,
      getDocumentSearchSnippet(document.summary),
      getDocumentSearchSnippet(document.body),
      getDocumentSearchSnippet(document.content),
      document.tag,
      document.language,
    ]) || undefined
  );
}

function getDocumentTagAssignmentSortFields(
  document: Pick<Doc<"documents">, "createdAt" | "date">,
) {
  return {
    documentCreatedAt: document.createdAt,
    documentDate: document.date ?? undefined,
  };
}

function encodeTaggedDocumentCursor(cursor: TaggedDocumentCursor) {
  return btoa(JSON.stringify(cursor))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodeTaggedDocumentCursor(
  cursor: string | null | undefined,
): TaggedDocumentCursor | null {
  if (!cursor) {
    return null;
  }

  try {
    const normalizedCursor = cursor.replace(/-/g, "+").replace(/_/g, "/");
    const paddedCursor =
      normalizedCursor + "=".repeat((4 - (normalizedCursor.length % 4)) % 4);
    const parsed = JSON.parse(atob(paddedCursor)) as Partial<TaggedDocumentCursor>;

    if (
      typeof parsed.createdAt !== "string" ||
      typeof parsed.documentId !== "string"
    ) {
      throw new ConvexError("Invalid tagged document cursor");
    }

    return {
      createdAt: parsed.createdAt,
      documentId: parsed.documentId,
    };
  } catch {
    throw new ConvexError("Invalid tagged document cursor");
  }
}

function compareTaggedDocumentRows(
  left: Pick<Doc<"documentTagAssignments">, "documentCreatedAt" | "documentId">,
  right: Pick<Doc<"documentTagAssignments">, "documentCreatedAt" | "documentId">,
  order: "asc" | "desc",
) {
  const createdAtComparison =
    left.documentCreatedAt!.localeCompare(right.documentCreatedAt!);

  if (createdAtComparison !== 0) {
    return order === "asc" ? createdAtComparison : -createdAtComparison;
  }

  const documentIdComparison = left.documentId.localeCompare(right.documentId);
  return order === "asc" ? documentIdComparison : -documentIdComparison;
}

function isTaggedDocumentRowPastCursor(
  assignment: Pick<Doc<"documentTagAssignments">, "documentCreatedAt" | "documentId">,
  cursor: TaggedDocumentCursor | null,
  order: "asc" | "desc",
) {
  if (!cursor || !assignment.documentCreatedAt) {
    return false;
  }

  if (order === "asc") {
    return (
      assignment.documentCreatedAt < cursor.createdAt ||
      (assignment.documentCreatedAt === cursor.createdAt &&
        assignment.documentId <= cursor.documentId)
    );
  }

  return (
    assignment.documentCreatedAt > cursor.createdAt ||
    (assignment.documentCreatedAt === cursor.createdAt &&
      assignment.documentId >= cursor.documentId)
  );
}

function matchesTaggedDocumentDateRange(
  assignment: Pick<Doc<"documentTagAssignments">, "documentDate">,
  start: string | null,
  end: string | null,
) {
  if (!(start && end)) {
    return true;
  }

  if (!assignment.documentDate) {
    return false;
  }

  return assignment.documentDate >= start && assignment.documentDate <= end;
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

async function syncDocumentTagAssignmentSortFields(
  ctx: MutationCtx,
  args: {
    teamId: Id<"teams">;
    documentId: string;
    document: Pick<Doc<"documents">, "createdAt" | "date">;
  },
) {
  const assignments = await ctx.db
    .query("documentTagAssignments")
    .withIndex("by_team_and_document", (q) =>
      q.eq("teamId", args.teamId).eq("documentId", args.documentId),
    )
    .collect();

  if (assignments.length === 0) {
    return;
  }

  const sortFields = getDocumentTagAssignmentSortFields(args.document);

  await Promise.all(
    assignments.map((assignment) => {
      if (
        assignment.documentCreatedAt === sortFields.documentCreatedAt &&
        assignment.documentDate === sortFields.documentDate
      ) {
        return Promise.resolve();
      }

      return ctx.db.patch(assignment._id, sortFields);
    }),
  );
}

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

export const serviceSearchDocuments = query({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.teamId);
    const searchQuery = buildSearchQuery(args.query);

    if (!team || searchQuery.length === 0) {
      return [];
    }

    const documents = await ctx.db
      .query("documents")
      .withSearchIndex("search_by_team", (q) =>
        q.search("searchText", searchQuery).eq("teamId", team._id),
      )
      .take(Math.max(1, Math.min((args.limit ?? 100) * 4, 400)));

    return documents
      .slice(0, args.limit ?? documents.length)
      .map((document) => serializeDocument(args.teamId, document));
  },
});

export const serviceListTaggedDocumentsPage = query({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    tagIds: v.array(v.string()),
    cursor: nullableString,
    pageSize: v.number(),
    order: v.optional(documentOrderValidator),
    start: nullableString,
    end: nullableString,
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
    const cursor = decodeTaggedDocumentCursor(args.cursor ?? null);
    const tagIds = [...new Set(args.tagIds)];
    let takeCount = Math.max(pageSize * 4, 50);
    let mayHaveMoreRows = false;
    let lastScannedRow: Pick<
      Doc<"documentTagAssignments">,
      "documentId" | "documentCreatedAt" | "documentDate"
    > | null = null;
    let taggedRows: Array<
      Pick<Doc<"documentTagAssignments">, "documentId" | "documentCreatedAt" | "documentDate">
    > = [];

    while (true) {
      const rowsByTag = await Promise.all(
        tagIds.map((tagId) =>
          ctx.db
            .query("documentTagAssignments")
            .withIndex("by_team_tag_and_document_created_at", (range) => {
              const scoped = range.eq("teamId", team._id).eq("tagId", tagId);

              if (cursor?.createdAt) {
                return order === "asc"
                  ? scoped.gte("documentCreatedAt", cursor.createdAt)
                  : scoped.lte("documentCreatedAt", cursor.createdAt);
              }

              return scoped;
            })
            .order(order)
            .take(takeCount),
        ),
      );

      mayHaveMoreRows = rowsByTag.some((rows) => rows.length === takeCount);
      const candidateRows = [
        ...new Map(
          rowsByTag
            .flat()
            .filter(
              (assignment) =>
                assignment.documentCreatedAt &&
                !isTaggedDocumentRowPastCursor(assignment, cursor, order),
            )
            .map((assignment) => [assignment.documentId, assignment]),
        ).values(),
      ].sort((left, right) => compareTaggedDocumentRows(left, right, order));
      lastScannedRow = candidateRows.at(-1) ?? null;
      taggedRows = candidateRows.filter((assignment) =>
        matchesTaggedDocumentDateRange(
          assignment,
          args.start ?? null,
          args.end ?? null,
        ),
      );

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
      row: Pick<Doc<"documentTagAssignments">, "documentId" | "documentCreatedAt" | "documentDate">;
      document: ReturnType<typeof serializeDocument>;
    }> = [];

    for (const row of taggedRows) {
      const document = await getDocumentByPublicId(ctx, {
        documentId: row.documentId,
        teamId: team._id,
      });

      if (!document) {
        continue;
      }

      serializedRows.push({
        row,
        document: serializeDocument(args.teamId, document),
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
      page: serializedRows.map((entry) => entry.document),
      isDone: !hasNextPage,
      continueCursor:
        hasNextPage && nextCursorRow?.documentCreatedAt
          ? encodeTaggedDocumentCursor({
              createdAt: nextCursorRow.documentCreatedAt,
              documentId: nextCursorRow.documentId,
            })
          : null,
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
        searchText: getDocumentSearchText({
          name: input.name,
          pathTokens: input.pathTokens ?? input.name.split("/").filter(Boolean),
          title: input.title ?? undefined,
          summary: input.summary ?? undefined,
          body: input.body ?? undefined,
          content: input.content ?? undefined,
          tag: input.tag ?? undefined,
          language: input.language ?? undefined,
        }),
        processingStatus: input.processingStatus ?? "pending",
      };

      if (existing) {
        await ctx.db.patch(existing._id, patch);

        const updated = await ctx.db.get(existing._id);

        if (updated) {
          await syncDocumentTagAssignmentSortFields(ctx, {
            teamId: team._id,
            documentId: publicDocumentId(updated),
            document: updated,
          });
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
        searchText: patch.searchText,
        processingStatus: patch.processingStatus,
      });

      const inserted = await ctx.db.get(insertedId);

      if (!inserted) {
        throw new ConvexError("Failed to create document");
      }

      await syncDocumentTagAssignmentSortFields(ctx, {
        teamId: team._id,
        documentId: publicDocumentId(inserted),
        document: inserted,
      });
      results.push(serializeDocument(input.teamId, inserted));
    }

    return results;
  },
});

export const serviceRebuildDocumentSearchTexts = mutation({
  args: {
    serviceKey: v.string(),
    teamId: nullableString,
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
      throw new ConvexError("Convex document team not found");
    }

    const results = [];

    for (const team of validTeams) {
      const documents = await ctx.db
        .query("documents")
        .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
        .collect();
      let updatedDocumentCount = 0;

      for (const document of documents) {
        const searchText = getDocumentSearchText(document);

        if (document.searchText === searchText) {
          continue;
        }

        await ctx.db.patch(document._id, {
          searchText,
        });
        updatedDocumentCount += 1;
      }

      results.push({
        teamId: team.publicTeamId ?? team._id,
        documentCount: documents.length,
        updatedDocumentCount,
      });
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
      searchText: getDocumentSearchText({
        name: document.name,
        pathTokens: document.pathTokens,
        title: args.title ?? document.title,
        summary: args.summary ?? document.summary,
        body: args.body ?? document.body,
        content: args.content ?? document.content,
        tag: args.tag ?? document.tag,
        language: args.language ?? document.language,
      }),
      processingStatus: args.processingStatus ?? document.processingStatus,
      metadata: args.metadata ?? document.metadata,
      updatedAt: nowIso(),
    });

    const updated = await ctx.db.get(document._id);

    if (!updated) {
      return [];
    }

    await syncDocumentTagAssignmentSortFields(ctx, {
      teamId: team._id,
      documentId: publicDocumentId(updated),
      document: updated,
    });

    return [serializeDocument(args.teamId, updated)];
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
