import { createLoggerWithContext } from "@tamias/logger";
import {
  deleteTransactionMatchSuggestionsInConvex,
  getAllInboxItemsFromConvex,
  getInboxItemByIdFromConvex,
  getInboxItemInfoFromConvex,
  getInboxItemsFromConvex,
  getTransactionByIdFromConvex,
  type InboxItemRecord,
  type TransactionRecord,
  upsertInboxItemsInConvex,
} from "@tamias/app-data-convex";
import type { Database, DatabaseOrTransaction } from "../../client";
import {
  createAttachments,
  deleteTransactionAttachmentsByIds,
  getTransactionIdsWithAttachments,
} from "../transaction-attachments";
import {
  buildInboxTransactionSummary,
  clearInboxSuggestions,
  getTeamInboxItems,
  getTeamMatchSuggestions,
  markInboxItems,
  patchTransactionFields,
  type InboxConvexUserId,
} from "./shared";

const logger = createLoggerWithContext("inbox");

export type DeleteInboxParams = {
  id: string;
  teamId: string;
};

export async function deleteInbox(db: Database, params: DeleteInboxParams) {
  const { id, teamId } = params;
  const result = await getInboxItemByIdFromConvex({
    teamId,
    inboxId: id,
  });

  if (!result) {
    throw new Error("Inbox item not found");
  }

  if (result.attachmentId && result.transactionId) {
    await deleteTransactionAttachmentsByIds({
      teamId,
      attachmentIds: [result.attachmentId],
    });
    const remainingAttachments = await getTransactionIdsWithAttachments({
      teamId,
      transactionIds: [result.transactionId],
    });

    if (remainingAttachments.length === 0) {
      await patchTransactionFields(teamId, result.transactionId, {
        taxRate: null,
        taxType: null,
      });
    }
  }

  await deleteTransactionMatchSuggestionsInConvex({
    teamId,
    inboxIds: [id],
  });

  const [deleted] = await markInboxItems([result], {
    status: "deleted",
    transactionId: null,
    attachmentId: null,
  });

  return {
    ...deleted,
    filePath: result.filePath,
  };
}

export type DeleteInboxManyParams = {
  ids: string[];
  teamId: string;
};

export async function deleteInboxMany(
  db: Database,
  params: DeleteInboxManyParams,
) {
  const { ids, teamId } = params;

  if (ids.length === 0) {
    return [];
  }

  const items = await getInboxItemsFromConvex({
    teamId,
    ids,
  });
  const results: Array<{ id: string; filePath: string[] | null }> = [];

  for (const item of items) {
    try {
      if (item.attachmentId && item.transactionId) {
        await deleteTransactionAttachmentsByIds({
          teamId,
          attachmentIds: [item.attachmentId],
        });
        const remainingAttachments = await getTransactionIdsWithAttachments({
          teamId,
          transactionIds: [item.transactionId],
        });

        if (remainingAttachments.length === 0) {
          await patchTransactionFields(teamId, item.transactionId, {
            taxRate: null,
            taxType: null,
          });
        }
      }

      await deleteTransactionMatchSuggestionsInConvex({
        teamId,
        inboxIds: [item.id],
      });

      await markInboxItems([item], {
        status: "deleted",
        transactionId: null,
        attachmentId: null,
      });

      results.push({
        id: item.id,
        filePath: item.filePath,
      });
    } catch (error) {
      logger.error(`Failed to delete inbox item ${item.id}:`, {
        error:
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : { message: String(error) },
      });
    }
  }

  return results;
}

export type UpdateInboxParams = {
  id: string;
  teamId: string;
  status?:
    | "deleted"
    | "new"
    | "archived"
    | "processing"
    | "done"
    | "pending"
    | "analyzing"
    | "suggested_match"
    | "other";
  contentType?: string;
};

export async function updateInbox(
  db: DatabaseOrTransaction,
  params: UpdateInboxParams,
) {
  const { id, teamId, ...data } = params;
  const current = await getInboxItemByIdFromConvex({
    teamId,
    inboxId: id,
  });

  if (!current) {
    return null;
  }

  if (data.status === "deleted") {
    if (current.attachmentId && current.transactionId) {
      await deleteTransactionAttachmentsByIds({
        teamId,
        attachmentIds: [current.attachmentId],
      });
      const remainingAttachments = await getTransactionIdsWithAttachments({
        teamId,
        transactionIds: [current.transactionId],
      });

      if (remainingAttachments.length === 0) {
        await patchTransactionFields(teamId, current.transactionId, {
          taxRate: null,
          taxType: null,
        });
      }
    }

    await deleteTransactionMatchSuggestionsInConvex({
      teamId,
      inboxIds: [id],
    });
  }

  const [result] = await markInboxItems([current], data);

  if (!result) {
    return null;
  }

  return {
    ...result,
    transaction: result.transactionId
      ? buildInboxTransactionSummary(
          await getTransactionByIdFromConvex({
            teamId,
            transactionId: result.transactionId,
          }),
        )
      : null,
  };
}

