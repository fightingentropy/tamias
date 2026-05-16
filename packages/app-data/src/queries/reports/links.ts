import { UTCDate } from "@date-fns/utc";
import { format, endOfMonth, startOfMonth, subMonths } from "date-fns";
import type { Database } from "../../client";
import { reuseQueryResult } from "../../utils/request-cache";
import { InvalidReportTypeError, ReportExpiredError, ReportNotFoundError } from "../../errors";
import { getReports } from "./core";
import { getRevenueForecast } from "./forecast";
import {
  generateReportLinkIdInD1,
  getReportLinkByLinkIdFromD1,
  getReportLinksD1,
  insertReportLinkInD1,
} from "./links-d1";
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

export type ReportLinkRecord = {
  id: string;
  linkId: string;
  type: ReportType;
  from: string;
  to: string;
  currency: string | null;
  teamId: string | null;
  createdAt: string;
  expireAt: string | null;
  teamName: string | null;
  teamLogoUrl: string | null;
};

export type CreateReportParams = {
  type: ReportType;
  from: string;
  to: string;
  currency?: string;
  teamId: string;
  createdByUserId: string;
  expireAt?: string;
};

function requireReportLinksD1(db: Database) {
  const d1 = getReportLinksD1(db);

  if (!d1) {
    throw new Error("Report links require Cloudflare D1");
  }

  return d1;
}

export async function createReport(db: Database, params: CreateReportParams) {
  const d1 = requireReportLinksD1(db);
  const id = crypto.randomUUID();
  const linkId = await generateReportLinkIdInD1(d1);
  const report = await insertReportLinkInD1(d1, {
    ...params,
    id,
    linkId,
  });

  if (!report) {
    throw new Error("Failed to create report link");
  }

  return report;
}

async function getReportByLinkIdImpl(db: Database, linkId: string) {
  return getReportLinkByLinkIdFromD1(requireReportLinksD1(db), linkId);
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
