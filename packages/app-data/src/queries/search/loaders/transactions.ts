import { getTransactionsPageFromConvex } from "@tamias/app-data-convex";
import { toTransactionCandidate } from "../candidates";
import {
  loadCandidatesForSource,
  matchesSearchTerm,
  matchesSemanticCandidate,
} from "../helpers";
import type {
  RawSearchCandidateLoadParams,
  SearchCandidateLoadParams,
} from "../types";
import { getTransactionStatusExclusions } from "./filters";

export async function loadTransactionCandidates(
  params: SearchCandidateLoadParams,
) {
  const itemsPerTableLimit = params.itemsPerTableLimit ?? 5;

  return loadCandidatesForSource({
    searchTerm: params.searchTerm,
    itemsPerTableLimit,
    loadPage: (cursor, pageSize) =>
      getTransactionsPageFromConvex({
        teamId: params.teamId,
        cursor,
        pageSize,
        order: "desc",
        dateGte: params.startDate,
        statusesNotIn: getTransactionStatusExclusions(params.status),
      }),
    toCandidate: (transaction) => toTransactionCandidate(transaction),
    matchesCandidate: (candidate) => matchesSemanticCandidate(candidate, params),
  });
}

export async function loadRawTransactionCandidates(
  params: RawSearchCandidateLoadParams,
) {
  return loadCandidatesForSource({
    searchTerm: params.searchTerm,
    itemsPerTableLimit: params.itemsPerTableLimit,
    loadPage: (cursor, pageSize) =>
      getTransactionsPageFromConvex({
        teamId: params.teamId,
        cursor,
        pageSize,
        order: "desc",
      }),
    toCandidate: (transaction) => toTransactionCandidate(transaction),
    matchesCandidate: (candidate) =>
      matchesSearchTerm(candidate, params.searchTerm),
  });
}
