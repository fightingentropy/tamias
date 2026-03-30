import {
  type DocumentProcessingStatus,
  type DocumentRecord,
  type DocumentTagAssignmentRecord,
  deleteDocumentInConvex,
  deleteDocumentTagAssignmentInConvex,
  getDocumentByIdFromConvex,
  getDocumentByNameFromConvex,
  getDocumentsByIdsFromConvex,
  getDocumentsPageFromConvex,
  getDocumentTagAssignmentsForDocumentIdsFromConvex,
  getTaggedDocumentsPageFromConvex,
  searchDocumentsFromConvex,
  updateDocumentByNameInConvex,
  updateDocumentProcessingStatusInConvex,
  updateDocumentsStatusByNamesInConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../client";
import { cacheAcrossRequests } from "../utils/short-lived-cache";
import {
  deleteTransactionAttachmentsByPathKeys,
  getTransactionAttachmentsByPathKeys,
} from "./transaction-attachments";

const DOCUMENT_PAGE_CURSOR_PREFIX = "document:";

type IndexedDocumentCursorState = {
  sourceCursor: string | null;
  sourceExhausted: boolean;
  bufferedIds: string[];
};

function groupAssignmentsByDocumentId(
  assignments: DocumentTagAssignmentRecord[],
) {
  const assignmentsByDocumentId = new Map<
    string,
    DocumentTagAssignmentRecord[]
  >();

  for (const assignment of assignments) {
    const current = assignmentsByDocumentId.get(assignment.documentId) ?? [];
    current.push(assignment);
    assignmentsByDocumentId.set(assignment.documentId, current);
  }

  return assignmentsByDocumentId;
}

async function getAssignmentsByDocumentId(
  teamId: string,
  documentIds: string[],
) {
  if (documentIds.length === 0) {
    return new Map<string, DocumentTagAssignmentRecord[]>();
  }

  const assignments = await getDocumentTagAssignmentsForDocumentIdsFromConvex({
    teamId,
    documentIds,
  });

  return groupAssignmentsByDocumentId(assignments);
}

function isFolderPlaceholder(document: Pick<DocumentRecord, "name">) {
  return document.name.endsWith(".folderPlaceholder");
}

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeDocumentQuery(query: string | null | undefined) {
  const normalized = query?.trim();
  return normalized ? normalized : null;
}

function tokenizeDocumentText(document: Partial<DocumentRecord>) {
  const combined = [
    document.title,
    document.summary,
    document.body,
    document.content,
    document.tag,
    document.name,
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join(" ");

  return new Set(
    combined
      .split(/[^a-z0-9]+/i)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3),
  );
}

function matchesQuery(document: DocumentRecord, query: string) {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    return true;
  }

  const haystack = [
    document.name,
    document.title,
    document.summary,
    document.body,
    document.content,
    document.tag,
  ]
    .map((value) => normalizeText(value))
    .join("\n");

  return tokens.every((token) => haystack.includes(token));
}

function matchesDateRange(
  document: Pick<DocumentRecord, "date">,
  start?: string | null,
  end?: string | null,
) {
  if (!(start && end)) {
    return true;
  }

  if (!document.date) {
    return false;
  }

  return document.date >= start && document.date <= end;
}

function decodeIndexedDocumentCursor(
  cursor: string | null | undefined,
): IndexedDocumentCursorState {
  if (!cursor?.startsWith(DOCUMENT_PAGE_CURSOR_PREFIX)) {
    return {
      sourceCursor: null,
      sourceExhausted: false,
      bufferedIds: [],
    };
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(
        cursor.slice(DOCUMENT_PAGE_CURSOR_PREFIX.length),
        "base64url",
      ).toString("utf8"),
    ) as Partial<IndexedDocumentCursorState>;

    return {
      sourceCursor:
        typeof parsed.sourceCursor === "string" ? parsed.sourceCursor : null,
      sourceExhausted: parsed.sourceExhausted === true,
      bufferedIds: Array.isArray(parsed.bufferedIds)
        ? parsed.bufferedIds.filter(
            (bufferedId): bufferedId is string =>
              typeof bufferedId === "string",
          )
        : [],
    };
  } catch {
    return {
      sourceCursor: null,
      sourceExhausted: false,
      bufferedIds: [],
    };
  }
}

