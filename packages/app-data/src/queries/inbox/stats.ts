import { getInboxStatusCountSummaryFromConvex } from "../../convex";
import type { Database } from "../../client";
import { reuseQueryResult } from "../../utils/request-cache";
import { normalizeTimestampBoundary } from "../date-boundaries";
import { getTeamMatchSuggestions } from "./shared";
import type { GetInboxStatsParams } from "./types";

async function getInboxStatsImpl(_db: Database, params: GetInboxStatsParams) {
  const { teamId, from, to, currency } = params;
  const fromBoundary = normalizeTimestampBoundary(from, "start");
  const toBoundary = normalizeTimestampBoundary(to, "end");
  const [statusSummary, suggestions] = await Promise.all([
    getInboxStatusCountSummaryFromConvex({
      teamId,
      createdAtFrom: fromBoundary,
      createdAtTo: toBoundary,
      rangeStatus: "done",
    }),
    getTeamMatchSuggestions(teamId, ["pending"]),
  ]);

  const { totals, rangeCount: recentMatches } = statusSummary;
  const newItems = totals.new;
  const archivedItems = totals.archived;
  const processingItems = totals.processing;
  const doneItems = totals.done;
  const pendingItems = totals.pending;
  const analyzingItems = totals.analyzing;
  const suggestedMatchItems = totals.suggested_match;
  const noMatchItems = totals.no_match;
  const otherItems = totals.other;

  const stats = {
    newItems,
    pendingItems,
    analyzingItems,
    suggestedMatches: suggestions.length + suggestedMatchItems,
    recentMatches,
    totalItems:
      newItems +
      archivedItems +
      processingItems +
      doneItems +
      pendingItems +
      analyzingItems +
      suggestedMatchItems +
      noMatchItems +
      otherItems,
  };

  return {
    result: stats,
    meta: {
      from,
      to,
      currency,
      teamId,
    },
  };
}

export const getInboxStats = reuseQueryResult({
  keyPrefix: "inbox-stats",
  keyFn: (params: GetInboxStatsParams) =>
    [params.teamId, params.from, params.to, params.currency ?? ""].join(":"),
  load: getInboxStatsImpl,
});
