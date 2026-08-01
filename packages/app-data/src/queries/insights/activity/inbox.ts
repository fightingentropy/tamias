import type { Database } from "../../../client";
import { getInboxStatusCountSummaryFromD1, requireInboxItemsD1 } from "../../inbox/d1";
import { normalizeTimestampBoundary } from "../../date-boundaries";
import type { GetInsightActivityDataParams } from "./types";

type InboxActivityStats = {
  matchedCount: number;
};

async function countInboxItemsCreatedBetween(
  db: Database,
  args: {
    teamId: string;
    from: string;
    to: string;
    status: "done";
  },
) {
  const fromBoundary = normalizeTimestampBoundary(args.from, "start");
  const toBoundary = normalizeTimestampBoundary(args.to, "end");
  const summary = await getInboxStatusCountSummaryFromD1(requireInboxItemsD1(db), {
    teamId: args.teamId,
    createdAtFrom: fromBoundary,
    createdAtTo: toBoundary,
    rangeStatus: args.status,
  });

  return summary.rangeCount;
}

export async function getInboxActivityStats(
  _db: Database,
  params: GetInsightActivityDataParams,
): Promise<InboxActivityStats> {
  const { teamId, from, to } = params;

  return {
    matchedCount: await countInboxItemsCreatedBetween(_db, {
      teamId,
      from,
      to,
      status: "done",
    }),
  };
}
