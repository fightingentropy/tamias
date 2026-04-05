import type { ConvexUserId } from "./base";
import { api, createClient, serviceArgs } from "./base";

const apiWithInsightsStore = api as typeof api & {
  insightsStore: {
    serviceCreateInsight: any;
    serviceUpdateInsight: any;
    serviceListInsights: any;
    serviceGetInsightById: any;
  };
};

export type InsightUserStatusRecord = {
  insightId: string;
  userId: ConvexUserId;
  readAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReportLinkType =
  | "profit"
  | "revenue"
  | "burn_rate"
  | "expense"
  | "monthly_revenue"
  | "revenue_forecast"
  | "runway"
  | "category_expenses";

export type ReportLinkRecord = {
  id: string;
  linkId: string;
  type: ReportLinkType;
  from: string;
  to: string;
  currency: string | null;
  teamId: string | null;
  createdAt: string;
  expireAt: string | null;
  teamName: string | null;
  teamLogoUrl: string | null;
};

export type SourceLinkType =
  | "transaction"
  | "invoice"
  | "invoice_refund"
  | "inbox"
  | "manual_adjustment"
  | "payroll_import";

export type InsightRecord = {
  id: string;
  teamId: string;
  periodType: "weekly" | "monthly" | "quarterly" | "yearly";
  periodStart: string;
  periodEnd: string;
  periodYear: number;
  periodNumber: number;
  status: "pending" | "generating" | "completed" | "failed";
  selectedMetrics: unknown;
  allMetrics: unknown;
  anomalies: unknown;
  expenseAnomalies: unknown;
  milestones: unknown;
  activity: unknown;
  currency: string;
  title: string | null;
  content: unknown;
  predictions: unknown;
  audioPath: string | null;
  generatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getInsightUserStatusesFromConvex(args: {
  userId: ConvexUserId;
}) {
  return createClient().query(
    api.insights.serviceGetInsightUserStatuses,
    serviceArgs({
      userId: args.userId,
    }),
  ) as Promise<InsightUserStatusRecord[]>;
}

export async function markInsightAsReadInConvex(args: {
  userId: ConvexUserId;
  insightId: string;
}) {
  return createClient().mutation(
    api.insights.serviceMarkInsightAsRead,
    serviceArgs({
      userId: args.userId,
      insightId: args.insightId,
    }),
  ) as Promise<InsightUserStatusRecord>;
}

export async function dismissInsightInConvex(args: {
  userId: ConvexUserId;
  insightId: string;
}) {
  return createClient().mutation(
    api.insights.serviceDismissInsight,
    serviceArgs({
      userId: args.userId,
      insightId: args.insightId,
    }),
  ) as Promise<InsightUserStatusRecord>;
}

export async function undoDismissInsightInConvex(args: {
  userId: ConvexUserId;
  insightId: string;
}) {
  return createClient().mutation(
    api.insights.serviceUndoDismissInsight,
    serviceArgs({
      userId: args.userId,
      insightId: args.insightId,
    }),
  ) as Promise<InsightUserStatusRecord | null>;
}

export async function createReportLinkInConvex(args: {
  teamId: string;
  userId: ConvexUserId;
  type: ReportLinkType;
  from: string;
  to: string;
  currency?: string;
  expireAt?: string;
}) {
  return createClient().mutation(
    api.reportLinks.serviceCreateReportLink,
    serviceArgs({
      publicTeamId: args.teamId,
      userId: args.userId,
      type: args.type,
      from: args.from,
      to: args.to,
      currency: args.currency,
      expireAt: args.expireAt,
    }),
  ) as Promise<ReportLinkRecord>;
}

export async function getReportLinkByLinkIdFromConvex(args: {
  linkId: string;
}) {
  return createClient().query(
    api.reportLinks.serviceGetReportLinkByLinkId,
    serviceArgs({
      linkId: args.linkId,
    }),
  ) as Promise<ReportLinkRecord | null>;
}

export async function countSourceLinksBySourceTypesFromConvex(args: {
  teamId: string;
  sourceTypes: SourceLinkType[];
}) {
  return createClient().query(
    api.sourceLinks.serviceCountSourceLinksBySourceTypes,
    serviceArgs({
      publicTeamId: args.teamId,
      sourceTypes: args.sourceTypes,
    }),
  ) as Promise<number>;
}

export async function createInsightInConvex(args: {
  teamId: string;
  periodType: "weekly" | "monthly" | "quarterly" | "yearly";
  periodStart: string;
  periodEnd: string;
  periodYear: number;
  periodNumber: number;
  currency: string;
}) {
  return createClient().mutation(
    apiWithInsightsStore.insightsStore.serviceCreateInsight,
    serviceArgs({
      publicTeamId: args.teamId,
      periodType: args.periodType,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      periodYear: args.periodYear,
      periodNumber: args.periodNumber,
      currency: args.currency,
    }),
  ) as Promise<InsightRecord | null>;
}

export async function updateInsightInConvex(args: {
  teamId: string;
  id: string;
  status?: "pending" | "generating" | "completed" | "failed";
  title?: string | null;
  selectedMetrics?: unknown;
  allMetrics?: unknown;
  anomalies?: unknown;
  expenseAnomalies?: unknown;
  milestones?: unknown;
  activity?: unknown;
  content?: unknown;
  predictions?: unknown;
  audioPath?: string | null;
  generatedAt?: string | null;
}) {
  return createClient().mutation(
    apiWithInsightsStore.insightsStore.serviceUpdateInsight,
    serviceArgs({
      publicTeamId: args.teamId,
      insightId: args.id,
      status: args.status,
      title: args.title,
      selectedMetrics: args.selectedMetrics,
      allMetrics: args.allMetrics,
      anomalies: args.anomalies,
      expenseAnomalies: args.expenseAnomalies,
      milestones: args.milestones,
      activity: args.activity,
      content: args.content,
      predictions: args.predictions,
      audioPath: args.audioPath,
      generatedAt: args.generatedAt,
    }),
  ) as Promise<InsightRecord | null>;
}

export async function listInsightsFromConvex(args: { teamId: string }) {
  return createClient().query(
    apiWithInsightsStore.insightsStore.serviceListInsights,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<InsightRecord[]>;
}

export async function getInsightByIdFromConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().query(
    apiWithInsightsStore.insightsStore.serviceGetInsightById,
    serviceArgs({
      publicTeamId: args.teamId,
      insightId: args.id,
    }),
  ) as Promise<InsightRecord | null>;
}
