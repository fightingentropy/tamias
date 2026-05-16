import type { Database } from "../../client";
import { getTaggedDocumentIdPage } from "../document-tag-assignments";
import {
  getDocumentById as getDocumentRecordById,
  getDocumentByName,
  getDocumentsPage,
  type DocumentRecord,
} from "./records";
import {
  attachAssignments,
  decodeIndexedDocumentCursor,
  encodeIndexedDocumentCursor,
  getDocumentSearchCandidates,
  getDocumentsByIdsInOrder,
  getIndexedDocumentBatchSize,
  getIndexedDocumentSearchLimit,
  isFolderPlaceholder,
  matchesDateRange,
  matchesQuery,
  normalizeDocumentQuery,
} from "./shared";
import type { GetDocumentQueryParams, GetDocumentsParams } from "./types";

export async function getDocumentById(db: Database, params: GetDocumentQueryParams) {
  const document = params.id
    ? await getDocumentRecordById(db, {
        teamId: params.teamId,
        documentId: params.id,
      })
    : params.filePath
      ? await getDocumentByName(db, {
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

  const [documentWithAssignments] = await attachAssignments(db, params.teamId, [document]);

  return documentWithAssignments ?? null;
}

export async function getDocuments(db: Database, params: GetDocumentsParams) {
  const { teamId, pageSize = 20, cursor, tags, q, start, end, language } = params;
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
    const bufferedDocuments = await getDocumentsByIdsInOrder(db, {
      teamId,
      documentIds: bufferedIds.slice(0, takeCount),
    });

    bufferedIds = bufferedIds.slice(takeCount);
    eligibleDocuments.push(...bufferedDocuments.filter(matchesIndexedDocumentCandidate));
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
      db,
      teamId,
      query: normalizedQuery,
      limit: getIndexedDocumentSearchLimit(pageSize),
    });

    eligibleDocuments.push(...searchCandidates.filter(matchesIndexedDocumentCandidate));
    sourceExhausted = true;
  }

  while (eligibleDocuments.length <= pageSize && !sourceExhausted) {
    const previousSourceCursor = sourceCursor;
    const result = hasTagFilter
      ? await getTaggedDocumentIdPage(db, {
          teamId,
          tagIds: tags ?? [],
          cursor: sourceCursor,
          pageSize: getIndexedDocumentBatchSize(pageSize),
          order: "desc",
          start,
          end,
        })
      : await getDocumentsPage(db, {
          teamId,
          cursor: sourceCursor,
          pageSize: getIndexedDocumentBatchSize(pageSize),
          order: "desc",
        });

    const documents = hasTagFilter
      ? await getDocumentsByIdsInOrder(db, {
          teamId,
          documentIds: "documentIds" in result ? result.documentIds : [],
        })
      : "page" in result
        ? result.page
        : [];

    eligibleDocuments.push(...documents.filter(matchesIndexedDocumentCandidate));

    sourceCursor = result.isDone ? null : result.continueCursor;
    sourceExhausted = result.isDone;

    if (documents.length === 0 && (result.isDone || sourceCursor === previousSourceCursor)) {
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
  const data = await attachAssignments(db, teamId, page);

  return {
    meta: {
      cursor: nextCursor ?? null,
      hasPreviousPage: Boolean(cursor),
      hasNextPage,
    },
    data,
  };
}
