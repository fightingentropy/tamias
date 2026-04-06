import { UTCDate } from "@date-fns/utc";
import { format, endOfMonth, startOfMonth, subMonths } from "date-fns";
import type { Database } from "../../client";
import { reuseQueryResult } from "../../utils/request-cache";
import { InvalidReportTypeError, ReportExpiredError, ReportNotFoundError } from "../../errors";
import {
  createReportLinkInConvex,
  getReportLinkByLinkIdFromConvex,
  type CurrentUserIdentityRecord,
} from "@tamias/app-data-convex";
import { getReports } from "./core";
import { getRevenueForecast } from "./forecast";
import { getBurnRate, getExpenses, getRunway, getSpending } from "./metrics";

export type ReportType =
  | "profit"
  | "revenue"
  | "burn_rate"
  | "expense"
  | "monthly_revenue"
  | "revenue_forecast"
  | "runway"
  | "category_expenses";

export type CreateReportParams = {
  type: ReportType;
  from: string;
  to: string;
  currency?: string;
  teamId: string;
  createdByUserId: CurrentUserIdentityRecord["convexId"];
  expireAt?: string;
};

export async function createReport(_db: Database, params: CreateReportParams) {
  const { type, from, to, currency, teamId, createdByUserId, expireAt } = params;
  return createReportLinkInConvex({
    teamId,
    userId: createdByUserId,
    type,
    from,
    to,
    currency: currency ?? undefined,
    expireAt,
  });
}

async function getReportByLinkIdImpl(_db: Database, linkId: string) {
  return getReportLinkByLinkIdFromConvex({ linkId });
}

export const getReportByLinkId = reuseQueryResult({
  keyPrefix: "report-link",
  keyFn: (linkId: string) => linkId,
  load: getReportByLinkIdImpl,
});

async function getChartDataByLinkIdImpl(db: Database, linkId: string) {
  const report = await getReportByLinkId(db, linkId);

  if (!report) {
    throw new ReportNotFoundError();
  }

  if (report.expireAt && new Date(report.expireAt) < new Date()) {
    throw new ReportExpiredError();
  }

  const teamId = report.teamId!;
  const from = report.from!;
  const to = report.to!;
  const currency = report.currency || "USD";
  const type = report.type!;

  switch (type) {
    case "burn_rate":
      return {
        type: "burn_rate" as const,
        data: await getBurnRate(db, { teamId, from, to, currency }),
      };
    case "monthly_revenue":
    case "revenue":
      return {
        type: "revenue" as const,
        data: await getReports(db, {
          teamId,
          from,
          to,
          currency,
          type: "revenue",
          revenueType: "net",
        }),
      };
    case "profit":
      return {
        type: "profit" as const,
        data: await getReports(db, {
          teamId,
          from,
          to,
          currency,
          type: "profit",
          revenueType: "net",
        }),
      };
    case "expense":
      return {
        type: "expense" as const,
        data: await getExpenses(db, { teamId, from, to, currency }),
      };
    case "revenue_forecast":
      return {
        type: "revenue_forecast" as const,
        data: await getRevenueForecast(db, {
          teamId,
          from,
          to,
          forecastMonths: 6,
          currency,
          revenueType: "net",
        }),
      };
    case "runway": {
      const burnRateToDate = endOfMonth(new UTCDate());
      const burnRateFromDate = startOfMonth(subMonths(burnRateToDate, 5));
      const burnRateFrom = format(burnRateFromDate, "yyyy-MM-dd");
      const burnRateTo = format(burnRateToDate, "yyyy-MM-dd");

      const [runwayData, burnRateData] = await Promise.all([
        getRunway(db, {
          teamId,
          currency,
        }),
        getBurnRate(db, {
          teamId,
          from: burnRateFrom,
          to: burnRateTo,
          currency,
        }),
      ]);
      return {
        type: "runway" as const,
        data: {
          runway: runwayData,
          burnRate: burnRateData,
        },
      };
    }
    case "category_expenses":
      return {
        type: "category_expenses" as const,
        data: await getSpending(db, { teamId, from, to, currency }),
      };
    default:
      throw new InvalidReportTypeError();
  }
}

export const getChartDataByLinkId = reuseQueryResult({
  keyPrefix: "report-link-chart-data",
  keyFn: (linkId: string) => linkId,
  load: getChartDataByLinkIdImpl,
});
