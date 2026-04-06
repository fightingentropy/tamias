import type { Database } from "../client";
import { matchesSemanticCandidate, rankAndLimitCandidates } from "./search/helpers";
import { loadRawSearchCandidates, loadSearchCandidates } from "./search/loaders";
import type {
  GlobalSearchParams,
  GlobalSearchReturnType,
  GlobalSemanticSearchParams,
} from "./search/types";

export type { GlobalSearchReturnType, GlobalSemanticSearchParams } from "./search/types";

export async function globalSemanticSearchQuery(
  _db: Database,
  params: GlobalSemanticSearchParams,
): Promise<GlobalSearchReturnType[]> {
  const candidates = await loadSearchCandidates(params);

  return rankAndLimitCandidates(
    candidates.filter((candidate) => matchesSemanticCandidate(candidate, params)),
    {
      searchTerm: params.searchTerm,
      relevanceThreshold: 0,
      limit: params.itemsPerTableLimit * 5,
      itemsPerTableLimit: params.itemsPerTableLimit,
    },
  );
}

export async function globalSearchQuery(_db: Database, params: GlobalSearchParams) {
  const itemsPerTableLimit = params.itemsPerTableLimit ?? 5;
  const candidates = await loadRawSearchCandidates({
    teamId: params.teamId,
    searchTerm: params.searchTerm,
    itemsPerTableLimit,
  });

  return rankAndLimitCandidates(candidates, {
    searchTerm: params.searchTerm,
    relevanceThreshold: params.relevanceThreshold,
    limit: params.limit ?? 30,
    itemsPerTableLimit,
  });
}
