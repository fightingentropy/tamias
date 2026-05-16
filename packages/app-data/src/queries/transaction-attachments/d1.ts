import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../client";
import type { Attachment, StoredTransactionAttachment } from "./types";

type TransactionAttachmentRow = {
  id: string;
  team_id: string;
  transaction_id: string | null;
  type: string;
  name: string;
  size: number;
  path_json: string;
  path_key: string;
  created_at: string;
  updated_at: string;
};

export type CreateTransactionAttachmentsInD1Result = {
  attachments: StoredTransactionAttachment[];
  affectedTransactionIds: string[];
};

export type DeleteTransactionAttachmentsInD1Result = {
  deletedIds: string[];
  count: number;
  affectedTransactionIds: string[];
  attachments: StoredTransactionAttachment[];
};

export function getTransactionAttachmentsD1(db: Database) {
  return requireCloudflareD1Database(db);
}

export function requireTransactionAttachmentsD1(db: Database) {
  const d1 = getTransactionAttachmentsD1(db);

  if (!d1) {
    throw new Error("Transaction attachments require Cloudflare D1");
  }

  return d1;
}

export function pathKeyFromPath(path: string[]) {
  return JSON.stringify(path);
}

function parsePath(value: string) {
  const parsed = JSON.parse(value) as unknown;

  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    return [];
  }

  return parsed;
}

function toAttachmentRecord(row: TransactionAttachmentRow): StoredTransactionAttachment {
  return {
    id: row.id,
    teamId: row.team_id,
    transactionId: row.transaction_id,
    type: row.type,
    name: row.name,
    size: row.size,
    path: parsePath(row.path_json),
    createdAt: row.created_at,
  };
}

function sortAttachments(
  left: Pick<StoredTransactionAttachment, "createdAt" | "id">,
  right: Pick<StoredTransactionAttachment, "createdAt" | "id">,
) {
  const createdAtDiff = left.createdAt.localeCompare(right.createdAt);

  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }

  return left.id.localeCompare(right.id);
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function collectAffectedTransactionId(
  affectedTransactionIds: Set<string>,
  transactionId: string | null | undefined,
) {
  if (transactionId) {
    affectedTransactionIds.add(transactionId);
  }
}

export async function getTransactionAttachmentByIdFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: {
    teamId: string;
    attachmentId: string;
  },
) {
  const row = await d1
    .prepare("select * from transaction_attachments where team_id = ? and id = ? limit 1")
    .bind(params.teamId, params.attachmentId)
    .first<TransactionAttachmentRow>();

  return row ? toAttachmentRecord(row) : null;
}

async function getTransactionAttachmentByGlobalIdFromD1(
  d1: CloudflareD1DatabaseBinding,
  attachmentId: string,
) {
  const row = await d1
    .prepare("select * from transaction_attachments where id = ? limit 1")
    .bind(attachmentId)
    .first<TransactionAttachmentRow>();

  return row ? toAttachmentRecord(row) : null;
}

export async function transactionHasAttachmentsInD1(
  d1: CloudflareD1DatabaseBinding,
  params: {
    teamId: string;
    transactionId: string;
  },
) {
  const row = await d1
    .prepare(
      `select 1 as has_attachment
       from transaction_attachments
       where team_id = ? and transaction_id = ?
       limit 1`,
    )
    .bind(params.teamId, params.transactionId)
    .first<{ has_attachment: number }>();

  return row !== null;
}

