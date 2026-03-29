import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";
import { nowIso } from "../../../packages/domain/src/identity";

type TransactionAttachmentCtx = QueryCtx | MutationCtx;

const attachmentInputValidator = v.object({
  publicTransactionAttachmentId: v.optional(v.string()),
  transactionId: v.optional(v.union(v.string(), v.null())),
  type: v.string(),
  name: v.string(),
  size: v.number(),
  path: v.array(v.string()),
});

type SerializedTransactionAttachment = {
  id: string;
  teamId: string;
  transactionId: string | null;
  type: string;
  name: string;
  size: number;
  path: string[];
  createdAt: string;
};

type TransactionAttachmentDoc = {
  _id: string;
  publicTransactionAttachmentId?: string;
  teamId: string;
  transactionId?: string;
  type: string;
  name: string;
  size: number;
  path: string[];
  pathKey: string;
  createdAt: string;
};

function pathKeyFromPath(path: string[]) {
  return JSON.stringify(path);
}

function publicTransactionAttachmentId(
  record: Pick<TransactionAttachmentDoc, "_id" | "publicTransactionAttachmentId">,
) {
  return record.publicTransactionAttachmentId ?? record._id;
}

function serializeTransactionAttachment(
  publicTeamId: string,
  record: TransactionAttachmentDoc,
): SerializedTransactionAttachment {
  return {
    id: publicTransactionAttachmentId(record),
    teamId: publicTeamId,
    transactionId: record.transactionId ?? null,
    type: record.type,
    name: record.name,
    size: record.size,
    path: record.path,
    createdAt: record.createdAt,
  };
}

async function getTeamOrThrow(ctx: TransactionAttachmentCtx, publicTeamId: string) {
  const team = await getTeamByPublicTeamId(ctx, publicTeamId);

  if (!team) {
    throw new ConvexError("Convex transaction attachment team not found");
  }

  return team;
}

async function getTransactionAttachmentByPublicId(
  ctx: TransactionAttachmentCtx,
  args: {
    publicTeamId: string;
    attachmentId: string;
  },
) {
  const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

  if (!team) {
    return null;
  }

  const db = ctx.db as any;

  const byLegacyId = await db
    .query("transactionAttachments")
    .withIndex("by_public_transaction_attachment_id", (q: any) =>
      q.eq("publicTransactionAttachmentId", args.attachmentId),
    )
    .collect();

  const matchingLegacyRecord = byLegacyId.find(
    (record: any) => record.teamId === team._id,
  );

  if (matchingLegacyRecord) {
    return matchingLegacyRecord;
  }

  const byDocId = (await db.get(args.attachmentId as any)) as
    | TransactionAttachmentDoc
    | null;

  if (byDocId && byDocId.teamId === team._id) {
    return byDocId;
  }

  return null;
}

async function getAttachmentsByTransactionIds(
  ctx: TransactionAttachmentCtx,
  teamId: Id<"teams">,
  transactionIds: string[],
) {
  const db = ctx.db as any;
  const uniqueTransactionIds = [...new Set(transactionIds)];

  const attachments = await Promise.all(
    uniqueTransactionIds.map((transactionId) =>
      db
        .query("transactionAttachments")
        .withIndex("by_team_and_transaction", (q: any) =>
          q.eq("teamId", teamId).eq("transactionId", transactionId),
        )
        .collect(),
    ),
  );

  return attachments.flat();
}

async function getAttachmentsByPathKeys(
  ctx: TransactionAttachmentCtx,
  teamId: Id<"teams">,
  pathKeys: string[],
) {
  const db = ctx.db as any;
  const uniquePathKeys = [...new Set(pathKeys)];

  const attachments = await Promise.all(
    uniquePathKeys.map((pathKey) =>
      db
        .query("transactionAttachments")
        .withIndex("by_team_and_path_key", (q: any) =>
          q.eq("teamId", teamId).eq("pathKey", pathKey),
        )
        .collect(),
    ),
  );

  return attachments.flat();
}

function sortAttachments(
  left: { createdAt: string; id?: string; _id?: string },
  right: { createdAt: string; id?: string; _id?: string },
) {
  const leftId = left._id ?? left.id ?? "";
  const rightId = right._id ?? right.id ?? "";
  const createdAtDiff = left.createdAt.localeCompare(right.createdAt);

  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }

  return leftId.localeCompare(rightId);
}

export const serviceCreateTransactionAttachments = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    attachments: v.array(attachmentInputValidator),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamOrThrow(ctx, args.publicTeamId);
    const db = ctx.db as any;
    const timestamp = nowIso();
    const results: SerializedTransactionAttachment[] = [];

    for (const attachment of args.attachments) {
      const pathKey = pathKeyFromPath(attachment.path);
      const publicTransactionAttachmentId =
        attachment.publicTransactionAttachmentId ?? crypto.randomUUID();

      const existing = await db
        .query("transactionAttachments")
        .withIndex("by_public_transaction_attachment_id", (q: any) =>
          q.eq(
            "publicTransactionAttachmentId",
            publicTransactionAttachmentId,
          ),
        )
        .collect();

      const matchingExisting = existing.find(
        (record: any) => record.teamId === team._id,
      );

      if (matchingExisting) {
        await db.patch(matchingExisting._id, {
          transactionId: attachment.transactionId ?? undefined,
          type: attachment.type,
          name: attachment.name,
          size: attachment.size,
          path: attachment.path,
          pathKey,
        });

        const updated = await db.get(matchingExisting._id);

        if (!updated) {
          throw new ConvexError("Failed to update transaction attachment");
        }

        results.push(serializeTransactionAttachment(args.publicTeamId, updated));
        continue;
      }

      if (existing.length > 0) {
        throw new ConvexError("Transaction attachment legacy id already exists");
      }

      const insertedId = await db.insert("transactionAttachments", {
        publicTransactionAttachmentId,
        teamId: team._id,
        transactionId: attachment.transactionId ?? undefined,
        type: attachment.type,
        name: attachment.name,
        size: attachment.size,
        path: attachment.path,
        pathKey,
        createdAt: timestamp,
      });

      const inserted = await db.get(insertedId);

      if (!inserted) {
        throw new ConvexError("Failed to create transaction attachment");
      }

      results.push(serializeTransactionAttachment(args.publicTeamId, inserted));
    }

    return results.sort(sortAttachments);
  },
});

