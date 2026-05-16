import type { Database } from "../../../../client";
import { createQueryCacheKey, getOrSetQueryCacheValue } from "../../../../client";
import {
  getInboxLiabilityAggregateRowsFromD1,
  requireInboxItemsD1,
} from "../../../inbox/d1";

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
      getInboxLiabilityAggregateRowsFromD1(requireInboxItemsD1(db), {
        teamId: params.teamId,
        dateFrom: params.from ?? null,
        dateTo: params.to ?? null,
      }),
  );
}
