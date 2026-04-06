import { format, parseISO, subMonths } from "date-fns";
import type { Database } from "../../../client";
import { getReportInvoiceAgingAggregateRows, getReportInvoiceDateAggregateRows } from "../shared";
import type { ExpectedCollections, TeamCollectionMetrics } from "./types";

export async function getTeamCollectionMetrics(
  db: Database,
  teamId: string,
): Promise<TeamCollectionMetrics> {
  const twelveMonthsAgo = format(subMonths(new Date(), 12), "yyyy-MM-dd");
  const aggregateRows = await getReportInvoiceDateAggregateRows(db, {
    teamId,
    statuses: ["paid"],
    dateField: "paidAt",
    from: twelveMonthsAgo,
  });

  if (aggregateRows) {
    const onTimeCount = aggregateRows.reduce((sum, row) => sum + row.onTimeCount, 0);
    const totalDaysToPay = aggregateRows.reduce((sum, row) => sum + row.totalDaysToPay, 0);
    const validPaymentCount = aggregateRows.reduce((sum, row) => sum + row.validPaymentCount, 0);

    return {
      onTimeRate: validPaymentCount > 0 ? onTimeCount / validPaymentCount : 0.7,
      avgDaysToPay: validPaymentCount > 0 ? totalDaysToPay / validPaymentCount : 30,
      sampleSize: validPaymentCount,
    };
  }

  return {
    onTimeRate: 0.7,
    avgDaysToPay: 30,
    sampleSize: 0,
  };
}

export async function calculateExpectedCollections(
  db: Database,
  teamId: string,
  teamMetrics: TeamCollectionMetrics,
  currency?: string,
): Promise<ExpectedCollections> {
  const aggregateRows = await getReportInvoiceAgingAggregateRows(db, {
    teamId,
    inputCurrency: currency,
    statuses: ["unpaid", "overdue"],
  });

  if (aggregateRows) {
    const now = new Date();
    const teamFactor = teamMetrics.onTimeRate / 0.7;
    let month1Total = 0;
    let month2Total = 0;
    let invoiceCount = 0;

    for (const row of aggregateRows) {
      const amount = row.totalAmount;
      const daysSinceIssue = row.issueDate
        ? Math.floor((now.getTime() - parseISO(row.issueDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const daysPastDue = row.dueDate
        ? Math.floor((now.getTime() - parseISO(row.dueDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      let baseProbability: number;
      if (daysSinceIssue < 30) {
        baseProbability = 0.85;
      } else if (daysPastDue <= 0) {
        baseProbability = 0.75;
      } else if (daysPastDue <= 30) {
        baseProbability = 0.5;
      } else if (daysPastDue <= 60) {
        baseProbability = 0.3;
      } else if (daysPastDue <= 90) {
        baseProbability = 0.15;
      } else {
        baseProbability = 0.05;
      }

      const adjustedProbability = Math.min(0.95, Math.max(0.05, baseProbability * teamFactor));
      const expectedAmount = amount * adjustedProbability;

      if (daysSinceIssue < 45) {
        month1Total += expectedAmount;
      } else {
        month1Total += expectedAmount * 0.6;
        month2Total += expectedAmount * 0.4;
      }

      invoiceCount += row.invoiceCount;
    }

    return {
      month1: month1Total,
      month2: month2Total,
      totalExpected: month1Total + month2Total,
      invoiceCount,
    };
  }

  return {
    month1: 0,
    month2: 0,
    totalExpected: 0,
    invoiceCount: 0,
  };
}
