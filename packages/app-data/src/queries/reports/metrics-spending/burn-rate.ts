import {
  eachMonthOfInterval,
  format,
} from "date-fns";
import type { Database } from "../../../client";
import { reuseQueryResult } from "../../../utils/request-cache";
import { serializeMetricRangeParams } from "../metrics-common";
import {
  buildMonthlyAggregateSeriesMap,
} from "../shared";
import { getMetricAggregateData } from "./common";

export type GetBurnRateParams = {
  teamId: string;
  from: string;
  to: string;
  currency?: string;
};

async function getBurnRateImpl(db: Database, params: GetBurnRateParams) {
  const aggregateData = await getMetricAggregateData(db, params);
  const monthSeries = eachMonthOfInterval({
    start: aggregateData.fromDate,
    end: aggregateData.toDate,
  });
  const dataMap = buildMonthlyAggregateSeriesMap(
    aggregateData.rows.filter((row) => {
      const slug = row.categorySlug;

      return (
        row.direction === "expense" &&
        (slug === null ||
          !aggregateData.excludedCategorySlugs.includes(slug))
      );
    }),
    (row) => Math.abs(row.totalAmount),
  );

  return monthSeries.map((monthStart) => {
    const monthKey = format(monthStart, "yyyy-MM-dd");

    return {
      date: monthKey,
      value: dataMap.get(monthKey) || 0,
      currency: aggregateData.targetCurrency || "USD",
    };
  });
}

export const getBurnRate = reuseQueryResult({
  keyPrefix: "burn-rate",
  keyFn: serializeMetricRangeParams,
  load: getBurnRateImpl,
});