function encodeIndexedDocumentCursor(state: IndexedDocumentCursorState) {
  return `${DOCUMENT_PAGE_CURSOR_PREFIX}${Buffer.from(
    JSON.stringify(state),
    "utf8",
  ).toString("base64url")}`;
}

function getIndexedDocumentBatchSize(pageSize: number) {
  return Math.min(Math.max(pageSize * 3, 50), 200);
}

function getIndexedDocumentSearchLimit(pageSize: number) {
  return Math.min(Math.max(pageSize * 20, 100), 400);
}

function calculateDocumentSimilarity(
  left: Partial<DocumentRecord>,
  right: Partial<DocumentRecord>,
) {
  const leftTerms = tokenizeDocumentText(left);
  const rightTerms = tokenizeDocumentText(right);

  if (leftTerms.size === 0 || rightTerms.size === 0) {
    return 0;
  }

  let intersection = 0;

  for (const term of leftTerms) {
    if (rightTerms.has(term)) {
      intersection += 1;
    }
  }

  return intersection / Math.max(leftTerms.size, rightTerms.size);
}

function getRelatedDocumentSearchQueries(document: Partial<DocumentRecord>) {
  const tokenQuery = [...tokenizeDocumentText(document)].slice(0, 6).join(" ");

  return [
    document.title,
    document.tag,
    document.name
      ?.split("/")
      .pop()
      ?.replace(/\.[^.]+$/, ""),
    tokenQuery,
  ]
    .map((value) => normalizeText(value))
    .filter(
      (value, index, values) =>
        value.length >= 3 && values.indexOf(value) === index,
    );
}

async function getRecentDocumentsPage(args: { teamId: string; limit: number }) {
  const documents: DocumentRecord[] = [];
  let cursor: string | null = null;

  while (documents.length < args.limit) {
    const result = await getDocumentsPageFromConvex({
      teamId: args.teamId,
      cursor,
      pageSize: Math.max(args.limit * 2, 20),
      order: "desc",
    });

    documents.push(
      ...result.page.filter((document) => !isFolderPlaceholder(document)),
    );

    if (result.isDone) {
      break;
    }

    cursor = result.continueCursor;
  }

  return documents.slice(0, args.limit);
}

