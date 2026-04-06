import type { Database } from "../../../client";
import type { SearchTransactionMatchParams, SearchTransactionMatchResult } from "./common";
import { searchTransactionMatchByInbox } from "./inbox";
import { searchTransactionMatchByQuery } from "./query";

export async function searchTransactionMatch(
  db: Database,
  params: SearchTransactionMatchParams,
): Promise<SearchTransactionMatchResult[]> {
  const {
    teamId,
    query,
    inboxId,
    maxResults = 5,
    minConfidenceScore = 0.5,
    includeAlreadyMatched = false,
  } = params;

  if (query) {
    return searchTransactionMatchByQuery({
      teamId,
      query,
      maxResults,
      includeAlreadyMatched,
    });
  }

  if (inboxId) {
    return searchTransactionMatchByInbox(db, {
      teamId,
      inboxId,
      maxResults,
      minConfidenceScore,
      includeAlreadyMatched,
    });
  }

  return [];
}
