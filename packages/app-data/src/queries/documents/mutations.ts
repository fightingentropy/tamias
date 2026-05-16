import {
  deleteDocumentRecord,
  getDocumentById,
  updateDocumentByName,
  updateDocumentProcessingStatus as updateDocumentRecordProcessingStatus,
  updateDocumentsStatusByNames,
  type DocumentProcessingStatus,
} from "./records";
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
  db: Database,
  params: CheckDocumentAttachmentsParams,
) {
  const document = await getDocumentById(db, {
    teamId: params.teamId,
    documentId: params.id,
  });

  if (!document?.pathTokens?.length) {
    return { hasAttachments: false, attachments: [] };
  }

  const attachments = await getTransactionAttachmentsByPathKeys(db, {
    teamId: params.teamId,
    pathKeys: [document.pathTokens],
  });

  return {
    hasAttachments: attachments.length > 0,
    attachments,
    documentName: document.name,
  };
}

export async function deleteDocument(db: Database, params: DeleteDocumentParams) {
  const result = await deleteDocumentRecord(db, {
    teamId: params.teamId,
    id: params.id,
  });

  if (!result) {
    return null;
  }

  await deleteDocumentTagAssignments(db, params.teamId, result.id);

  if (result.pathTokens?.length) {
    await deleteTransactionAttachmentsByPathKeys(db, {
      teamId: params.teamId,
      pathKeys: [result.pathTokens],
    });
  }

  return result;
}

export async function updateDocuments(db: Database, params: UpdateDocumentsParams) {
  const { ids, teamId, processingStatus } = params;

  if (!ids?.length) {
    return [];
  }

  return updateDocumentsStatusByNames(db, {
    teamId,
    names: ids,
    processingStatus,
  });
}

export async function updateDocumentByPath(db: Database, params: UpdateDocumentByPathParams) {
  const { pathTokens, teamId, ...rest } = params;

  if (!pathTokens?.length) {
    return [];
  }

  return updateDocumentByName(db, {
    teamId,
    name: pathTokens.join("/"),
    ...rest,
  });
}

export async function updateDocumentByFileName(
  db: Database,
  params: UpdateDocumentByFileNameParams,
) {
  const [result] = await updateDocumentByName(db, {
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
  db: Database,
  params: UpdateDocumentProcessingStatusParams,
) {
  const { id, processingStatus } = params;

  return updateDocumentRecordProcessingStatus(db, {
    id,
    processingStatus,
  });
}
