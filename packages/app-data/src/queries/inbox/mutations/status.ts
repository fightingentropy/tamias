import {
  getInboxItemByIdFromConvex,
  getInboxItemInfoFromConvex,
  getPendingInboxItemsToNoMatchFromConvex,
  type InboxItemRecord,
} from "../../../convex";
import type { Database, DatabaseOrTransaction } from "../../../client";
import { markInboxItems } from "../shared";
import {
  cleanupDeletedInboxArtifacts,
  getInboxItemWithTransaction,
} from "./shared";

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
  _db: DatabaseOrTransaction,
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
    await cleanupDeletedInboxArtifacts(teamId, current);
  }

  const [result] = await markInboxItems([current], data);

  if (!result) {
    return null;
  }

  return getInboxItemWithTransaction(teamId, result.id);
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
  const toUpdate: InboxItemRecord[] = [];
  let cursor: string | null = null;

  while (true) {
    const result = await getPendingInboxItemsToNoMatchFromConvex({
      createdAtTo: params.cutoffDate,
      cursor,
      pageSize: 200,
    });

    toUpdate.push(...result.page);

    if (result.isDone) {
      break;
    }

    cursor = result.continueCursor;
  }

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
