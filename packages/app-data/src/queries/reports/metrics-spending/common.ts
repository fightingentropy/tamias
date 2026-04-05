import { UTCDate } from "@date-fns/utc";
import {
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from "date-fns";
import type { Database } from "../../../client";
import {
  getExcludedCategorySlugs,
  getReportTransactionAggregateRows,
} from "../shared";

type MetricAggregateParams = {
  teamId: string;
  from: string;
  to: string;
  currency?: string;
  exactDates?: boolean;
};

export function resolveMetricDateRange(params: {
  from: string;
  to: string;
  exactDates?: boolean;
}) {
  const fromDate = params.exactDates
    ? new UTCDate(parseISO(params.from))
    : startOfMonth(new UTCDate(parseISO(params.from)));
  const toDate = params.exactDates
    ? new UTCDate(parseISO(params.to))
    : endOfMonth(new UTCDate(parseISO(params.to)));

  return { fromDate, toDate };
}

export async function getMetricAggregateData(
  db: Database,
  params: MetricAggregateParams,
) {
  const { fromDate, toDate } = resolveMetricDateRange(params);
  const aggregateData = await getReportTransactionAggregateRows(db, {
    teamId: params.teamId,
    from: format(fromDate, "yyyy-MM-dd"),
    to: format(toDate, "yyyy-MM-dd"),
    inputCurrency: params.currency,
  });

  return {
    fromDate,
    toDate,
    targetCurrency: aggregateData.targetCurrency,
    rows: aggregateData.rows,
    excludedCategorySlugs: getExcludedCategorySlugs(),
  };
}
