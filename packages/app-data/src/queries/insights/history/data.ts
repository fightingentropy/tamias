import type { Database } from "../../../client";
import { reuseQueryResult } from "../../../utils/request-cache";
import {
  listCompletedWeeklyInsights,
  type Insight,
} from "../shared";
import type { InsightHistoryData, InsightHistoryWeek } from "./types";

type InsightHistoryParams = {
  teamId: string;
  weeksBack?: number;
  excludeCurrentPeriod?: { year: number; number: number };
};

function toInsightHistoryWeek(insight: Insight): InsightHistoryWeek | null {
  const metrics = insight.allMetrics as Record<string, { value: number }> | null;
  const activity = insight.activity as {
    invoicesOverdue?: number;
    invoicesPaid?: number;
  } | null;

  if (!metrics) {
    return null;
  }

  const week: InsightHistoryWeek = {
    periodYear: insight.periodYear,
    periodNumber: insight.periodNumber,
    periodStart: insight.periodStart,
    revenue: metrics.revenue?.value ?? 0,
    expenses: metrics.expenses?.value ?? 0,
    profit: metrics.netProfit?.value ?? metrics.profit?.value ?? 0,
    hasOverdue: (activity?.invoicesOverdue ?? 0) > 0,
    invoicesPaid: activity?.invoicesPaid ?? 0,
  };

  if (insight.predictions) {
    week.predictions = insight.predictions;
  }

  return week;
}

function buildInsightHistoryData(weeks: InsightHistoryWeek[]): InsightHistoryData {
  return {
    weeks,
    weeksOfHistory: weeks.length,
  };
}

async function getInsightHistoryImpl(
  db: Database,
  params: InsightHistoryParams,
): Promise<InsightHistoryData> {
  const pastInsights = await listCompletedWeeklyInsights(db, {
    teamId: params.teamId,
    excludeCurrentPeriod: params.excludeCurrentPeriod,
    limit: params.weeksBack ?? 52,
  });

  return buildInsightHistoryData(
    pastInsights
      .map(toInsightHistoryWeek)
      .filter((week): week is InsightHistoryWeek => week !== null),
  );
}

export const getInsightHistory = reuseQueryResult({
  keyPrefix: "insight-history",
  keyFn: (params: InsightHistoryParams) =>
    [
      params.teamId,
      params.weeksBack ?? 52,
      params.excludeCurrentPeriod?.year ?? "",
      params.excludeCurrentPeriod?.number ?? "",
    ].join(":"),
  load: getInsightHistoryImpl,
});