export const serviceGetTransactionAttachment = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    transactionId: v.string(),
    attachmentId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const attachment = await getTransactionAttachmentByPublicId(ctx, {
      publicTeamId: args.publicTeamId,
      attachmentId: args.attachmentId,
    });

    if (!attachment || attachment.transactionId !== args.transactionId) {
      return null;
    }

    return serializeTransactionAttachment(args.publicTeamId, attachment);
  },
});

export const serviceGetTransactionAttachmentsByIds = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    ids: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.ids.length === 0) {
      return [];
    }

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const seen = new Set<string>();
    const results: SerializedTransactionAttachment[] = [];

    for (const id of [...new Set(args.ids)]) {
      const attachment = await getTransactionAttachmentByPublicId(ctx, {
        publicTeamId: args.publicTeamId,
        attachmentId: id,
      });

      if (!attachment) {
        continue;
      }

      const serialized = serializeTransactionAttachment(
        args.publicTeamId,
        attachment,
      );

      if (seen.has(serialized.id)) {
        continue;
      }

      seen.add(serialized.id);
      results.push(serialized);
    }

    return results.sort(sortAttachments);
  },
});

export const serviceGetTransactionAttachmentsForTransactionIds = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    transactionIds: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.transactionIds.length === 0) {
      return [];
    }

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const attachments = await getAttachmentsByTransactionIds(
      ctx,
      team._id,
      args.transactionIds,
    );

    return attachments
      .map((attachment) =>
        serializeTransactionAttachment(args.publicTeamId, attachment),
      )
      .sort(sortAttachments);
  },
});

export const serviceGetTransactionAttachmentsByPathKeys = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    pathKeys: v.array(v.array(v.string())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.pathKeys.length === 0) {
      return [];
    }

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const attachments = await getAttachmentsByPathKeys(
      ctx,
      team._id,
      args.pathKeys.map(pathKeyFromPath),
    );

    return attachments
      .map((attachment) =>
        serializeTransactionAttachment(args.publicTeamId, attachment),
      )
      .sort(sortAttachments);
  },
});

export const serviceGetTransactionIdsWithAttachments = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    transactionIds: v.optional(v.array(v.string())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);
    const db = ctx.db as any;

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    if (args.transactionIds && args.transactionIds.length > 0) {
      const results: string[] = [];

      for (const transactionId of [...new Set(args.transactionIds)]) {
        const attachments = await db
          .query("transactionAttachments")
          .withIndex("by_team_and_transaction", (q: any) =>
            q.eq("teamId", team._id).eq("transactionId", transactionId),
          )
          .collect();

        if (attachments.length > 0) {
          results.push(transactionId);
        }
      }

      return results;
    }

    const attachments = await db
      .query("transactionAttachments")
      .withIndex("by_team_id", (q: any) => q.eq("teamId", team._id))
      .collect();

    return [...new Set(
      attachments
        .map((attachment: { transactionId?: string }) => attachment.transactionId)
        .filter((id: string | undefined): id is string => Boolean(id)),
    )].sort();
  },
});

export const serviceDeleteTransactionAttachment = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    id: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);
    const db = ctx.db as any;

    const attachment = await getTransactionAttachmentByPublicId(ctx, {
      publicTeamId: args.publicTeamId,
      attachmentId: args.id,
    });

    if (!attachment) {
      return null;
    }

    await db.delete(attachment._id);

    return serializeTransactionAttachment(args.publicTeamId, attachment);
  },
});

export const serviceDeleteTransactionAttachmentsByIds = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    ids: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);
    const db = ctx.db as any;

    if (args.ids.length === 0) {
      return { deletedIds: [], count: 0 };
    }

    const deletedIds: string[] = [];
    const seen = new Set<string>();

    for (const id of [...new Set(args.ids)]) {
      const attachment = await getTransactionAttachmentByPublicId(ctx, {
        publicTeamId: args.publicTeamId,
        attachmentId: id,
      });

      if (!attachment) {
        continue;
      }

      await db.delete(attachment._id);

      const publicId = publicTransactionAttachmentId(attachment);
      if (!seen.has(publicId)) {
        seen.add(publicId);
        deletedIds.push(publicId);
      }
    }

    return { deletedIds, count: deletedIds.length };
  },
});

export const serviceDeleteTransactionAttachmentsByPathKeys = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    pathKeys: v.array(v.array(v.string())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);
    const db = ctx.db as any;

    if (args.pathKeys.length === 0) {
      return { deletedIds: [], count: 0 };
    }

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return { deletedIds: [], count: 0 };
    }

    const attachments = await getAttachmentsByPathKeys(
      ctx,
      team._id,
      args.pathKeys.map(pathKeyFromPath),
    );

    const deletedIds: string[] = [];
    const seen = new Set<string>();

    for (const attachment of attachments) {
      await db.delete(attachment._id);

      const publicId = publicTransactionAttachmentId(attachment);
      if (!seen.has(publicId)) {
        seen.add(publicId);
        deletedIds.push(publicId);
      }
    }

    return { deletedIds, count: deletedIds.length };
  },
});