async function getDocumentSearchCandidates(args: {
  teamId: string;
  query: string;
  limit: number;
}) {
  return (
    await searchDocumentsFromConvex({
      teamId: args.teamId,
      query: args.query,
      limit: args.limit,
    })
  )
    .filter((document) => !isFolderPlaceholder(document))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function getRelatedDocumentCandidates(args: {
  teamId: string;
  source: DocumentRecord;
  pageSize: number;
}) {
  const queries = getRelatedDocumentSearchQueries(args.source);

  if (queries.length === 0) {
    return [];
  }

  const searchResults = await Promise.all(
    queries.map((query) =>
      searchDocumentsFromConvex({
        teamId: args.teamId,
        query,
        limit: Math.max(args.pageSize * 4, 20),
      }),
    ),
  );

  return [
    ...new Map(
      searchResults
        .flat()
        .filter((document) => !isFolderPlaceholder(document))
        .filter((document) => document.id !== args.source.id)
        .map((document) => [document.id, document]),
    ).values(),
  ];
}

async function getDocumentsByIdsInOrder(args: {
  teamId: string;
  documentIds: string[];
}) {
  if (args.documentIds.length === 0) {
    return [];
  }

  const documents = (
    await Promise.all(
      Array.from(
        {
          length: Math.ceil(args.documentIds.length / 200),
        },
        (_, index) =>
          getDocumentsByIdsFromConvex({
            teamId: args.teamId,
            documentIds: args.documentIds.slice(index * 200, (index + 1) * 200),
          }),
      ),
    )
  ).flat();
  const documentsById = new Map(
    documents.map((document) => [document.id, document]),
  );

  return args.documentIds.flatMap((documentId) => {
    const document = documentsById.get(documentId);

    return document ? [document] : [];
  });
}

async function attachAssignments<TDocument extends { id: string }>(
  teamId: string,
  documents: TDocument[],
) {
  const assignmentsByDocumentId = await getAssignmentsByDocumentId(
    teamId,
    documents.map((document) => document.id),
  );

  return documents.map((document) => ({
    ...document,
    documentTagAssignments: assignmentsByDocumentId.get(document.id) ?? [],
  }));
}

async function deleteDocumentTagAssignments(
  teamId: string,
  documentId: string,
) {
  const assignments = await getDocumentTagAssignmentsForDocumentIdsFromConvex({
    teamId,
    documentIds: [documentId],
  });

  for (const assignment of assignments) {
    await deleteDocumentTagAssignmentInConvex({
      teamId,
      documentId,
      tagId: assignment.tagId,
    });
  }
}

export type GetDocumentQueryParams = {
  teamId: string;
  id?: string | null;
  filePath?: string | null;
};

export async function getDocumentById(
  _db: Database,
  params: GetDocumentQueryParams,
) {
  const document = params.id
    ? await getDocumentByIdFromConvex({
        teamId: params.teamId,
        documentId: params.id,
      })
    : params.filePath
      ? await getDocumentByNameFromConvex({
          teamId: params.teamId,
          name: params.filePath,
        })
      : null;

  if (!document || isFolderPlaceholder(document)) {
    return null;
  }

  if (params.filePath && document.name !== params.filePath) {
    return null;
  }

  const assignmentsByDocumentId = await getAssignmentsByDocumentId(
    params.teamId,
    [document.id],
  );

  return {
    ...document,
    documentTagAssignments: assignmentsByDocumentId.get(document.id) ?? [],
  };
}

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

export async function getDocuments(_db: Database, params: GetDocumentsParams) {
  const {
    teamId,
    pageSize = 20,
    cursor,
    tags,
    q,
    start,
    end,
    language,
  } = params;
  const normalizedQuery = normalizeDocumentQuery(q);
  const cursorState = decodeIndexedDocumentCursor(cursor);
  const hasTagFilter = Boolean(tags?.length);

  let sourceCursor = cursorState.sourceCursor;
  let sourceExhausted = cursorState.sourceExhausted;
  let bufferedIds = [...cursorState.bufferedIds];
  const eligibleDocuments: DocumentRecord[] = [];

  const matchesIndexedDocumentCandidate = (document: DocumentRecord) => {
    if (isFolderPlaceholder(document)) {
      return false;
    }

    if (language && document.language !== language) {
      return false;
    }

    if (normalizedQuery && !matchesQuery(document, normalizedQuery)) {
      return false;
    }

    return matchesDateRange(document, start, end);
  };

  while (eligibleDocuments.length <= pageSize && bufferedIds.length > 0) {
    const takeCount = pageSize + 1 - eligibleDocuments.length;
    const bufferedDocuments = await getDocumentsByIdsInOrder({
      teamId,
      documentIds: bufferedIds.slice(0, takeCount),
    });

    bufferedIds = bufferedIds.slice(takeCount);
    eligibleDocuments.push(
      ...bufferedDocuments.filter(matchesIndexedDocumentCandidate),
    );
  }

  if (
    eligibleDocuments.length <= pageSize &&
    !hasTagFilter &&
    normalizedQuery &&
    !sourceExhausted &&
    !sourceCursor &&
    bufferedIds.length === 0
  ) {
    const searchCandidates = await getDocumentSearchCandidates({
      teamId,
      query: normalizedQuery,
      limit: getIndexedDocumentSearchLimit(pageSize),
    });

    eligibleDocuments.push(
      ...searchCandidates.filter(matchesIndexedDocumentCandidate),
    );
    sourceExhausted = true;
  }

  while (eligibleDocuments.length <= pageSize && !sourceExhausted) {
    const previousSourceCursor = sourceCursor;
    const result = hasTagFilter
      ? await getTaggedDocumentsPageFromConvex({
          teamId,
          tagIds: tags ?? [],
          cursor: sourceCursor,
          pageSize: getIndexedDocumentBatchSize(pageSize),
          order: "desc",
          start,
          end,
        })
      : await getDocumentsPageFromConvex({
          teamId,
          cursor: sourceCursor,
          pageSize: getIndexedDocumentBatchSize(pageSize),
          order: "desc",
        });

    eligibleDocuments.push(
      ...result.page.filter(matchesIndexedDocumentCandidate),
    );

    sourceCursor = result.isDone ? null : result.continueCursor;
    sourceExhausted = result.isDone;

    if (result.page.length === 0 && (result.isDone || sourceCursor === previousSourceCursor)) {
      break;
    }
  }

  const page = eligibleDocuments.slice(0, pageSize);
  const nextBufferedIds = [
    ...eligibleDocuments.slice(pageSize).map((document) => document.id),
    ...bufferedIds,
  ];
  const hasNextPage = nextBufferedIds.length > 0;
  const nextCursor = hasNextPage
    ? encodeIndexedDocumentCursor({
        sourceCursor,
        sourceExhausted,
        bufferedIds: nextBufferedIds,
      })
    : undefined;
  const data = await attachAssignments(teamId, page);

  return {
    meta: {
      cursor: nextCursor ?? null,
      hasPreviousPage: Boolean(cursor),
      hasNextPage,
    },
    data,
  };
}

export type GetRelatedDocumentsParams = {
  id: string;
  pageSize: number;
  teamId: string;
};

export type GetRecentDocumentsParams = {
  teamId: string;
  limit?: number;
};

async function getRecentDocumentsImpl(
  _db: Database,
  params: GetRecentDocumentsParams,
) {
  const { teamId, limit = 5 } = params;
  const data = await getRecentDocumentsPage({
    teamId,
    limit,
  });

  return {
    data: await attachAssignments(teamId, data),
    total: data.length,
  };
}

export const getRecentDocuments = cacheAcrossRequests({
  keyPrefix: "recent-documents",
  keyFn: (params: GetRecentDocumentsParams) =>
    [params.teamId, params.limit ?? 5].join(":"),
  load: getRecentDocumentsImpl,
});

export type GetRelatedDocumentsResponse = DocumentRecord & {
  titleSimilarity: number;
  documentTagAssignments: DocumentTagAssignmentRecord[];
};

export async function getRelatedDocuments(
  _db: Database,
  params: GetRelatedDocumentsParams,
) {
  const { id, pageSize, teamId } = params;
  const source = await getDocumentByIdFromConvex({
    teamId,
    documentId: id,
  });

  if (!source || isFolderPlaceholder(source)) {
    return [];
  }

  const candidates = (
    await getRelatedDocumentCandidates({
      teamId,
      source,
      pageSize,
    })
  )
    .map((document) => ({
      ...document,
      titleSimilarity: calculateDocumentSimilarity(source, document),
    }))
    .filter((document) => document.titleSimilarity > 0)
    .sort((left, right) => {
      if (right.titleSimilarity !== left.titleSimilarity) {
        return right.titleSimilarity - left.titleSimilarity;
      }

      return right.createdAt.localeCompare(left.createdAt);
    })
    .slice(0, pageSize);

  return attachAssignments(teamId, candidates);
}

export type DeleteDocumentParams = {
  id: string;
  teamId: string;
};

export type CheckDocumentAttachmentsParams = {
  id: string;
  teamId: string;
};

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

export type UpdateDocumentsParams = {
  ids: string[];
  teamId: string;
  processingStatus: DocumentProcessingStatus;
};

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

export type UpdateDocumentProcessingStatusParams = {
  id: string;
  processingStatus: DocumentProcessingStatus;
};

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
