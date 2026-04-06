import type { GlobalSearchReturnType, SearchCandidate, SearchSourceType } from "../types";
import { calculateRelevance } from "./filters";

export function rankAndLimitCandidates(
  candidates: SearchCandidate[],
  args: {
    searchTerm?: string;
    relevanceThreshold?: number;
    limit: number;
    itemsPerTableLimit: number;
  },
) {
  const ranked = candidates
    .map((candidate) => ({
      ...candidate,
      relevance: calculateRelevance(args.searchTerm, candidate.searchText),
    }))
    .filter((candidate) =>
      args.searchTerm
        ? candidate.relevance >= (args.relevanceThreshold ?? 0) && candidate.relevance > 0
        : true,
    )
    .sort((left, right) => {
      if (right.relevance !== left.relevance) {
        return right.relevance - left.relevance;
      }

      return right.created_at.localeCompare(left.created_at);
    });

  const countsBySourceType = new Map<SearchSourceType, number>();
  const limitedPerType: GlobalSearchReturnType[] = [];

  for (const candidate of ranked) {
    const current = countsBySourceType.get(candidate.sourceType) ?? 0;

    if (current >= args.itemsPerTableLimit) {
      continue;
    }

    countsBySourceType.set(candidate.sourceType, current + 1);
    limitedPerType.push(candidate);
  }

  return limitedPerType
    .sort((left, right) => {
      if (right.relevance !== left.relevance) {
        return right.relevance - left.relevance;
      }

      return right.created_at.localeCompare(left.created_at);
    })
    .slice(0, args.limit);
}