export type MatchTransactionParams = {
  id: string;
  transactionId: string;
  teamId: string;
};

export async function matchTransaction(
  db: DatabaseOrTransaction,
  params: MatchTransactionParams,
) {
  const { id, transactionId, teamId } = params;
  const [allItems, result, targetTransaction] = await Promise.all([
    getTeamInboxItems(teamId),
    getInboxItemByIdFromConvex({ teamId, inboxId: id }),
    getTransactionByIdFromConvex({ teamId, transactionId }),
  ]);

  if (!result) {
    return null;
  }

  if (result.transactionId) {
    throw new Error("Inbox item is already matched to a transaction");
  }

  const primaryItemId = result.groupedInboxId || result.id;
  const relatedItems = allItems.filter(
    (item) =>
      item.id === primaryItemId || item.groupedInboxId === primaryItemId,
  );
  const alreadyMatched = relatedItems.find((item) => item.transactionId);

  if (alreadyMatched) {
    throw new Error("A related inbox item is already matched to a transaction");
  }

  if (!targetTransaction) {
    throw new Error("Transaction not found or belongs to another team");
  }

  const existingMatches = await getInboxItemsFromConvex({
    teamId,
    transactionIds: [transactionId],
  });
  const conflictingMatch = existingMatches.find(
    (item) => !relatedItems.some((relatedItem) => relatedItem.id === item.id),
  );

  if (conflictingMatch) {
    throw new Error("Transaction is already matched to another inbox item");
  }

  const attachmentIds = new Map<string, string>();
  const createdAttachments = await createAttachments(db, {
    teamId,
    attachments: relatedItems.map((item) => ({
      type: item.contentType ?? "",
      path: item.filePath ?? [],
      transactionId,
      size: item.size ?? 0,
      name: item.fileName ?? "",
    })),
  });

  for (const [index, item] of relatedItems.entries()) {
    const attachmentData = createdAttachments[index];

    if (attachmentData) {
      attachmentIds.set(item.id, attachmentData.id);
    }
  }

  const primaryItem =
    relatedItems.find((item) => item.id === primaryItemId) || result;
  const taxUpdates: Partial<TransactionRecord> = {};

  if (primaryItem.taxAmount !== null && primaryItem.taxAmount !== undefined) {
    taxUpdates.taxAmount = primaryItem.taxAmount;
  }

  if (
    primaryItem.taxRate !== null &&
    primaryItem.taxRate !== undefined &&
    primaryItem.taxType
  ) {
    taxUpdates.taxRate = primaryItem.taxRate;
    taxUpdates.taxType = primaryItem.taxType;
  }

  if (Object.keys(taxUpdates).length > 0) {
    await patchTransactionFields(teamId, transactionId, taxUpdates);
  }

  await markInboxItems(
    relatedItems.map((item) => ({
      ...item,
      attachmentId: attachmentIds.get(item.id) ?? item.attachmentId,
      transactionId,
      status: "done",
    })),
    {},
  );

  const updated = await getInboxItemByIdFromConvex({
    teamId,
    inboxId: id,
  });

  return updated
    ? {
        ...updated,
        transaction: updated.transactionId
          ? buildInboxTransactionSummary(
              await getTransactionByIdFromConvex({
                teamId,
                transactionId: updated.transactionId,
              }),
            )
          : null,
      }
    : null;
}

export type UnmatchTransactionParams = {
  id: string;
  teamId: string;
};

