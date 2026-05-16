import type { Database } from "../../client";
import { deleteAccountingSyncRecordsForTransactions } from "../accounting-sync";
import {
  deleteTransactionAttachmentsByIdsFromD1,
  deleteTransactionAttachmentsByPathKeysFromD1,
  getTransactionAttachmentFromD1,
  getTransactionAttachmentsByIdsFromD1,
  getTransactionAttachmentsByPathKeysFromD1,
  getTransactionAttachmentsForTransactionIdsFromD1,
  requireTransactionAttachmentsD1,
} from "./d1";
import { syncTransactionHasAttachmentFlags } from "./sync";

type GetTransactionAttachmentsByIdsParams = {
  teamId: string;
  attachmentIds: string[];
};

type GetTransactionAttachmentsForTransactionIdsParams = {
  teamId: string;
  transactionIds: string[];
};

type GetTransactionAttachmentsByPathKeysParams = {
  teamId: string;
  pathKeys: string[][];
};

type DeleteTransactionAttachmentsByIdsParams = {
  teamId: string;
  attachmentIds: string[];
};

type DeleteTransactionAttachmentsByPathKeysParams = {
  teamId: string;
  pathKeys: string[][];
};

type GetTransactionAttachmentParams = {
  transactionId: string;
  attachmentId: string;
  teamId: string;
};

export async function getTransactionAttachmentsByIds(
  db: Database,
  params: GetTransactionAttachmentsByIdsParams,
) {
  return getTransactionAttachmentsByIdsFromD1(requireTransactionAttachmentsD1(db), params);
}

export async function getTransactionAttachmentsForTransactionIds(
  db: Database,
  params: GetTransactionAttachmentsForTransactionIdsParams,
) {
  return getTransactionAttachmentsForTransactionIdsFromD1(
    requireTransactionAttachmentsD1(db),
    params,
  );
}

export async function getTransactionAttachmentsByPathKeys(
  db: Database,
  params: GetTransactionAttachmentsByPathKeysParams,
) {
  return getTransactionAttachmentsByPathKeysFromD1(requireTransactionAttachmentsD1(db), params);
}

export async function deleteTransactionAttachmentsByIds(
  db: Database,
  params: DeleteTransactionAttachmentsByIdsParams,
) {
  const d1 = requireTransactionAttachmentsD1(db);
  const result = await deleteTransactionAttachmentsByIdsFromD1(d1, params);

  if (result.affectedTransactionIds.length > 0) {
    await syncTransactionHasAttachmentFlags({
      d1,
      teamId: params.teamId,
      transactionIds: result.affectedTransactionIds,
    });
    await deleteAccountingSyncRecordsForTransactions(db, {
      teamId: params.teamId,
      transactionIds: result.affectedTransactionIds,
    });
  }

  return {
    deletedIds: result.deletedIds,
    count: result.count,
  };
}

export async function deleteTransactionAttachmentsByPathKeys(
  db: Database,
  params: DeleteTransactionAttachmentsByPathKeysParams,
) {
  const d1 = requireTransactionAttachmentsD1(db);
  const result = await deleteTransactionAttachmentsByPathKeysFromD1(d1, params);

  if (result.affectedTransactionIds.length > 0) {
    await syncTransactionHasAttachmentFlags({
      d1,
      teamId: params.teamId,
      transactionIds: result.affectedTransactionIds,
    });
    await deleteAccountingSyncRecordsForTransactions(db, {
      teamId: params.teamId,
      transactionIds: result.affectedTransactionIds,
    });
  }

  return {
    deletedIds: result.deletedIds,
    count: result.count,
  };
}

export async function getTransactionAttachment(
  db: Database,
  params: GetTransactionAttachmentParams,
) {
  const { transactionId, attachmentId, teamId } = params;
  return getTransactionAttachmentFromD1(requireTransactionAttachmentsD1(db), {
    teamId,
    transactionId,
    attachmentId,
  });
}
