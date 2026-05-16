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
  db: Database,
  params: GlobalSemanticSearchParams,
): Promise<GlobalSearchReturnType[]> {
  const candidates = await loadSearchCandidates({ ...params, db });

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

export async function globalSearchQuery(db: Database, params: GlobalSearchParams) {
  const itemsPerTableLimit = params.itemsPerTableLimit ?? 5;
  const candidates = await loadRawSearchCandidates({
    db,
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
