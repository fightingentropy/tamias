import {
  type DocumentProcessingStatus,
  deleteDocumentInConvex,
  getDocumentByIdFromConvex,
  updateDocumentByNameInConvex,
  updateDocumentProcessingStatusInConvex,
  updateDocumentsStatusByNamesInConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../../client";
import {
  deleteTransactionAttachmentsByPathKeys,
  getTransactionAttachmentsByPathKeys,
} from "../transaction-attachments";
import { deleteDocumentTagAssignments } from "./shared";
import type {
  CheckDocumentAttachmentsParams,
  DeleteDocumentParams,
  UpdateDocumentByFileNameParams,
  UpdateDocumentByPathParams,
  UpdateDocumentProcessingStatusParams,
  UpdateDocumentsParams,
} from "./types";

export async function checkDocumentAttachments(
  _db: Database,
  params: CheckDocumentAttachmentsParams,
) {
  const document = await getDocumentByIdFromConvex({
    teamId: params.teamId,
    documentId: params.id,
  });

  if (!document?.pathTokens?.length) {
    return { hasAttachments: false, attachments: [] };
  }

  const attachments = await getTransactionAttachmentsByPathKeys({
    teamId: params.teamId,
    pathKeys: [document.pathTokens],
  });

  return {
    hasAttachments: attachments.length > 0,
    attachments,
    documentName: document.name,
  };
}

export async function deleteDocument(
  _db: Database,
  params: DeleteDocumentParams,
) {
  const result = await deleteDocumentInConvex({
    teamId: params.teamId,
    id: params.id,
  });

  if (!result) {
    return null;
  }

  await deleteDocumentTagAssignments(params.teamId, result.id);

  if (result.pathTokens?.length) {
    await deleteTransactionAttachmentsByPathKeys({
      teamId: params.teamId,
      pathKeys: [result.pathTokens],
    });
  }

  return result;
}

export async function updateDocuments(
  _db: Database,
  params: UpdateDocumentsParams,
) {
  const { ids, teamId, processingStatus } = params;

  if (!ids?.length) {
    return [];
  }

  return updateDocumentsStatusByNamesInConvex({
    teamId,
    names: ids,
    processingStatus,
  });
}

export async function updateDocumentByPath(
  _db: Database,
  params: UpdateDocumentByPathParams,
) {
  const { pathTokens, teamId, ...rest } = params;

  if (!pathTokens?.length) {
    return [];
  }

  return updateDocumentByNameInConvex({
    teamId,
    name: pathTokens.join("/"),
    ...rest,
  });
}

export async function updateDocumentByFileName(
  _db: Database,
  params: UpdateDocumentByFileNameParams,
) {
  const [result] = await updateDocumentByNameInConvex({
    teamId: params.teamId,
    name: params.fileName,
    title: params.title,
    summary: params.summary,
    content: params.content,
    body: params.body,
    tag: params.tag,
    date: params.date,
    language: params.language,
    processingStatus: params.processingStatus,
    metadata: params.metadata,
  });

  return result;
}

export async function updateDocumentProcessingStatus(
  _db: Database,
  params: UpdateDocumentProcessingStatusParams,
) {
  const { id, processingStatus } = params;

  return updateDocumentProcessingStatusInConvex({
    id,
    processingStatus,
  });
}
