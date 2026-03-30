import { UTCDate } from "@date-fns/utc";
import {
  eachMonthOfInterval,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  subYears,
} from "date-fns";
import type { Database } from "../../client";
import { dedupeByDb } from "../../utils/dedupe";
import { cacheAcrossRequests } from "../../utils/short-lived-cache";
import {
  buildMonthlyAggregateSeriesMap,
  CONTRA_REVENUE_CATEGORIES,
  getCogsCategorySlugs,
  getExcludedCategorySlugs,
  getPercentageIncrease,
  getReportTransactionAggregateRows,
  getTargetCurrency,
  REVENUE_CATEGORIES,
} from "./shared";

export type GetReportsParams = {
  teamId: string;
  from: string;
  to: string;
  currency?: string;
  type?: "revenue" | "profit";
  revenueType?: "gross" | "net";
  /** When true, use exact dates instead of expanding to month boundaries. Useful for weekly insights. */
  exactDates?: boolean;
};

export interface ReportsResultItem {
  value: string;
  date: string;
  currency: string;
}

function serializeProfitParams(params: GetReportsParams) {
  return [
    params.teamId,
    params.from,
    params.to,
    params.currency ?? "",
    params.revenueType ?? "net",
    params.exactDates ?? false,
  ].join(":");
}

const getProfitDeduped = dedupeByDb<GetReportsParams, ReportsResultItem[]>(
  serializeProfitParams,
  getProfitImpl,
);

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

export const getProfit = cacheAcrossRequests({
  keyPrefix: "profit-series",
  keyFn: serializeProfitParams,
  load: getProfitDeduped,
});

function serializeRevenueParams(params: GetReportsParams) {
  return [
    params.teamId,
    params.from,
    params.to,
    params.currency ?? "",
    params.revenueType ?? "gross",
    params.exactDates ?? false,
  ].join(":");
}

const getRevenueDeduped = dedupeByDb<GetReportsParams, ReportsResultItem[]>(
  serializeRevenueParams,
  getRevenueImpl,
);

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

export const getRevenue = cacheAcrossRequests({
  keyPrefix: "revenue-series",
  keyFn: serializeRevenueParams,
  load: getRevenueDeduped,
});

async function getReportsImpl(db: Database, params: GetReportsParams) {
  const {
    teamId,
    from,
    to,
    type = "profit",
    currency: inputCurrency,
    revenueType,
  } = params;

  const prevFromDate = subYears(startOfMonth(new UTCDate(parseISO(from))), 1);
  const prevToDate = subYears(endOfMonth(new UTCDate(parseISO(to))), 1);

  const reportFunction = type === "profit" ? getProfit : getRevenue;

  const [rawPrev, rawCurr] = await Promise.all([
    reportFunction(db, {
      teamId,
      from: prevFromDate.toISOString(),
      to: prevToDate.toISOString(),
      currency: inputCurrency,
      revenueType,
    }),
    reportFunction(db, {
      teamId,
      from,
      to,
      currency: inputCurrency,
      revenueType,
    }),
  ]);

  const prevData = rawPrev.map((item) => ({
    ...item,
    value: Number.parseFloat(item.value),
  }));

  const currentData = rawCurr.map((item) => ({
    ...item,
    value: Number.parseFloat(item.value),
  }));

  const prevTotal = Number(
    (prevData?.reduce((value, item) => item.value + value, 0) ?? 0).toFixed(2),
  );

  const currentTotal = Number(
    (currentData?.reduce((value, item) => item.value + value, 0) ?? 0).toFixed(
      2,
    ),
  );

  const baseCurrency = currentData?.at(0)?.currency ?? inputCurrency;

  return {
    summary: {
      currentTotal,
      prevTotal,
      currency: baseCurrency,
    },
    meta: {
      type,
      currency: baseCurrency,
    },
    result: currentData?.map((record, index) => {
      const prev = prevData?.at(index);
      const prevValue = prev?.value ?? 0;
      const recordValue = record.value;

      return {
        date: record.date,
        percentage: {
          value: Number(
            getPercentageIncrease(Math.abs(prevValue), Math.abs(recordValue)) ||
              0,
          ),
          status: recordValue > prevValue ? "positive" : "negative",
        },
        current: {
          date: record.date,
          value: recordValue,
          currency: record.currency,
        },
        previous: {
          date: prev?.date,
          value: prevValue,
          currency: prev?.currency ?? baseCurrency,
        },
      };
    }),
  };
}

export const getReports = cacheAcrossRequests({
  keyPrefix: "reports",
  keyFn: (params: GetReportsParams) => {
    const type = params.type ?? "profit";
    const revenueType =
      params.revenueType ?? (type === "profit" ? "net" : "gross");

    return [
      params.teamId,
      type,
      params.from,
      params.to,
      params.currency ?? "",
      revenueType,
      params.exactDates ?? false,
    ].join(":");
  },
  load: getReportsImpl,
});
