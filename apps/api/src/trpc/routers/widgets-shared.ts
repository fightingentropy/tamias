import type { CurrentUserIdentityRecord } from "@tamias/app-data-convex";
import type { Database } from "@tamias/app-data/client";
import {
  getCashFlow,
  getGrowthRate,
  getReports,
} from "@tamias/app-data/queries";
import type { Session } from "@tamias/auth-session";

type ConvexUserId = CurrentUserIdentityRecord["convexId"];

export function getWidgetAssignedUserId(session: Session): ConvexUserId {
  return session.user.convexId ?? session.user.id;
}

export function requireWidgetConvexUserId(session: Session): ConvexUserId {
  if (!session.user.convexId) {
    throw new Error("Missing Convex user id");
  }

  return session.user.convexId;
}

export async function getRevenueSummaryWidgetData(
  db: Database,
  teamId: string,
  input: {
    from: string;
    to: string;
    currency?: string;
    revenueType: "gross" | "net";
  },
) {
  const result = await getReports(db, {
    teamId,
    from: input.from,
    to: input.to,
    currency: input.currency,
    type: "revenue",
    revenueType: input.revenueType,
  });

  return {
    result: {
      totalRevenue: result.summary.currentTotal,
      currency: result.summary.currency,
      revenueType: input.revenueType,
      monthCount: result.result.length,
    },
  };
}

export async function getGrowthRateWidgetData(
  db: Database,
  teamId: string,
  input: {
    from: string;
    to: string;
    currency?: string;
    revenueType: "gross" | "net";
  },
) {
  const growthData = await getGrowthRate(db, {
    teamId,
    from: input.from,
    to: input.to,
    currency: input.currency,
    type: "revenue",
    revenueType: input.revenueType,
    period: "quarterly",
  });

  return {
    result: {
      currentTotal: growthData.summary.currentTotal,
      prevTotal: growthData.summary.previousTotal,
      growthRate: growthData.summary.growthRate,
      quarterlyGrowthRate: growthData.summary.periodGrowthRate,
      currency: growthData.summary.currency,
      type: growthData.summary.type,
      revenueType: growthData.summary.revenueType,
      period: growthData.summary.period,
      trend: growthData.summary.trend,
      meta: growthData.meta,
    },
  };
}

export async function getCashFlowWidgetData(
  db: Database,
  teamId: string,
  input: {
    from: string;
    to: string;
    currency?: string;
  },
) {
  const cashFlowData = await getCashFlow(db, {
    teamId,
    from: input.from,
    to: input.to,
    currency: input.currency,
    period: "monthly",
  });

  return {
    result: {
      netCashFlow: cashFlowData.summary.netCashFlow,
      currency: cashFlowData.summary.currency,
      period: cashFlowData.summary.period,
      meta: cashFlowData.meta,
    },
  };
}
