import {
  differenceInDays,
  endOfQuarter,
  format,
  getQuarter,
  startOfQuarter,
} from "date-fns";
import type { HistoricalContext, InsightHistoryData } from "../types";

export function computeHistoricalContext(
  history: InsightHistoryData,
  currentWeek: {
    revenue: number;
    profit: number;
    periodYear: number;
    periodNumber: number;
  },
): HistoricalContext {
  const validWeeks = history.weeks.filter((week) => week.revenue > 0);

  if (validWeeks.length < 4) {
    return {
      revenueRank: null,
      profitRank: null,
      isAllTimeRevenueHigh: false,
      isAllTimeProfitHigh: false,
      isRecentRevenueHigh: false,
      isRecentProfitHigh: false,
      weeksOfHistory: validWeeks.length,
    };
  }

  const revenueRank =
    validWeeks.filter((week) => week.revenue > currentWeek.revenue).length + 1;
  const isAllTimeRevenueHigh = revenueRank === 1;
  let revenueHighestSince: string | undefined;

  if (revenueRank <= 3 && revenueRank > 1) {
    const higherWeek = validWeeks.find(
      (week) => week.revenue > currentWeek.revenue,
    );

    if (higherWeek) {
      revenueHighestSince = format(higherWeek.periodStart, "MMMM yyyy");
    }
  }

  const profitRank =
    validWeeks.filter((week) => week.profit > currentWeek.profit).length + 1;
  const isAllTimeProfitHigh = profitRank === 1 && currentWeek.profit > 0;
  let profitHighestSince: string | undefined;

  if (profitRank <= 3 && profitRank > 1 && currentWeek.profit > 0) {
    const higherWeek = validWeeks.find(
      (week) => week.profit > currentWeek.profit,
    );

    if (higherWeek) {
      profitHighestSince = format(higherWeek.periodStart, "MMMM yyyy");
    }
  }

  const isRecentRevenueHigh = revenueRank <= 3 && validWeeks.length >= 8;
  const isRecentProfitHigh =
    profitRank <= 3 && validWeeks.length >= 8 && currentWeek.profit > 0;

  let yearOverYear: HistoricalContext["yearOverYear"];
  const lastYearInsight = history.weeks.find(
    (week) =>
      week.periodYear === currentWeek.periodYear - 1 &&
      week.periodNumber === currentWeek.periodNumber,
  );

  if (lastYearInsight && lastYearInsight.revenue > 0) {
    yearOverYear = {
      lastYearRevenue: lastYearInsight.revenue,
      lastYearProfit: lastYearInsight.profit,
      revenueChangePercent: Math.round(
        ((currentWeek.revenue - lastYearInsight.revenue) /
          lastYearInsight.revenue) *
          100,
      ),
      profitChangePercent:
        lastYearInsight.profit !== 0
          ? Math.round(
              ((currentWeek.profit - lastYearInsight.profit) /
                Math.abs(lastYearInsight.profit)) *
                100,
            )
          : 0,
      hasComparison: true,
    };
  }

  let quarterPace: HistoricalContext["quarterPace"];
  const now = new Date();
  const currentQuarter = getQuarter(now);
  const quarterStart = startOfQuarter(now);
  const quarterEnd = endOfQuarter(now);
  const daysElapsed = differenceInDays(now, quarterStart) + 1;
  const totalQuarterDays = differenceInDays(quarterEnd, quarterStart) + 1;
  const quarterWeeks = history.weeks.filter(
    (week) =>
      week.periodStart >= quarterStart &&
      week.periodStart <= now &&
      week.periodYear === currentWeek.periodYear,
  );
  const qtdRevenue =
    quarterWeeks.reduce((sum, week) => sum + week.revenue, 0) +
    currentWeek.revenue;

  if (qtdRevenue > 0 && daysElapsed > 7) {
    const projectedRevenue = Math.round(
      (qtdRevenue / daysElapsed) * totalQuarterDays,
    );
    const lastYearQuarterRevenue = history.weeks
      .filter(
        (week) =>
          getQuarter(week.periodStart) === currentQuarter &&
          week.periodYear === currentWeek.periodYear - 1,
      )
      .reduce((sum, week) => sum + week.revenue, 0);

    quarterPace = {
      currentQuarter,
      qtdRevenue,
      projectedRevenue,
      lastYearQuarterRevenue,
      vsLastYearPercent:
        lastYearQuarterRevenue > 0
          ? Math.round(
              ((projectedRevenue - lastYearQuarterRevenue) /
                lastYearQuarterRevenue) *
                100,
            )
          : 0,
      hasComparison: lastYearQuarterRevenue > 0,
    };
  }

  return {
    revenueRank,
    revenueHighestSince,
    profitRank,
    profitHighestSince,
    isAllTimeRevenueHigh,
    isAllTimeProfitHigh,
    isRecentRevenueHigh,
    isRecentProfitHigh,
    weeksOfHistory: validWeeks.length,
    yearOverYear,
    quarterPace,
  };
}
