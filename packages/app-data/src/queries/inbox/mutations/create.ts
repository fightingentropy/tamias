import {
  getInboxItemInfoFromConvex,
  getInboxItemsFromConvex,
  upsertInboxItemsInConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../../../client";
import { markInboxItems } from "../shared";
import {
  logger,
  toInboxFileResponse,
  toProcessedInboxResponse,
} from "./shared";

export type CreateInboxParams = {
  displayName: string;
  teamId: string;
  filePath: string[];
  fileName: string;
  contentType: string;
  size: number;
  referenceId?: string;
  website?: string;
  senderEmail?: string;
  inboxAccountId?: string;
  meta?: Record<string, unknown>;
  status?:
    | "new"
    | "analyzing"
    | "pending"
    | "done"
    | "processing"
    | "archived"
    | "deleted";
};

export async function createInbox(_db: Database, params: CreateInboxParams) {
  const {
    displayName,
    teamId,
    filePath,
    fileName,
    contentType,
    size,
    referenceId,
    website,
    senderEmail,
    inboxAccountId,
    meta,
    status = "new",
  } = params;

  if (referenceId) {
    const existing = (
      await getInboxItemsFromConvex({
        teamId,
        referenceIds: [referenceId],
      })
    )[0];

    if (existing) {
      logger.info("Fetched existing inbox item", {
        referenceId,
        teamId,
        existingId: existing.id,
        existingStatus: existing.status,
      });

      return toInboxFileResponse(existing);
    }
  }

  const now = new Date().toISOString();
  const [result] = await upsertInboxItemsInConvex({
    items: [
      {
        teamId,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        filePath,
        fileName,
        contentType,
        size,
        referenceId,
        website,
        senderEmail,
        inboxAccountId,
        meta,
        status,
        displayName,
      },
    ],
  });

  if (!result) {
    throw new Error("Failed to create inbox item");
  }

  return toInboxFileResponse(result);
}

export type UpdateInboxWithProcessedDataParams = {
  id: string;
  amount?: number;
  currency?: string;
  displayName?: string;
  website?: string;
  date?: string;
  taxAmount?: number;
  taxRate?: number;
  taxType?: string;
  type?: "invoice" | "expense" | "other" | null;
  invoiceNumber?: string;
  status?:
    | "pending"
    | "new"
    | "archived"
    | "processing"
    | "done"
    | "deleted"
    | "analyzing"
    | "other";
};

export async function updateInboxWithProcessedData(
  _db: Database,
  params: UpdateInboxWithProcessedDataParams,
) {
  const current = await getInboxItemInfoFromConvex({
    inboxId: params.id,
  });

  if (!current) {
    return null;
  }

  const [result] = await markInboxItems(
    [
      {
        ...current,
        ...params,
      },
    ],
    {},
  );

  if (!result) {
    return null;
  }

  return toProcessedInboxResponse(result);
}
