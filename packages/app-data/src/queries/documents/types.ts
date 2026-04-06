import type {
  DocumentProcessingStatus,
  DocumentRecord,
  DocumentTagAssignmentRecord,
} from "@tamias/app-data-convex";

export type GetDocumentQueryParams = {
  teamId: string;
  id?: string | null;
  filePath?: string | null;
};

export type GetDocumentsParams = {
  teamId: string;
  pageSize?: number;
  cursor?: string | null;
  language?: string | null;
  q?: string | null;
  tags?: string[] | null;
  start?: string | null;
  end?: string | null;
};

export type GetRelatedDocumentsParams = {
  id: string;
  pageSize: number;
  teamId: string;
};

export type GetRecentDocumentsParams = {
  teamId: string;
  limit?: number;
};

export type GetRelatedDocumentsResponse = DocumentRecord & {
  titleSimilarity: number;
  documentTagAssignments: DocumentTagAssignmentRecord[];
};

export type DeleteDocumentParams = {
  id: string;
  teamId: string;
};

export type CheckDocumentAttachmentsParams = {
  id: string;
  teamId: string;
};

export type UpdateDocumentsParams = {
  ids: string[];
  teamId: string;
  processingStatus: DocumentProcessingStatus;
};

export type UpdateDocumentByPathParams = {
  pathTokens: string[];
  teamId: string;
  title?: string;
  summary?: string;
  content?: string;
  body?: string;
  tag?: string;
  date?: string;
  language?: string;
  processingStatus?: DocumentProcessingStatus;
  metadata?: Record<string, unknown>;
};

export type UpdateDocumentByFileNameParams = {
  fileName: string;
  teamId: string;
  title?: string;
  summary?: string;
  content?: string;
  body?: string;
  tag?: string;
  date?: string;
  language?: string;
  processingStatus?: DocumentProcessingStatus;
  metadata?: Record<string, unknown>;
};

export type UpdateDocumentProcessingStatusParams = {
  id: string;
  processingStatus: DocumentProcessingStatus;
};
