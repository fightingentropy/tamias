import { createLoggerWithContext } from "@tamias/logger";
import type { Database } from "../../client";
import { getInboxItemsPaged } from "../paged-records";
import { getTransactionAttachmentsByIds } from "../transaction-attachments";
import { getInboxItemByIdFromD1, getInboxItemsFromD1, requireInboxItemsD1 } from "./d1";
import {
  filePathEquals,
  getPendingSuggestionForInbox,
  hydrateInboxItems,
  loadSuggestionMaps,
} from "./shared";
import type {
  CheckInboxAttachmentsParams,
  GetExistingInboxAttachmentsByReferenceIdsParams,
  GetInboxByFilePathParams,
  GetInboxByIdParams,
  GetStuckInboxItemsParams,
} from "./types";

const logger = createLoggerWithContext("inbox");

export async function getInboxById(_db: Database, params: GetInboxByIdParams) {
  const d1 = requireInboxItemsD1(_db);
  const { id, teamId } = params;
  const [item, suggestion] = await Promise.all([
    getInboxItemByIdFromD1(d1, { teamId, inboxId: id }),
    getPendingSuggestionForInbox(_db, teamId, id),
  ]);

  if (!item) {
    return null;
  }

  const primaryItemId = item.groupedInboxId || item.id;
  const [primaryItem, relatedItems] = await Promise.all([
    primaryItemId === item.id
      ? Promise.resolve(item)
      : getInboxItemByIdFromD1(d1, {
          teamId,
          inboxId: primaryItemId,
        }).then((candidate) => candidate ?? item),
    getInboxItemsFromD1(d1, {
      teamId,
      groupedInboxIds: [primaryItemId],
    }).then((items) => items.filter((candidate) => candidate.status !== "deleted")),
  ]);
  const [hydratedPrimary] = await hydrateInboxItems(_db, teamId, [primaryItem]);

  if (!hydratedPrimary) {
    return null;
  }

  if (suggestion?.transactionId) {
    const suggestionTransactionMap = await loadSuggestionMaps(_db, teamId, [suggestion]);

    return {
      ...hydratedPrimary,
      meta: hydratedPrimary.meta ?? primaryItem.meta,
      suggestion: {
        id: suggestion.id,
        transactionId: suggestion.transactionId,
        confidenceScore: suggestion.confidenceScore,
        matchType: suggestion.matchType,
        status: suggestion.status,
        suggestedTransaction: suggestionTransactionMap.get(suggestion.transactionId) ?? null,
      },
      relatedItems: relatedItems.length > 0 ? relatedItems : undefined,
    };
  }

  return {
    ...hydratedPrimary,
    suggestion: null,
    relatedItems: relatedItems.length > 0 ? relatedItems : undefined,
  };
}

export async function checkInboxAttachments(db: Database, params: CheckInboxAttachmentsParams) {
  const inboxItem = await getInboxItemByIdFromD1(requireInboxItemsD1(db), {
    teamId: params.teamId,
    inboxId: params.id,
  });

  if (!inboxItem) {
    return { hasAttachments: false, attachments: [] };
  }

  if (inboxItem.attachmentId && inboxItem.transactionId) {
    const attachments = await getTransactionAttachmentsByIds(db, {
      teamId: params.teamId,
      attachmentIds: [inboxItem.attachmentId],
    });

    return {
      hasAttachments: attachments.length > 0,
      attachments,
      fileName: inboxItem.fileName,
    };
  }

  return {
    hasAttachments: false,
    attachments: [],
    fileName: inboxItem.fileName,
  };
}

export async function getInboxByFilePath(_db: Database, params: GetInboxByFilePathParams) {
  const { filePath, teamId } = params;
  const items = await getInboxItemsFromD1(requireInboxItemsD1(_db), {
    teamId,
    filePath,
  });
  const matching = items
    .filter((item) => filePathEquals(item.filePath, filePath))
    .filter((item) => item.status !== "deleted")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  const processingItem = matching.find(
    (item) => item.status === "processing" || item.status === "new",
  );

  const item = processingItem ?? matching[0];

  if (!item) {
    return undefined;
  }

  return {
    id: item.id,
    status: item.status,
    createdAt: item.createdAt,
    contentType: item.contentType,
    displayName: item.displayName,
  };
}

export async function getStuckInboxItems(_db: Database, params: GetStuckInboxItemsParams) {
  const { teamId, thresholdMinutes = 5 } = params;
  const thresholdMs = thresholdMinutes * 60 * 1000;
  const thresholdDate = new Date(Date.now() - thresholdMs).toISOString();

  return (
    await Promise.all([
      getInboxItemsPaged(_db, {
        teamId,
        status: "processing",
        createdAtTo: thresholdDate,
      }),
      getInboxItemsPaged(_db, {
        teamId,
        status: "new",
        createdAtTo: thresholdDate,
      }),
    ])
  )
    .flat()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((item) => ({
      id: item.id,
      status: item.status,
      createdAt: item.createdAt,
      filePath: item.filePath,
      displayName: item.displayName,
    }));
}

export async function getExistingInboxAttachmentsByReferenceIds(
  _db: Database,
  params: GetExistingInboxAttachmentsByReferenceIdsParams,
) {
  const validReferenceIds = params.referenceIds.filter(
    (id): id is string => id != null && id !== "",
  );

  if (validReferenceIds.length === 0) {
    return [];
  }

  logger.info("Querying for existing inbox attachments by referenceIds", {
    teamId: params.teamId,
    referenceIdsCount: validReferenceIds.length,
    sampleIds: validReferenceIds.slice(0, 3),
  });

  const results = (
    await getInboxItemsFromD1(requireInboxItemsD1(_db), {
      teamId: params.teamId,
      referenceIds: validReferenceIds,
    })
  )
    .filter((item) => item.status !== "deleted")
    .map((item) => ({
      referenceId: item.referenceId,
      status: item.status,
    }));

  logger.info("Found existing inbox attachments", {
    teamId: params.teamId,
    foundCount: results.length,
    foundIds: results.map((result) => result.referenceId).slice(0, 3),
  });

  return results;
}
