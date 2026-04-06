import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { nowIso } from "../../packages/domain/src/identity";
import { buildSearchIndexText } from "../../packages/domain/src/text-search";
import {
  getAppUserByAuthUserId,
  getTeamByPublicTeamId,
  publicUserId,
} from "./lib/identity";

const DOCUMENT_SEARCH_SNIPPET_LIMIT = 4000;

function getDocumentSearchSnippet(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  return value.slice(0, DOCUMENT_SEARCH_SNIPPET_LIMIT);
}

function getVaultDocumentSearchText(args: {
  path: string;
  pathTokens: string[];
  tag?: string | null;
  title?: string | null;
  summary?: string | null;
  body?: string | null;
  content?: string | null;
  language?: string | null;
}) {
  return (
    buildSearchIndexText([
      args.path,
      args.pathTokens.join(" "),
      args.title,
      getDocumentSearchSnippet(args.summary),
      getDocumentSearchSnippet(args.body),
      getDocumentSearchSnippet(args.content),
      args.tag,
      args.language,
    ]) || undefined
  );
}

function hasInternalAccess(internalKey?: string) {
  return Boolean(
    internalKey &&
      process.env.INTERNAL_API_KEY &&
      internalKey === process.env.INTERNAL_API_KEY,
  );
}

async function requireUploadAccess(
  ctx: any,
  internalKey?: string,
) {
  const userId = await getAuthUserId(ctx);

  if (userId || hasInternalAccess(internalKey)) {
    return userId ?? undefined;
  }

  throw new ConvexError("Unauthorized");
}

function mergeDocumentMetadata(
  current: unknown,
  args: {
    bucket?: string;
    contentType?: string;
    size?: number;
  },
) {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? { ...(current as Record<string, unknown>) }
      : {};

  return {
    ...base,
    bucket: args.bucket ?? base.bucket,
    mimetype: args.contentType ?? base.mimetype,
    size: args.size ?? base.size,
  };
}

async function syncVaultDocument(
  ctx: any,
  args: {
    path: string;
    pathTokens: string[];
    storageId: string;
    teamId?: string;
    bucket?: string;
    contentType?: string;
    size?: number;
    uploadedBy?: Id<"users">;
  },
) {
  if (args.bucket !== "vault" || !args.teamId) {
    return;
  }

  const team = await getTeamByPublicTeamId(ctx, args.teamId);

  if (!team) {
    throw new ConvexError("Convex document team not found");
  }

  const owner = args.uploadedBy
    ? await getAppUserByAuthUserId(ctx, args.uploadedBy)
    : null;

  const existing = await ctx.db
    .query("documents")
    .withIndex("by_team_and_name", (q: any) =>
      q.eq("teamId", team._id).eq("name", args.path),
    )
    .unique();

  const timestamp = nowIso();
  const metadata = mergeDocumentMetadata(existing?.metadata, {
    bucket: args.bucket,
    contentType: args.contentType,
    size: args.size,
  });
  const searchText = getVaultDocumentSearchText({
    path: args.path,
    pathTokens: args.pathTokens,
  });

  if (existing) {
    const publicDocumentId = existing.publicDocumentId ?? existing._id;
    const assignments = await ctx.db
      .query("documentTagAssignments")
      .withIndex("by_team_and_document", (q: any) =>
        q.eq("teamId", team._id).eq("documentId", publicDocumentId),
      )
      .collect();

    for (const assignment of assignments) {
      await ctx.db.delete(assignment._id);
    }

    await ctx.db.delete(existing._id);

    await ctx.db.insert("documents", {
      publicDocumentId: publicDocumentId,
      teamId: team._id,
      name: args.path,
      createdAt: timestamp,
      updatedAt: timestamp,
      metadata,
      pathTokens: args.pathTokens,
      objectId: args.storageId,
      ownerUserId: publicUserId(owner) ?? undefined,
      ownerAppUserId: owner?._id,
      searchText,
      processingStatus: "pending",
    });

    return;
  }

  await ctx.db.insert("documents", {
    publicDocumentId: crypto.randomUUID(),
    teamId: team._id,
    name: args.path,
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata,
    pathTokens: args.pathTokens,
    objectId: args.storageId,
    ownerUserId: publicUserId(owner) ?? undefined,
    ownerAppUserId: owner?._id,
    searchText,
    processingStatus: "pending",
  });
}

