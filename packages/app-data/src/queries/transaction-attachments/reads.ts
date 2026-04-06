import {
  deleteTransactionAttachmentsByIdsInConvex,
  deleteTransactionAttachmentsByPathKeysInConvex,
  getTransactionAttachmentFromConvex,
  getTransactionAttachmentsByIdsFromConvex,
  getTransactionAttachmentsByPathKeysFromConvex,
  getTransactionAttachmentsForTransactionIdsFromConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../../client";

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
  params: GetTransactionAttachmentsByIdsParams,
) {
  return getTransactionAttachmentsByIdsFromConvex(params);
}

export async function getTransactionAttachmentsForTransactionIds(params: {
  teamId: string;
  transactionIds: string[];
}) {
  return getTransactionAttachmentsForTransactionIdsFromConvex(params);
}

export async function getTransactionAttachmentsByPathKeys(
  params: GetTransactionAttachmentsByPathKeysParams,
) {
  return getTransactionAttachmentsByPathKeysFromConvex(params);
}

export async function deleteTransactionAttachmentsByIds(
  params: DeleteTransactionAttachmentsByIdsParams,
) {
  return deleteTransactionAttachmentsByIdsInConvex(params);
}

export async function deleteTransactionAttachmentsByPathKeys(
  params: DeleteTransactionAttachmentsByPathKeysParams,
) {
  return deleteTransactionAttachmentsByPathKeysInConvex(params);
}

export async function getTransactionAttachment(
  _db: Database,
  params: GetTransactionAttachmentParams,
) {
  const { transactionId, attachmentId, teamId } = params;
  return getTransactionAttachmentFromConvex({
    teamId,
    transactionId,
    attachmentId,
  });
}