export async function createTransactionAttachmentsInD1(
  d1: CloudflareD1DatabaseBinding,
  params: {
    teamId: string;
    attachments: Attachment[];
  },
): Promise<CreateTransactionAttachmentsInD1Result> {
  const timestamp = new Date().toISOString();
  const affectedTransactionIds = new Set<string>();
  const resultIds: string[] = [];

  for (const attachment of params.attachments) {
    const id = attachment.publicTransactionAttachmentId ?? crypto.randomUUID();
    const existing = await getTransactionAttachmentByGlobalIdFromD1(d1, id);

    if (existing && existing.teamId !== params.teamId) {
      throw new Error("Transaction attachment id already exists");
    }

    const transactionId = attachment.transactionId ?? null;
    const pathJson = JSON.stringify(attachment.path);
    const pathKey = pathKeyFromPath(attachment.path);

    if (existing) {
      collectAffectedTransactionId(affectedTransactionIds, existing.transactionId);
      collectAffectedTransactionId(affectedTransactionIds, transactionId);
      await d1
        .prepare(
          `update transaction_attachments
           set transaction_id = ?,
               type = ?,
               name = ?,
               size = ?,
               path_json = ?,
               path_key = ?,
               updated_at = ?
           where team_id = ? and id = ?`,
        )
        .bind(
          transactionId,
          attachment.type,
          attachment.name,
          attachment.size,
          pathJson,
          pathKey,
          timestamp,
          params.teamId,
          id,
        )
        .run();
    } else {
      collectAffectedTransactionId(affectedTransactionIds, transactionId);
      await d1
        .prepare(
          `insert into transaction_attachments (
            id,
            team_id,
            transaction_id,
            type,
            name,
            size,
            path_json,
            path_key,
            created_at,
            updated_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          params.teamId,
          transactionId,
          attachment.type,
          attachment.name,
          attachment.size,
          pathJson,
          pathKey,
          timestamp,
          timestamp,
        )
        .run();
    }

    resultIds.push(id);
  }

  const attachments = await getTransactionAttachmentsByIdsFromD1(d1, {
    teamId: params.teamId,
    attachmentIds: resultIds,
  });

  return {
    attachments,
    affectedTransactionIds: [...affectedTransactionIds],
  };
}

export async function getTransactionAttachmentFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: {
    teamId: string;
    transactionId: string;
    attachmentId: string;
  },
) {
  const attachment = await getTransactionAttachmentByIdFromD1(d1, {
    teamId: params.teamId,
    attachmentId: params.attachmentId,
  });

  if (!attachment || attachment.transactionId !== params.transactionId) {
    return null;
  }

  return attachment;
}

export async function getTransactionAttachmentsByIdsFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: {
    teamId: string;
    attachmentIds: string[];
  },
) {
  const attachments: StoredTransactionAttachment[] = [];
  const seen = new Set<string>();

  for (const attachmentId of uniqueStrings(params.attachmentIds)) {
    const attachment = await getTransactionAttachmentByIdFromD1(d1, {
      teamId: params.teamId,
      attachmentId,
    });

    if (!attachment || seen.has(attachment.id)) {
      continue;
    }

    seen.add(attachment.id);
    attachments.push(attachment);
  }

  return attachments.sort(sortAttachments);
}

export async function getTransactionAttachmentsForTransactionIdsFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: {
    teamId: string;
    transactionIds: string[];
  },
) {
  const attachments: StoredTransactionAttachment[] = [];
  const seen = new Set<string>();

  for (const transactionId of uniqueStrings(params.transactionIds)) {
    const result = await d1
      .prepare(
        `select * from transaction_attachments
         where team_id = ? and transaction_id = ?`,
      )
      .bind(params.teamId, transactionId)
      .all<TransactionAttachmentRow>();

    for (const row of result.results ?? []) {
      const attachment = toAttachmentRecord(row);

      if (seen.has(attachment.id)) {
        continue;
      }

      seen.add(attachment.id);
      attachments.push(attachment);
    }
  }

  return attachments.sort(sortAttachments);
}

export async function getTransactionAttachmentsByPathKeysFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: {
    teamId: string;
    pathKeys: string[][];
  },
) {
  const attachments: StoredTransactionAttachment[] = [];
  const seen = new Set<string>();

  for (const pathKey of uniqueStrings(params.pathKeys.map(pathKeyFromPath))) {
    const result = await d1
      .prepare(
        `select * from transaction_attachments
         where team_id = ? and path_key = ?`,
      )
      .bind(params.teamId, pathKey)
      .all<TransactionAttachmentRow>();

    for (const row of result.results ?? []) {
      const attachment = toAttachmentRecord(row);

      if (seen.has(attachment.id)) {
        continue;
      }

      seen.add(attachment.id);
      attachments.push(attachment);
    }
  }

  return attachments.sort(sortAttachments);
}

export async function deleteTransactionAttachmentInD1(
  d1: CloudflareD1DatabaseBinding,
  params: {
    teamId: string;
    attachmentId: string;
  },
) {
  const result = await deleteTransactionAttachmentsByIdsFromD1(d1, {
    teamId: params.teamId,
    attachmentIds: [params.attachmentId],
  });

  return result.attachments[0] ?? null;
}

export async function deleteTransactionAttachmentsByIdsFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: {
    teamId: string;
    attachmentIds: string[];
  },
): Promise<DeleteTransactionAttachmentsInD1Result> {
  const attachments = await getTransactionAttachmentsByIdsFromD1(d1, params);
  const deletedIds: string[] = [];
  const affectedTransactionIds = new Set<string>();

  for (const attachment of attachments) {
    await d1
      .prepare("delete from transaction_attachments where team_id = ? and id = ?")
      .bind(params.teamId, attachment.id)
      .run();
    deletedIds.push(attachment.id);
    collectAffectedTransactionId(affectedTransactionIds, attachment.transactionId);
  }

  return {
    deletedIds,
    count: deletedIds.length,
    affectedTransactionIds: [...affectedTransactionIds],
    attachments,
  };
}

export async function deleteTransactionAttachmentsByPathKeysFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: {
    teamId: string;
    pathKeys: string[][];
  },
): Promise<DeleteTransactionAttachmentsInD1Result> {
  const attachments = await getTransactionAttachmentsByPathKeysFromD1(d1, params);
  const deletedIds: string[] = [];
  const affectedTransactionIds = new Set<string>();

  for (const attachment of attachments) {
    await d1
      .prepare("delete from transaction_attachments where team_id = ? and id = ?")
      .bind(params.teamId, attachment.id)
      .run();
    deletedIds.push(attachment.id);
    collectAffectedTransactionId(affectedTransactionIds, attachment.transactionId);
  }

  return {
    deletedIds,
    count: deletedIds.length,
    affectedTransactionIds: [...affectedTransactionIds],
    attachments,
  };
}