export const generateUploadUrl = mutation({
  args: {
    internalKey: v.optional(v.string()),
  },
  async handler(ctx, args) {
    await requireUploadAccess(ctx, args.internalKey);

    return ctx.storage.generateUploadUrl();
  },
});

export const registerUpload = mutation({
  args: {
    pathTokens: v.array(v.string()),
    storageId: v.id("_storage"),
    teamId: v.optional(v.string()),
    bucket: v.optional(v.string()),
    contentType: v.optional(v.string()),
    size: v.optional(v.number()),
    internalKey: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const uploadedBy = await requireUploadAccess(ctx, args.internalKey);
    const path = args.pathTokens.join("/");

    const existing = await ctx.db
      .query("files")
      .withIndex("by_path", (q) => q.eq("path", path))
      .unique();

    if (existing) {
      if (existing.storageId !== args.storageId) {
        await ctx.storage.delete(existing.storageId);
      }

      await ctx.db.patch(existing._id, {
        pathTokens: args.pathTokens,
        storageId: args.storageId,
        teamId: args.teamId,
        bucket: args.bucket,
        contentType: args.contentType,
        size: args.size,
        uploadedBy,
      });
    } else {
      await ctx.db.insert("files", {
        path,
        pathTokens: args.pathTokens,
        storageId: args.storageId,
        teamId: args.teamId,
        bucket: args.bucket,
        contentType: args.contentType,
        size: args.size,
        uploadedBy,
      });
    }

    await syncVaultDocument(ctx, {
      path,
      pathTokens: args.pathTokens,
      storageId: args.storageId,
      teamId: args.teamId,
      bucket: args.bucket,
      contentType: args.contentType,
      size: args.size,
      uploadedBy,
    });

    const url = await ctx.storage.getUrl(args.storageId);

    return {
      path,
      storageId: args.storageId,
      url,
    };
  },
});

export const getByPath = query({
  args: {
    path: v.string(),
  },
  async handler(ctx, args) {
    return ctx.db
      .query("files")
      .withIndex("by_path", (q) => q.eq("path", args.path))
      .unique();
  },
});

export const getUrlByPath = query({
  args: {
    path: v.string(),
  },
  async handler(ctx, args) {
    const file = await ctx.db
      .query("files")
      .withIndex("by_path", (q) => q.eq("path", args.path))
      .unique();

    if (!file) {
      return null;
    }

    return ctx.storage.getUrl(file.storageId);
  },
});

export const deleteByPath = mutation({
  args: {
    path: v.string(),
    internalKey: v.optional(v.string()),
  },
  async handler(ctx, args) {
    await requireUploadAccess(ctx, args.internalKey);

    const file = await ctx.db
      .query("files")
      .withIndex("by_path", (q) => q.eq("path", args.path))
      .unique();

    if (!file) {
      return false;
    }

    await ctx.storage.delete(file.storageId);
    await ctx.db.delete(file._id);

    const document = await ctx.db
      .query("documents")
      .withIndex("by_name", (q) => q.eq("name", args.path))
      .unique();

    if (document) {
      const publicDocumentId = document.publicDocumentId ?? document._id;
      const assignments = await ctx.db
        .query("documentTagAssignments")
        .withIndex("by_team_and_document", (q) =>
          q.eq("teamId", document.teamId).eq("documentId", publicDocumentId),
        )
        .collect();

      for (const assignment of assignments) {
        await ctx.db.delete(assignment._id);
      }

      await ctx.db.delete(document._id);
    }

    return true;
  },
});
