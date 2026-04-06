import {
  getInsightByIdFromConvex,
  listInsightsFromConvex,
  type CurrentUserIdentityRecord,
  type InsightRecord as StoredInsightRecord,
} from "@tamias/app-data-convex";
import type { Database, DatabaseOrTransaction } from "../../client";
import type {
  ExpenseAnomaly,
  InsightActivity,
  InsightAnomaly,
  InsightContent,
  InsightMetric,
  InsightMilestone,
  InsightPredictions,
} from "../../types/insights";

export type InsightPeriodType = "weekly" | "monthly" | "quarterly" | "yearly";
export type ConvexUserId = CurrentUserIdentityRecord["convexId"];
export type InsightStatus = "pending" | "generating" | "completed" | "failed";

export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export type Insight = {
  id: string;
  teamId: string;
  periodType: InsightPeriodType;
  periodStart: Date;
  periodEnd: Date;
  periodYear: number;
  periodNumber: number;
  status: InsightStatus;
  selectedMetrics: InsightMetric[] | null;
  allMetrics: Record<string, InsightMetric> | null;
  anomalies: InsightAnomaly[] | null;
  expenseAnomalies: ExpenseAnomaly[] | null;
  milestones: InsightMilestone[] | null;
  activity: InsightActivity | null;
  currency: string;
  title: string | null;
  content: InsightContent | null;
  predictions: InsightPredictions | null;
  audioPath: string | null;
  generatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function hydrateInsight(record: StoredInsightRecord): Insight {
  return {
    id: record.id,
    teamId: record.teamId,
    periodType: record.periodType,
    periodStart: new Date(record.periodStart),
    periodEnd: new Date(record.periodEnd),
    periodYear: record.periodYear,
    periodNumber: record.periodNumber,
    status: record.status,
    selectedMetrics: (record.selectedMetrics as InsightMetric[] | null) ?? null,
    allMetrics: (record.allMetrics as Record<string, InsightMetric> | null) ?? null,
    anomalies: (record.anomalies as InsightAnomaly[] | null) ?? null,
    expenseAnomalies: (record.expenseAnomalies as ExpenseAnomaly[] | null) ?? null,
    milestones: (record.milestones as InsightMilestone[] | null) ?? null,
    activity: (record.activity as InsightActivity | null) ?? null,
    currency: record.currency,
    title: record.title,
    content: (record.content as InsightContent | null) ?? null,
    predictions: (record.predictions as InsightPredictions | null) ?? null,
    audioPath: record.audioPath,
    generatedAt: record.generatedAt ? new Date(record.generatedAt) : null,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

export async function listTeamInsights(_db: Database | DatabaseOrTransaction, teamId: string) {
  const records = await listInsightsFromConvex({ teamId });
  return records.map(hydrateInsight);
}

export function compareInsightPeriodDesc(left: Insight, right: Insight) {
  if (left.periodYear !== right.periodYear) {
    return right.periodYear - left.periodYear;
  }

  return right.periodNumber - left.periodNumber;
}

export function compareInsightGeneratedAtDesc(left: Insight, right: Insight) {
  const leftTime = left.generatedAt?.getTime() ?? 0;
  const rightTime = right.generatedAt?.getTime() ?? 0;
  return rightTime - leftTime;
}

function matchesExcludedPeriod(insight: Insight, excluded?: { year: number; number: number }) {
  if (!excluded) {
    return false;
  }

  return insight.periodYear === excluded.year && insight.periodNumber === excluded.number;
}

export async function listCompletedWeeklyInsights(
  db: Database | DatabaseOrTransaction,
  params: {
    teamId: string;
    excludeCurrentPeriod?: { year: number; number: number };
    limit?: number;
  },
) {
  const records = (await listTeamInsights(db, params.teamId))
    .filter(
      (insight) =>
        insight.periodType === "weekly" &&
        insight.status === "completed" &&
        insight.allMetrics &&
        !matchesExcludedPeriod(insight, params.excludeCurrentPeriod),
    )
    .sort(compareInsightPeriodDesc);

  if (params.limit) {
    return records.slice(0, params.limit);
  }

  return records;
}

export async function getInsightById(_db: Database, params: { id: string; teamId: string }) {
  const result = await getInsightByIdFromConvex({
    teamId: params.teamId,
    id: params.id,
  });

  return result ? hydrateInsight(result) : null;
}
