import {
  getInboxItemByIdFromConvex,
  getInboxItemsFromConvex,
} from "../../../convex";
import type { Database } from "../../../client";
import { markInboxItems } from "../shared";
import {
  cleanupDeletedInboxArtifacts,
  logger,
} from "./shared";

export type DeleteInboxParams = {
  id: string;
  teamId: string;
};

export async function deleteInbox(_db: Database, params: DeleteInboxParams) {
  const { id, teamId } = params;
  const result = await getInboxItemByIdFromConvex({
    teamId,
    inboxId: id,
  });

  if (!result) {
    throw new Error("Inbox item not found");
  }

  await cleanupDeletedInboxArtifacts(teamId, result);

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
  _db: Database,
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
      await cleanupDeletedInboxArtifacts(teamId, item);

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
