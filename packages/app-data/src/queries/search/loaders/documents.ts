import { createDatabase } from "../../../client";
import { getDocumentsPage, searchDocuments } from "../../documents/records";
import { isSearchableDocument, toDocumentCandidate } from "../candidates";
import { loadCandidatesForSource, matchesSearchTerm, matchesSemanticCandidate } from "../helpers";
import type { RawSearchCandidateLoadParams, SearchCandidateLoadParams } from "../types";

export async function loadDocumentCandidates(params: SearchCandidateLoadParams) {
  const itemsPerTableLimit = params.itemsPerTableLimit ?? 5;
  const db = params.db ?? createDatabase();

  return loadCandidatesForSource({
    searchTerm: params.searchTerm,
    itemsPerTableLimit,
    loadSearch: params.searchTerm
      ? (limit) =>
          searchDocuments(db, {
            teamId: params.teamId,
            query: params.searchTerm!,
            limit,
          })
      : undefined,
    loadPage: (cursor, pageSize) =>
      getDocumentsPage(db, {
        teamId: params.teamId,
        cursor,
        pageSize,
        order: "desc",
      }),
    toCandidate: (document) =>
      isSearchableDocument(document) ? toDocumentCandidate(document) : null,
    matchesCandidate: (candidate) => matchesSemanticCandidate(candidate, params),
  });
}

export async function loadRawDocumentCandidates(params: RawSearchCandidateLoadParams) {
  const db = params.db ?? createDatabase();

  return loadCandidatesForSource({
    searchTerm: params.searchTerm,
    itemsPerTableLimit: params.itemsPerTableLimit,
    loadSearch: params.searchTerm
      ? (limit) =>
          searchDocuments(db, {
            teamId: params.teamId,
            query: params.searchTerm!,
            limit,
          })
      : undefined,
    loadPage: (cursor, pageSize) =>
      getDocumentsPage(db, {
        teamId: params.teamId,
        cursor,
        pageSize,
        order: "desc",
      }),
    toCandidate: (document) =>
      isSearchableDocument(document) ? toDocumentCandidate(document) : null,
    matchesCandidate: (candidate) => matchesSearchTerm(candidate, params.searchTerm),
  });
}
