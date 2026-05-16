import { toTransactionCandidate } from "../candidates";
import { loadCandidatesForSource, matchesSearchTerm, matchesSemanticCandidate } from "../helpers";
import type { RawSearchCandidateLoadParams, SearchCandidateLoadParams } from "../types";
import { getTransactionStatusExclusions } from "./filters";
import { getTransactionsPageFromD1, requireTransactionsD1 } from "../../transactions/d1";

export async function loadTransactionCandidates(params: SearchCandidateLoadParams) {
  if (!params.db) {
    throw new Error("Transaction search requires Cloudflare D1");
  }

  const db = params.db;
  const itemsPerTableLimit = params.itemsPerTableLimit ?? 5;

  return loadCandidatesForSource({
    searchTerm: params.searchTerm,
    itemsPerTableLimit,
    loadPage: (cursor, pageSize) =>
      getTransactionsPageFromD1(requireTransactionsD1(db), {
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

export async function loadRawTransactionCandidates(params: RawSearchCandidateLoadParams) {
  if (!params.db) {
    throw new Error("Transaction search requires Cloudflare D1");
  }

  const db = params.db;
  return loadCandidatesForSource({
    searchTerm: params.searchTerm,
    itemsPerTableLimit: params.itemsPerTableLimit,
    loadPage: (cursor, pageSize) =>
      getTransactionsPageFromD1(requireTransactionsD1(db), {
        teamId: params.teamId,
        cursor,
        pageSize,
        order: "desc",
      }),
    toCandidate: (transaction) => toTransactionCandidate(transaction),
    matchesCandidate: (candidate) => matchesSearchTerm(candidate, params.searchTerm),
  });
}
