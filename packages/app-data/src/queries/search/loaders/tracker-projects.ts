import {
  getTrackerProjectsPageFromConvex,
  searchTrackerProjectsFromConvex,
} from "@tamias/app-data-convex";
import { toTrackerProjectCandidate } from "../candidates";
import {
  loadCandidatesForSource,
  matchesSearchTerm,
  matchesSemanticCandidate,
} from "../helpers";
import type {
  RawSearchCandidateLoadParams,
  SearchCandidateLoadParams,
} from "../types";
import { getTrackerProjectStatusFilter } from "./filters";

export async function loadTrackerProjectCandidates(
  params: SearchCandidateLoadParams,
) {
  const itemsPerTableLimit = params.itemsPerTableLimit ?? 5;
  const statusFilter = getTrackerProjectStatusFilter(params.status);

  return loadCandidatesForSource({
    searchTerm: params.searchTerm,
    itemsPerTableLimit,
    loadSearch: params.searchTerm
      ? (limit) =>
          searchTrackerProjectsFromConvex({
            teamId: params.teamId,
            query: params.searchTerm!,
            status: statusFilter,
            limit,
          })
      : undefined,
    loadPage: (cursor, pageSize) =>
      getTrackerProjectsPageFromConvex({
        teamId: params.teamId,
        cursor,
        pageSize,
        status: statusFilter,
        order: "desc",
      }),
    toCandidate: (project) => toTrackerProjectCandidate(project),
    matchesCandidate: (candidate) => matchesSemanticCandidate(candidate, params),
  });
}

export async function loadRawTrackerProjectCandidates(
  params: RawSearchCandidateLoadParams,
) {
  return loadCandidatesForSource({
    searchTerm: params.searchTerm,
    itemsPerTableLimit: params.itemsPerTableLimit,
    loadSearch: params.searchTerm
      ? (limit) =>
          searchTrackerProjectsFromConvex({
            teamId: params.teamId,
            query: params.searchTerm!,
            limit,
          })
      : undefined,
    loadPage: (cursor, pageSize) =>
      getTrackerProjectsPageFromConvex({
        teamId: params.teamId,
        cursor,
        pageSize,
        order: "desc",
      }),
    toCandidate: (project) => toTrackerProjectCandidate(project),
    matchesCandidate: (candidate) =>
      matchesSearchTerm(candidate, params.searchTerm),
  });
}
