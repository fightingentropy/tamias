import { UTCDate } from "@date-fns/utc";
import {
  eachMonthOfInterval,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from "date-fns";
import type { Database } from "../../../client";
import { dedupeByDb } from "../../../utils/dedupe";
import { reuseQueryResult } from "../../../utils/request-cache";
import {
  buildMonthlyAggregateSeriesMap,
  CONTRA_REVENUE_CATEGORIES,
  getCogsCategorySlugs,
  getExcludedCategorySlugs,
  getReportTransactionAggregateRows,
  getTargetCurrency,
  REVENUE_CATEGORIES,
} from "../shared";
import type { GetReportsParams, ReportsResultItem } from "./shared";
import { serializeProfitParams, serializeRevenueParams } from "./shared";

async function getProfitImpl(db: Database, params: GetReportsParams) {
  const {
    teamId,
    from,
    to,
    currency: inputCurrency,
    revenueType = "net",
    exactDates = false,
  } = params;

  const fromDate = exactDates
    ? new UTCDate(parseISO(from))
    : startOfMonth(new UTCDate(parseISO(from)));
  const toDate = exactDates
    ? new UTCDate(parseISO(to))
    : endOfMonth(new UTCDate(parseISO(to)));

  const monthSeries = eachMonthOfInterval({ start: fromDate, end: toDate });

  const [targetCurrency, netRevenueData, cogsCategorySlugs] = await Promise.all(
    [
      getTargetCurrency(db, teamId, inputCurrency),
      getRevenue(db, {
        teamId,
        exactDates,
        from,
        to,
        currency: inputCurrency,
        revenueType: "net",
      }),
      getCogsCategorySlugs(db, teamId),
    ],
  );
  const excludedCategorySlugs = getExcludedCategorySlugs();
  const aggregateData = await getReportTransactionAggregateRows(db, {
    teamId,
    from: format(fromDate, "yyyy-MM-dd"),
    to: format(toDate, "yyyy-MM-dd"),
    inputCurrency,
  });
  const negativeTransactions = aggregateData.rows.filter(
    (row) => row.direction === "expense",
  );

  const cogsMap = buildMonthlyAggregateSeriesMap(
    negativeTransactions.filter(
      (row) =>
        row.categorySlug !== null &&
        cogsCategorySlugs.includes(row.categorySlug) &&
        !excludedCategorySlugs.includes(row.categorySlug),
    ),
    (row) => Math.abs(row.totalAmount),
  );
  const operatingExpensesMap = buildMonthlyAggregateSeriesMap(
    negativeTransactions.filter((row) => {
      const slug = row.categorySlug;

      if (slug && excludedCategorySlugs.includes(slug)) {
        return false;
      }

      return slug === null || !cogsCategorySlugs.includes(slug);
    }),
    (row) => Math.abs(row.totalAmount),
  );

  const netRevenueMap = new Map(
    netRevenueData.map((item) => [item.date, Number.parseFloat(item.value)]),
  );

  const currencyStr = targetCurrency || "USD";
  const results: ReportsResultItem[] = monthSeries.map((monthStart) => {
    const monthKey = format(monthStart, "yyyy-MM-dd");
    const netRevenue = netRevenueMap.get(monthKey) || 0;
    const cogs = cogsMap.get(monthKey) || 0;
    const operatingExpenses = operatingExpensesMap.get(monthKey) || 0;

    let profit: number;
    if (revenueType === "gross") {
      profit = netRevenue - cogs;
    } else {
      profit = netRevenue - cogs - operatingExpenses;
    }

    return {
      date: monthKey,
      value: profit.toString(),
      currency: currencyStr,
    };
  });

  return results;
}

const getProfitDeduped = dedupeByDb<GetReportsParams, ReportsResultItem[]>(
  serializeProfitParams,
  getProfitImpl,
);

export const getProfit = reuseQueryResult({
  keyPrefix: "profit-series",
  keyFn: serializeProfitParams,
  load: getProfitDeduped,
});

async function getRevenueImpl(db: Database, params: GetReportsParams) {
  const {
    teamId,
    from,
    to,
    currency: inputCurrency,
    revenueType = "gross",
    exactDates = false,
  } = params;

  const fromDate = exactDates
    ? new UTCDate(parseISO(from))
    : startOfMonth(new UTCDate(parseISO(from)));
  const toDate = exactDates
    ? new UTCDate(parseISO(to))
    : endOfMonth(new UTCDate(parseISO(to)));

  const aggregateData = await getReportTransactionAggregateRows(db, {
    teamId,
    from: format(fromDate, "yyyy-MM-dd"),
    to: format(toDate, "yyyy-MM-dd"),
    inputCurrency,
  });
  const monthSeries = eachMonthOfInterval({ start: fromDate, end: toDate });
  const targetCurrency = aggregateData.targetCurrency;
  const monthlyData = buildMonthlyAggregateSeriesMap(
    aggregateData.rows.filter((row) => {
      const slug = row.categorySlug;

      return (
        row.direction === "income" &&
        Boolean(slug) &&
        REVENUE_CATEGORIES.includes(
          slug as (typeof REVENUE_CATEGORIES)[number],
        ) &&
        !CONTRA_REVENUE_CATEGORIES.includes(
          slug as (typeof CONTRA_REVENUE_CATEGORIES)[number],
        )
      );
    }),
    (row) =>
      revenueType === "net"
        ? Number(row.totalNetAmount ?? row.totalAmount)
        : row.totalAmount,
  );

  const currencyStr = targetCurrency || "USD";
  const results: ReportsResultItem[] = monthSeries.map((monthStart) => {
    const monthKey = format(monthStart, "yyyy-MM-dd");
    const value = monthlyData.get(monthKey) || 0;

    return {
      date: monthKey,
      value: value.toString(),
      currency: currencyStr,
    };
  });

  return results;
}

const getRevenueDeduped = dedupeByDb<GetReportsParams, ReportsResultItem[]>(
  serializeRevenueParams,
  getRevenueImpl,
);

export const getRevenue = reuseQueryResult({
  keyPrefix: "revenue-series",
  keyFn: serializeRevenueParams,
  load: getRevenueDeduped,
});
