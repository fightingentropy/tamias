import { getCustomersPageFromConvex, searchCustomersFromConvex } from "@tamias/app-data-convex";
import { toCustomerCandidate } from "../candidates";
import { loadCandidatesForSource, matchesSearchTerm, matchesSemanticCandidate } from "../helpers";
import type { RawSearchCandidateLoadParams, SearchCandidateLoadParams } from "../types";

export async function loadCustomerCandidates(params: SearchCandidateLoadParams) {
  const itemsPerTableLimit = params.itemsPerTableLimit ?? 5;

  return loadCandidatesForSource({
    searchTerm: params.searchTerm,
    itemsPerTableLimit,
    loadSearch: params.searchTerm
      ? (limit) =>
          searchCustomersFromConvex({
            teamId: params.teamId,
            query: params.searchTerm!,
            status: params.status,
            limit,
          })
      : undefined,
    loadPage: (cursor, pageSize) =>
      getCustomersPageFromConvex({
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
  return loadCandidatesForSource({
    searchTerm: params.searchTerm,
    itemsPerTableLimit: params.itemsPerTableLimit,
    loadSearch: params.searchTerm
      ? (limit) =>
          searchCustomersFromConvex({
            teamId: params.teamId,
            query: params.searchTerm!,
            limit,
          })
      : undefined,
    loadPage: (cursor, pageSize) =>
      getCustomersPageFromConvex({
        teamId: params.teamId,
        cursor,
        pageSize,
        order: "desc",
      }),
    toCandidate: (customer) => (customer.isArchived ? null : toCustomerCandidate(customer)),
    matchesCandidate: (candidate) => matchesSearchTerm(candidate, params.searchTerm),
  });
}
