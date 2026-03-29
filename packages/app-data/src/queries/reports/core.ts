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
import {
  buildMonthlySeriesMap,
  CONTRA_REVENUE_CATEGORIES,
  getCategoryInfo,
  getCogsCategorySlugs,
  getExcludedCategorySlugs,
  getPercentageIncrease,
  getReportTransactionAmounts,
  getTargetCurrency,
  REVENUE_CATEGORIES,
  roundMoney,
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

export const getProfit = dedupeByDb<GetReportsParams, ReportsResultItem[]>(
  (p) =>
    `${p.teamId}:${p.from}:${p.to}:${p.currency ?? ""}:${p.revenueType ?? "net"}:${p.exactDates ?? false}`,
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
  const { amounts: expenseTransactions } = await getReportTransactionAmounts(
    db,
    {
      teamId,
      from: format(fromDate, "yyyy-MM-dd"),
      to: format(toDate, "yyyy-MM-dd"),
      inputCurrency,
    },
  );
  const negativeTransactions = expenseTransactions.filter(
    (row) => row.amount < 0,
  );
  const cogsMap = buildMonthlySeriesMap(
    negativeTransactions.filter(
      (row) =>
        row.transaction.categorySlug !== null &&
        cogsCategorySlugs.includes(row.transaction.categorySlug) &&
        !excludedCategorySlugs.includes(row.transaction.categorySlug),
    ),
    (row) => Math.abs(row.amount),
  );
  const operatingExpensesMap = buildMonthlySeriesMap(
    negativeTransactions.filter((row) => {
      const slug = row.transaction.categorySlug;

      if (slug && excludedCategorySlugs.includes(slug)) {
        return false;
      }

      return slug === null || !cogsCategorySlugs.includes(slug);
    }),
    (row) => Math.abs(row.amount),
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

export const getRevenue = dedupeByDb<GetReportsParams, ReportsResultItem[]>(
  (p) =>
    `${p.teamId}:${p.from}:${p.to}:${p.currency ?? ""}:${p.revenueType ?? "gross"}:${p.exactDates ?? false}`,
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

  const { targetCurrency, countryCode, amounts } =
    await getReportTransactionAmounts(db, {
      teamId,
      from: format(fromDate, "yyyy-MM-dd"),
      to: format(toDate, "yyyy-MM-dd"),
      inputCurrency,
    });

  const monthSeries = eachMonthOfInterval({ start: fromDate, end: toDate });
  const monthlyData = buildMonthlySeriesMap(
    amounts.filter((row) => {
      const slug = row.transaction.categorySlug;

      return (
        row.amount > 0 &&
        Boolean(slug) &&
        REVENUE_CATEGORIES.includes(
          slug as (typeof REVENUE_CATEGORIES)[number],
        ) &&
        !CONTRA_REVENUE_CATEGORIES.includes(
          slug as (typeof CONTRA_REVENUE_CATEGORIES)[number],
        )
      );
    }),
    (row) => {
      if (revenueType !== "net") {
        return row.amount;
      }

      const categoryInfo = getCategoryInfo(
        row.transaction.categorySlug,
        countryCode,
      );
      const effectiveTaxRate =
        row.transaction.taxRate ?? categoryInfo?.taxRate ?? 0;

      return roundMoney(
        row.amount - (row.amount * effectiveTaxRate) / (100 + effectiveTaxRate),
      );
    },
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

export async function getReports(db: Database, params: GetReportsParams) {
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