export async function unmatchTransaction(
  _db: Database,
  params: UnmatchTransactionParams & { userId?: InboxConvexUserId },
) {
  const { id, teamId, userId } = params;
  const [allItems, allSuggestions, result] = await Promise.all([
    getTeamInboxItems(teamId),
    getTeamMatchSuggestions(teamId),
    getInboxItemByIdFromConvex({ teamId, inboxId: id }),
  ]);

  if (!result) {
    return null;
  }

  const primaryItemId = result.groupedInboxId || result.id;
  const relatedItems = allItems.filter(
    (item) =>
      item.id === primaryItemId || item.groupedInboxId === primaryItemId,
  );
  const transactionId = relatedItems.find(
    (item) => item.transactionId,
  )?.transactionId;

  if (transactionId) {
    const originalSuggestions = relatedItems.flatMap((item) =>
      allSuggestions.filter(
        (suggestion) =>
          suggestion.inboxId === item.id &&
          suggestion.transactionId === transactionId &&
          suggestion.status === "confirmed",
      ),
    );

    await clearInboxSuggestions(teamId, originalSuggestions, {
      status: "unmatched",
      userId,
    });
  }

  await markInboxItems(relatedItems, {
    transactionId: null,
    attachmentId: null,
    status: "pending",
  });

  const attachmentIds = relatedItems
    .map((item) => item.attachmentId)
    .filter((attachmentId): attachmentId is string => attachmentId !== null);

  if (attachmentIds.length > 0) {
    await deleteTransactionAttachmentsByIds({
      teamId,
      attachmentIds,
    });
  }

  if (transactionId) {
    const remainingAttachments = await getTransactionIdsWithAttachments({
      teamId,
      transactionIds: [transactionId],
    });

    if (remainingAttachments.length === 0) {
      await patchTransactionFields(teamId, transactionId, {
        taxRate: null,
        taxType: null,
      });
    }
  }

  const resultData = await getInboxItemByIdFromConvex({
    teamId,
    inboxId: id,
  });

  return resultData
    ? {
        ...resultData,
        transaction: resultData.transactionId
          ? buildInboxTransactionSummary(
              await getTransactionByIdFromConvex({
                teamId,
                transactionId: resultData.transactionId,
              }),
            )
          : null,
      }
    : null;
}

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

      return {
        id: existing.id,
        fileName: existing.fileName,
        filePath: existing.filePath,
        displayName: existing.displayName,
        transactionId: existing.transactionId,
        amount: existing.amount,
        currency: existing.currency,
        contentType: existing.contentType,
        date: existing.date,
        status: existing.status,
        createdAt: existing.createdAt,
        website: existing.website,
        senderEmail: existing.senderEmail,
        description: existing.description,
        referenceId: existing.referenceId,
        size: existing.size,
        inboxAccountId: existing.inboxAccountId,
      };
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

  return {
    id: result.id,
    fileName: result.fileName,
    filePath: result.filePath,
    displayName: result.displayName,
    transactionId: result.transactionId,
    amount: result.amount,
    currency: result.currency,
    contentType: result.contentType,
    date: result.date,
    status: result.status,
    createdAt: result.createdAt,
    website: result.website,
    senderEmail: result.senderEmail,
    description: result.description,
    referenceId: result.referenceId,
    size: result.size,
    inboxAccountId: result.inboxAccountId,
  };
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

  return {
    id: result.id,
    fileName: result.fileName,
    filePath: result.filePath,
    displayName: result.displayName,
    transactionId: result.transactionId,
    amount: result.amount,
    currency: result.currency,
    contentType: result.contentType,
    date: result.date,
    status: result.status,
    createdAt: result.createdAt,
    website: result.website,
    description: result.description,
    referenceId: result.referenceId,
    size: result.size,
    taxAmount: result.taxAmount,
    taxRate: result.taxRate,
    taxType: result.taxType,
    type: result.type,
    invoiceNumber: result.invoiceNumber,
  };
}

export type UpdateInboxStatusParams = {
  id: string;
  status:
    | "pending"
    | "analyzing"
    | "no_match"
    | "new"
    | "archived"
    | "processing"
    | "done"
    | "suggested_match";
};

export async function updateInboxStatus(
  _db: Database,
  params: UpdateInboxStatusParams,
) {
  const current = await getInboxItemInfoFromConvex({
    inboxId: params.id,
  });

  if (!current) {
    return;
  }

  await markInboxItems([current], {
    status: params.status,
  });
}

export type UpdateInboxStatusToNoMatchParams = {
  cutoffDate: string;
};

export type UpdateInboxStatusToNoMatchResult = {
  updatedCount: number;
  updatedItems: Array<{
    id: string;
    teamId: string | null;
    displayName: string | null;
    createdAt: string;
  }>;
};

export async function updateInboxStatusToNoMatch(
  _db: Database,
  params: UpdateInboxStatusToNoMatchParams,
): Promise<UpdateInboxStatusToNoMatchResult> {
  const items = await getAllInboxItemsFromConvex();
  const toUpdate = items.filter(
    (item) =>
      item.status === "pending" &&
      item.createdAt < params.cutoffDate &&
      item.transactionId == null,
  );

  if (toUpdate.length > 0) {
    await markInboxItems(toUpdate, {
      status: "no_match",
    });
  }

  return {
    updatedCount: toUpdate.length,
    updatedItems: toUpdate.map((item) => ({
      id: item.id,
      teamId: item.teamId,
      displayName: item.displayName,
      createdAt: item.createdAt,
    })),
  };
}
