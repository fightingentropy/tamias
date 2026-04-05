export type {
  CheckDocumentAttachmentsParams,
  DeleteDocumentParams,
  GetDocumentQueryParams,
  GetDocumentsParams,
  GetRecentDocumentsParams,
  GetRelatedDocumentsParams,
  GetRelatedDocumentsResponse,
  UpdateDocumentByFileNameParams,
  UpdateDocumentByPathParams,
  UpdateDocumentProcessingStatusParams,
  UpdateDocumentsParams,
} from "./documents/types";
export { getDocumentById, getDocuments } from "./documents/reads";
export { getRecentDocuments, getRelatedDocuments } from "./documents/related";
export {
  checkDocumentAttachments,
  deleteDocument,
  updateDocumentByFileName,
  updateDocumentByPath,
  updateDocumentProcessingStatus,
  updateDocuments,
} from "./documents/mutations";
