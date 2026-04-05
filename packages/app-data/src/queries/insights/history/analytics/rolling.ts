import type { InsightHistoryData, RollingAverages } from "../types";

export function computeRollingAverages(
  history: InsightHistoryData,
  weeksBack = 4,
): RollingAverages {
  const weeksToUse = history.weeks.slice(0, weeksBack);

  if (weeksToUse.length === 0) {
    return { avgRevenue: 0, avgExpenses: 0, avgProfit: 0, weeksIncluded: 0 };
  }

  let totalRevenue = 0;
  let totalExpenses = 0;
  let totalProfit = 0;

  for (const week of weeksToUse) {
    totalRevenue += week.revenue;
    totalExpenses += week.expenses;
    totalProfit += week.profit;
  }

  const count = weeksToUse.length;

  return {
    avgRevenue: Math.round((totalRevenue / count) * 100) / 100,
    avgExpenses: Math.round((totalExpenses / count) * 100) / 100,
    avgProfit: Math.round((totalProfit / count) * 100) / 100,
    weeksIncluded: count,
  };
}
