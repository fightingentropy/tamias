import { getDocumentByIdFromConvex, type DocumentRecord } from "@tamias/app-data-convex";
import type { Database } from "../../client";
import { reuseQueryResult } from "../../utils/request-cache";
import {
  attachAssignments,
  getDocumentSimilarity,
  getRecentDocumentsPage,
  getRelatedDocumentCandidates,
  isFolderPlaceholder,
} from "./shared";
import type { GetRecentDocumentsParams, GetRelatedDocumentsParams } from "./types";

async function getRecentDocumentsImpl(_db: Database, params: GetRecentDocumentsParams) {
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

export const getRecentDocuments = reuseQueryResult({
  keyPrefix: "recent-documents",
  keyFn: (params: GetRecentDocumentsParams) => [params.teamId, params.limit ?? 5].join(":"),
  load: getRecentDocumentsImpl,
});

export async function getRelatedDocuments(_db: Database, params: GetRelatedDocumentsParams) {
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
    .map((document: DocumentRecord) => ({
      ...document,
      titleSimilarity: getDocumentSimilarity(source, document),
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
