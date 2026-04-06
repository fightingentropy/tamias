import { convexApi, createClient, serviceArgs } from "./base";

export type DocumentProcessingStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export type DocumentRecord = {
  id: string;
  teamId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown> | null;
  pathTokens: string[];
  parentId: string | null;
  objectId: string | null;
  ownerId: string | null;
  tag: string | null;
  title: string | null;
  body: string | null;
  summary: string | null;
  content: string | null;
  date: string | null;
  language: string | null;
  processingStatus: DocumentProcessingStatus;
};

export type UpsertDocumentInConvexInput = {
  teamId: string;
  id?: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown> | null;
  pathTokens?: string[];
  parentId?: string | null;
  objectId?: string | null;
  ownerId?: string | null;
  tag?: string | null;
  title?: string | null;
  body?: string | null;
  summary?: string | null;
  content?: string | null;
  date?: string | null;
  language?: string | null;
  processingStatus?: DocumentProcessingStatus;
};

export type UpdateDocumentByNameInConvexInput = {
  teamId: string;
  name: string;
  title?: string | null;
  summary?: string | null;
  content?: string | null;
  body?: string | null;
  tag?: string | null;
  date?: string | null;
  language?: string | null;
  processingStatus?: DocumentProcessingStatus;
  metadata?: Record<string, unknown> | null;
};

export async function getDocumentsFromConvex(args: { teamId: string }) {
  const documents: DocumentRecord[] = [];
  let cursor: string | null = null;

  while (true) {
    const result = await getDocumentsPageFromConvex({
      teamId: args.teamId,
      cursor,
      pageSize: 200,
      order: "desc",
    });

    documents.push(...result.page);

    if (result.isDone) {
      return documents;
    }

    cursor = result.continueCursor;
  }
}

export async function getDocumentsPageFromConvex(args: {
  teamId: string;
  cursor?: string | null;
  pageSize: number;
  order?: "asc" | "desc";
}) {
  return createClient().query(
    convexApi.documents.serviceListDocumentsPage,
    serviceArgs({
      teamId: args.teamId,
      order: args.order,
      paginationOpts: {
        numItems: args.pageSize,
        cursor: args.cursor ?? null,
      },
    }),
  ) as Promise<{
    page: DocumentRecord[];
    isDone: boolean;
    continueCursor: string;
  }>;
}

export async function searchDocumentsFromConvex(args: {
  teamId: string;
  query: string;
  limit?: number;
}) {
  return createClient().query(
    convexApi.documents.serviceSearchDocuments,
    serviceArgs({
      teamId: args.teamId,
      query: args.query,
      limit: args.limit,
    }),
  ) as Promise<DocumentRecord[]>;
}

export async function getTaggedDocumentsPageFromConvex(args: {
  teamId: string;
  tagIds: string[];
  pageSize: number;
  cursor?: string | null;
  order?: "asc" | "desc";
  start?: string | null;
  end?: string | null;
}) {
  return createClient().query(
    convexApi.documents.serviceListTaggedDocumentsPage,
    serviceArgs({
      teamId: args.teamId,
      tagIds: args.tagIds,
      pageSize: args.pageSize,
      cursor: args.cursor ?? null,
      order: args.order,
      start: args.start ?? null,
      end: args.end ?? null,
    }),
  ) as Promise<{
    page: DocumentRecord[];
    isDone: boolean;
    continueCursor: string | null;
  }>;
}

export async function rebuildDocumentSearchTextsInConvex(args: {
  teamId?: string | null;
}) {
  return createClient().mutation(
    convexApi.documents.serviceRebuildDocumentSearchTexts,
    serviceArgs({
      teamId: args.teamId ?? null,
    }),
  ) as Promise<
    Array<{
      teamId: string;
      documentCount: number;
      updatedDocumentCount: number;
    }>
  >;
}

export async function getDocumentsByIdsFromConvex(args: {
  teamId: string;
  documentIds: string[];
}) {
  return createClient().query(
    convexApi.documents.serviceGetDocumentsByIds,
    serviceArgs({
      teamId: args.teamId,
      documentIds: args.documentIds,
    }),
  ) as Promise<DocumentRecord[]>;
}

export async function getDocumentByIdFromConvex(args: {
  teamId: string;
  documentId: string;
}) {
  return createClient().query(
    convexApi.documents.serviceGetDocumentById,
    serviceArgs({
      teamId: args.teamId,
      documentId: args.documentId,
    }),
  ) as Promise<DocumentRecord | null>;
}

export async function getDocumentByNameFromConvex(args: {
  teamId: string;
  name: string;
}) {
  return createClient().query(
    convexApi.documents.serviceGetDocumentByName,
    serviceArgs({
      teamId: args.teamId,
      name: args.name,
    }),
  ) as Promise<DocumentRecord | null>;
}

export async function upsertDocumentsInConvex(args: {
  documents: UpsertDocumentInConvexInput[];
}) {
  return createClient().mutation(
    convexApi.documents.serviceUpsertDocuments,
    serviceArgs({
      documents: args.documents.map((document) => ({
        teamId: document.teamId,
        id: document.id,
        name: document.name,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
        metadata: document.metadata,
        pathTokens: document.pathTokens,
        parentId: document.parentId,
        objectId: document.objectId,
        ownerId: document.ownerId,
        tag: document.tag,
        title: document.title,
        body: document.body,
        summary: document.summary,
        content: document.content,
        date: document.date,
        language: document.language,
        processingStatus: document.processingStatus,
      })),
    }),
  ) as Promise<DocumentRecord[]>;
}

export async function deleteDocumentInConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().mutation(
    convexApi.documents.serviceDeleteDocument,
    serviceArgs({
      teamId: args.teamId,
      documentId: args.id,
    }),
  ) as Promise<DocumentRecord | null>;
}

export async function updateDocumentsStatusByNamesInConvex(args: {
  teamId: string;
  names: string[];
  processingStatus: DocumentProcessingStatus;
}) {
  return createClient().mutation(
    convexApi.documents.serviceUpdateDocumentsStatusByNames,
    serviceArgs({
      teamId: args.teamId,
      names: args.names,
      processingStatus: args.processingStatus,
    }),
  ) as Promise<DocumentRecord[]>;
}

export async function updateDocumentByNameInConvex(
  args: UpdateDocumentByNameInConvexInput,
) {
  return createClient().mutation(
    convexApi.documents.serviceUpdateDocumentByName,
    serviceArgs({
      teamId: args.teamId,
      name: args.name,
      title: args.title,
      summary: args.summary,
      content: args.content,
      body: args.body,
      tag: args.tag,
      date: args.date,
      language: args.language,
      processingStatus: args.processingStatus,
      metadata: args.metadata,
    }),
  ) as Promise<DocumentRecord[]>;
}

export async function updateDocumentProcessingStatusInConvex(args: {
  id: string;
  processingStatus: DocumentProcessingStatus;
}) {
  return createClient().mutation(
    convexApi.documents.serviceUpdateDocumentProcessingStatus,
    serviceArgs({
      documentId: args.id,
      processingStatus: args.processingStatus,
    }),
  ) as Promise<Array<{ id: string }>>;
}
