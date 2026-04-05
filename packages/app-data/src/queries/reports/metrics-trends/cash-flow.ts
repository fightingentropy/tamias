import { UTCDate } from "@date-fns/utc";
import {
  eachMonthOfInterval,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from "date-fns";
import type { Database } from "../../../client";
import { reuseQueryResult } from "../../../utils/request-cache";
import {
  getExcludedCategorySlugs,
  getMonthBucket,
  getReportTransactionAggregateRows,
  roundMoney,
} from "../shared";

export type GetCashFlowParams = {
  teamId: string;
  from: string;
  to: string;
  currency?: string;
  period?: "monthly" | "quarterly";
  exactDates?: boolean;
};

async function getCashFlowImpl(db: Database, params: GetCashFlowParams) {
  const {
    teamId,
    from,
    to,
    currency: inputCurrency,
    period = "monthly",
    exactDates = false,
  } = params;

  const fromDate = exactDates
    ? new UTCDate(parseISO(from))
    : startOfMonth(new UTCDate(parseISO(from)));
  const toDate = exactDates
    ? new UTCDate(parseISO(to))
    : endOfMonth(new UTCDate(parseISO(to)));

  const excludedCategorySlugs = getExcludedCategorySlugs();
  const aggregateData = await getReportTransactionAggregateRows(db, {
    teamId,
    from: format(fromDate, "yyyy-MM-dd"),
    to: format(toDate, "yyyy-MM-dd"),
    inputCurrency,
  });
  const monthlyData = new Map<string, { income: number; expenses: number }>();
  const targetCurrency = aggregateData.targetCurrency;

  for (const row of aggregateData.rows) {
    const slug = row.categorySlug;

    if (slug && excludedCategorySlugs.includes(slug)) {
      continue;
    }

    const month = getMonthBucket(row.date);
    const current = monthlyData.get(month) ?? { income: 0, expenses: 0 };
    const amount = row.totalAmount;

    if (row.direction === "income" && amount > 0) {
      current.income = roundMoney(current.income + amount);
    } else if (row.direction === "expense" && amount < 0) {
      current.expenses = roundMoney(current.expenses + Math.abs(amount));
    }

    monthlyData.set(month, current);
  }

  const monthSeries = eachMonthOfInterval({ start: fromDate, end: toDate });
  const completeMonthlyData = monthSeries.map((monthStart) => {
    const monthKey = format(monthStart, "yyyy-MM-dd");
    const monthData = monthlyData.get(monthKey) || { income: 0, expenses: 0 };
    const netCashFlow = monthData.income - monthData.expenses;

    return {
      month: format(monthStart, "MMM"),
      date: monthKey,
      income: Number(monthData.income.toFixed(2)),
      expenses: Number(monthData.expenses.toFixed(2)),
      netCashFlow: Number(netCashFlow.toFixed(2)),
    };
  });

  const totalIncome = completeMonthlyData.reduce(
    (sum, item) => sum + item.income,
    0,
  );
  const totalExpenses = completeMonthlyData.reduce(
    (sum, item) => sum + item.expenses,
    0,
  );
  const netCashFlow = totalIncome - totalExpenses;
  const averageMonthlyCashFlow =
    completeMonthlyData.length > 0
      ? netCashFlow / completeMonthlyData.length
      : 0;

  return {
    summary: {
      netCashFlow: Number(netCashFlow.toFixed(2)),
      totalIncome: Number(totalIncome.toFixed(2)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      averageMonthlyCashFlow: Number(averageMonthlyCashFlow.toFixed(2)),
      currency: targetCurrency || "USD",
      period,
    },
    monthlyData: completeMonthlyData,
    meta: {
      type: "cash_flow",
      currency: targetCurrency || "USD",
      period: {
        from,
        to,
      },
    },
  };
}

export const getCashFlow = reuseQueryResult({
  keyPrefix: "cash-flow",
  keyFn: (params: GetCashFlowParams) =>
    [
      params.teamId,
      params.from,
      params.to,
      params.currency ?? "",
      params.period ?? "monthly",
      params.exactDates ?? false,
    ].join(":"),
  load: getCashFlowImpl,
});
