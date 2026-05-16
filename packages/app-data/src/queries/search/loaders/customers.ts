import { createDatabase } from "../../../client";
import {
  getCustomersPageFromD1,
  requireCustomersD1,
  searchCustomersFromD1,
} from "../../customers/d1";
import { toCustomerCandidate } from "../candidates";
import { loadCandidatesForSource, matchesSearchTerm, matchesSemanticCandidate } from "../helpers";
import type { RawSearchCandidateLoadParams, SearchCandidateLoadParams } from "../types";

export async function loadCustomerCandidates(params: SearchCandidateLoadParams) {
  const itemsPerTableLimit = params.itemsPerTableLimit ?? 5;
  const d1 = requireCustomersD1(params.db ?? createDatabase());

  return loadCandidatesForSource({
    searchTerm: params.searchTerm,
    itemsPerTableLimit,
    loadSearch: params.searchTerm
      ? (limit) =>
          searchCustomersFromD1(d1, {
            teamId: params.teamId,
            query: params.searchTerm!,
            status: params.status,
            limit,
          })
      : undefined,
    loadPage: (cursor, pageSize) =>
      getCustomersPageFromD1(d1, {
        teamId: params.teamId,
        cursor,
        pageSize,
        order: "desc",
      }),
    toCandidate: (customer) => (customer.isArchived ? null : toCustomerCandidate(customer)),
    matchesCandidate: (candidate) => matchesSemanticCandidate(candidate, params),
  });
}

export async function loadRawCustomerCandidates(params: RawSearchCandidateLoadParams) {
  const d1 = requireCustomersD1(params.db ?? createDatabase());

  return loadCandidatesForSource({
    searchTerm: params.searchTerm,
    itemsPerTableLimit: params.itemsPerTableLimit,
    loadSearch: params.searchTerm
      ? (limit) =>
          searchCustomersFromD1(d1, {
            teamId: params.teamId,
            query: params.searchTerm!,
            limit,
          })
      : undefined,
    loadPage: (cursor, pageSize) =>
      getCustomersPageFromD1(d1, {
        teamId: params.teamId,
        cursor,
        pageSize,
        order: "desc",
      }),
    toCandidate: (customer) => (customer.isArchived ? null : toCustomerCandidate(customer)),
    matchesCandidate: (candidate) => matchesSearchTerm(candidate, params.searchTerm),
  });
}
