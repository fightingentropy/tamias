import { createInsightInConvex, updateInsightInConvex } from "@tamias/app-data-convex";
import type { Database, DatabaseOrTransaction } from "../../client";
import { reuseQueryResult } from "../../utils/request-cache";
import type {
  ExpenseAnomaly,
  InsightActivity,
  InsightAnomaly,
  InsightContent,
  InsightMetric,
  InsightMilestone,
  InsightPredictions,
} from "../../types/insights";
import {
  compareInsightGeneratedAtDesc,
  compareInsightPeriodDesc,
  hydrateInsight,
  listTeamInsights,
  type InsightPeriodType,
  type InsightStatus,
} from "./shared";

export type CreateInsightParams = {
  teamId: string;
  periodType: InsightPeriodType;
  periodStart: Date;
  periodEnd: Date;
  periodYear: number;
  periodNumber: number;
  currency: string;
};

export async function createInsight(_db: DatabaseOrTransaction, params: CreateInsightParams) {
  const result = await createInsightInConvex({
    teamId: params.teamId,
    periodType: params.periodType,
    periodStart: params.periodStart.toISOString(),
    periodEnd: params.periodEnd.toISOString(),
    periodYear: params.periodYear,
    periodNumber: params.periodNumber,
    currency: params.currency,
  });

  return result ? hydrateInsight(result) : null;
}

export type UpdateInsightParams = {
  id: string;
  teamId: string;
  status?: InsightStatus;
  title?: string;
  selectedMetrics?: InsightMetric[];
  allMetrics?: Record<string, InsightMetric>;
  anomalies?: InsightAnomaly[];
  expenseAnomalies?: ExpenseAnomaly[];
  milestones?: InsightMilestone[];
  activity?: InsightActivity;
  content?: InsightContent;
  predictions?: InsightPredictions;
  audioPath?: string;
  generatedAt?: Date;
};

export async function updateInsight(_db: DatabaseOrTransaction, params: UpdateInsightParams) {
  const result = await updateInsightInConvex({
    teamId: params.teamId,
    id: params.id,
    status: params.status,
    title: params.title,
    selectedMetrics: params.selectedMetrics,
    allMetrics: params.allMetrics,
    anomalies: params.anomalies,
    expenseAnomalies: params.expenseAnomalies,
    milestones: params.milestones,
    activity: params.activity,
    content: params.content,
    predictions: params.predictions,
    audioPath: params.audioPath,
    generatedAt: params.generatedAt?.toISOString() ?? undefined,
  });

  return result ? hydrateInsight(result) : null;
}

export type GetInsightsParams = {
  teamId: string;
  periodType?: InsightPeriodType;
  cursor?: string | null;
  pageSize?: number;
  status?: InsightStatus;
};

export async function getInsights(db: Database, params: GetInsightsParams) {
  const { teamId, periodType, cursor, pageSize = 10, status } = params;

  const offset = cursor ? Number.parseInt(cursor, 10) : 0;
  const filtered = (await listTeamInsights(db, teamId))
    .filter(
      (insight) =>
        (!periodType || insight.periodType === periodType) &&
        (!status || insight.status === status),
    )
    .sort(compareInsightPeriodDesc);
  const data = filtered.slice(offset, offset + pageSize);

  const nextCursor = data && data.length === pageSize ? (offset + pageSize).toString() : undefined;

  return {
    meta: {
      cursor: nextCursor ?? null,
      hasPreviousPage: offset > 0,
      hasNextPage: data && data.length === pageSize,
    },
    data,
  };
}

export type GetInsightByPeriodParams = {
  teamId: string;
  periodType: InsightPeriodType;
  periodYear: number;
  periodNumber: number;
};

export async function getInsightByPeriod(db: Database, params: GetInsightByPeriodParams) {
  const { teamId, periodType, periodYear, periodNumber } = params;
  const insightsForTeam = await listTeamInsights(db, teamId);

  return (
    insightsForTeam.find(
      (insight) =>
        insight.periodType === periodType &&
        insight.periodYear === periodYear &&
        insight.periodNumber === periodNumber,
    ) ?? null
  );
}

export type GetLatestInsightParams = {
  teamId: string;
  periodType?: InsightPeriodType;
};

async function getLatestInsightImpl(db: Database, params: GetLatestInsightParams) {
  const { teamId, periodType } = params;

  return (
    (await listTeamInsights(db, teamId))
      .filter(
        (insight) =>
          insight.status === "completed" && (!periodType || insight.periodType === periodType),
      )
      .sort(compareInsightGeneratedAtDesc)[0] ?? null
  );
}

export const getLatestInsight = reuseQueryResult({
  keyPrefix: "latest-insight",
  keyFn: (params: GetLatestInsightParams) => [params.teamId, params.periodType ?? ""].join(":"),
  load: getLatestInsightImpl,
});

export async function insightExistsForPeriod(
  db: Database,
  params: GetInsightByPeriodParams,
): Promise<boolean> {
  return Boolean(await getInsightByPeriod(db, params));
}

export type HasEarlierInsightParams = {
  teamId: string;
  periodType: InsightPeriodType;
  periodYear: number;
  periodNumber: number;
};

export async function hasEarlierInsight(
  db: Database,
  params: HasEarlierInsightParams,
): Promise<boolean> {
  const { teamId, periodType, periodYear, periodNumber } = params;

  return (await listTeamInsights(db, teamId)).some(
    (insight) =>
      insight.periodType === periodType &&
      insight.status === "completed" &&
      (insight.periodYear < periodYear ||
        (insight.periodYear === periodYear && insight.periodNumber < periodNumber)),
  );
}
