import { getInboxLiabilityAggregateRowsFromConvex } from "@tamias/app-data-convex";
import type { Database } from "../../../../client";
import { createQueryCacheKey, getOrSetQueryCacheValue } from "../../../../client";

export async function getReportInboxLiabilityAggregateRows(
  db: Database,
  params: {
    teamId: string;
    from?: string;
    to?: string;
  },
) {
  return getOrSetQueryCacheValue(
    db,
    createQueryCacheKey("reports:inbox-liability-aggregates", {
      teamId: params.teamId,
      from: params.from ?? null,
      to: params.to ?? null,
    }),
    () =>
      getInboxLiabilityAggregateRowsFromConvex({
        teamId: params.teamId,
        dateFrom: params.from ?? null,
        dateTo: params.to ?? null,
      }),
  );
}
