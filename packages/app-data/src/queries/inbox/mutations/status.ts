import type { Database, DatabaseOrTransaction } from "../../../client";
import {
  getInboxItemByIdFromD1,
  getInboxItemInfoFromD1,
  getPendingInboxItemsToNoMatchFromD1,
  requireInboxItemsD1,
  type InboxItemRecord,
} from "../d1";
import { markInboxItems } from "../shared";
import { cleanupDeletedInboxArtifacts, getInboxItemWithTransaction } from "./shared";

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

export async function updateInbox(db: DatabaseOrTransaction, params: UpdateInboxParams) {
  const { id, teamId, ...data } = params;
  const current = await getInboxItemByIdFromD1(requireInboxItemsD1(db), {
    teamId,
    inboxId: id,
  });

  if (!current) {
    return null;
  }

  if (data.status === "deleted") {
    await cleanupDeletedInboxArtifacts(db, teamId, current);
  }

  const [result] = await markInboxItems(db, [current], data);

  if (!result) {
    return null;
  }

  return getInboxItemWithTransaction(db, teamId, result.id);
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

export async function updateInboxStatus(db: Database, params: UpdateInboxStatusParams) {
  const current = await getInboxItemInfoFromD1(requireInboxItemsD1(db), {
    inboxId: params.id,
  });

  if (!current) {
    return;
  }

  await markInboxItems(db, [current], {
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
  db: Database,
  params: UpdateInboxStatusToNoMatchParams,
): Promise<UpdateInboxStatusToNoMatchResult> {
  const toUpdate: InboxItemRecord[] = [];
  let cursor: string | null = null;

  while (true) {
    const result = await getPendingInboxItemsToNoMatchFromD1(requireInboxItemsD1(db), {
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
    await markInboxItems(db, toUpdate, {
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
