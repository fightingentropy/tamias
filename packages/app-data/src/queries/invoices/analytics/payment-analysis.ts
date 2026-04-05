import { UTCDate } from "@date-fns/utc";
import { getInvoiceAnalyticsAggregateRowsFromConvex } from "../../../convex";
import {
  eachMonthOfInterval,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from "date-fns";
import type { Database } from "../../../client";
import { reuseQueryResult } from "../../../utils/request-cache";

export type GetInvoicePaymentAnalysisParams = {
  teamId: string;
  from: string;
  to: string;
  currency?: string;
};

export type InvoicePaymentAnalysisResult = {
  metrics: {
    averageDaysToPay: number;
    paymentRate: number;
    overdueRate: number;
    paymentScore: number;
    totalInvoices: number;
    paidInvoices: number;
    unpaidInvoices: number;
    overdueInvoices: number;
    overdueAmount: number;
  };
  paymentTrends: Array<{
    month: string;
    averageDaysToPay: number;
    paymentRate: number;
    invoiceCount: number;
  }>;
  overdueSummary: {
    count: number;
    totalAmount: number;
    oldestDays: number;
  };
};

async function getInvoicePaymentAnalysisImpl(
  _db: Database,
  params: GetInvoicePaymentAnalysisParams,
): Promise<InvoicePaymentAnalysisResult> {
  const { teamId, from, to, currency: inputCurrency } = params;
  const fromDate = startOfMonth(new UTCDate(parseISO(from)));
  const toDate = endOfMonth(new UTCDate(parseISO(to)));
  const allRows = await getInvoiceAnalyticsAggregateRowsFromConvex({
    teamId,
    dateField: "createdAt",
    dateFrom: fromDate.toISOString(),
    dateTo: toDate.toISOString(),
    currency: inputCurrency ?? null,
  });

  if (allRows.length === 0) {
    return {
      metrics: {
        averageDaysToPay: 0,
        paymentRate: 0,
        overdueRate: 0,
        paymentScore: 0,
        totalInvoices: 0,
        paidInvoices: 0,
        unpaidInvoices: 0,
        overdueInvoices: 0,
        overdueAmount: 0,
      },
      paymentTrends: [],
      overdueSummary: {
        count: 0,
        totalAmount: 0,
        oldestDays: 0,
      },
    };
  }

  const now = new Date();
  const paidRows = allRows.filter((row) => row.status === "paid");
  const unpaidRows = allRows.filter(
    (row) => row.status === "unpaid" || row.status === "overdue",
  );
  const overdueRows = allRows.filter(
    (row) =>
      row.status === "overdue" ||
      (row.status === "unpaid" && row.dueDate && parseISO(row.dueDate) < now),
  );
  const totalInvoices = allRows.reduce((sum, row) => sum + row.invoiceCount, 0);
  const paidInvoices = paidRows.reduce((sum, row) => sum + row.invoiceCount, 0);
  const unpaidInvoices = unpaidRows.reduce(
    (sum, row) => sum + row.invoiceCount,
    0,
  );
  const overdueInvoices = overdueRows.reduce(
    (sum, row) => sum + row.invoiceCount,
    0,
  );
  const overdueAmount = overdueRows.reduce(
    (sum, row) => sum + row.totalAmount,
    0,
  );
  const totalDaysToPay = paidRows.reduce(
    (sum, row) => sum + row.issueToPaidTotalDays,
    0,
  );
  const paidCount = paidRows.reduce(
    (sum, row) => sum + row.issueToPaidValidCount,
    0,
  );
  const averageDaysToPay =
    paidCount > 0 ? Math.round(totalDaysToPay / paidCount) : 0;
  const paymentRate =
    totalInvoices > 0 ? Math.round((paidInvoices / totalInvoices) * 100) : 0;
  const overdueRate =
    totalInvoices > 0 ? Math.round((overdueInvoices / totalInvoices) * 100) : 0;

  let paymentScore = 100;

  if (averageDaysToPay > 30) {
    paymentScore = Math.max(0, 100 - (averageDaysToPay - 30) * 2);
  } else if (averageDaysToPay > 14) {
    paymentScore = 85 - ((averageDaysToPay - 14) / 16) * 25;
  } else if (averageDaysToPay > 7) {
    paymentScore = 100 - ((averageDaysToPay - 7) / 7) * 15;
  }

  paymentScore = Math.max(0, Math.min(100, paymentScore - overdueRate * 0.5));

  const paymentTrends = eachMonthOfInterval({
    start: fromDate,
    end: toDate,
  }).map((monthStart) => {
    const month = format(monthStart, "yyyy-MM");
    const monthRows = allRows.filter(
      (row) => format(parseISO(row.date), "yyyy-MM") === month,
    );
    const monthInvoices = monthRows.reduce(
      (sum, row) => sum + row.invoiceCount,
      0,
    );
    const monthPaidRows = monthRows.filter((row) => row.status === "paid");
    const monthPaid = monthPaidRows.reduce(
      (sum, row) => sum + row.invoiceCount,
      0,
    );
    const monthTotalDays = monthPaidRows.reduce(
      (sum, row) => sum + row.issueToPaidTotalDays,
      0,
    );
    const monthPaidCount = monthPaidRows.reduce(
      (sum, row) => sum + row.issueToPaidValidCount,
      0,
    );

    return {
      month,
      averageDaysToPay:
        monthPaidCount > 0 ? Math.round(monthTotalDays / monthPaidCount) : 0,
      paymentRate:
        monthInvoices > 0 ? Math.round((monthPaid / monthInvoices) * 100) : 0,
      invoiceCount: monthInvoices,
    };
  });

  let oldestDays = 0;

  for (const row of overdueRows) {
    if (!row.dueDate) {
      continue;
    }

    const daysOverdue =
      (now.getTime() - parseISO(row.dueDate).getTime()) /
      (1000 * 60 * 60 * 24);

    oldestDays = Math.max(oldestDays, Math.round(daysOverdue));
  }

  return {
    metrics: {
      averageDaysToPay,
      paymentRate,
      overdueRate,
      paymentScore: Math.round(paymentScore),
      totalInvoices,
      paidInvoices,
      unpaidInvoices,
      overdueInvoices,
      overdueAmount: Math.round(overdueAmount * 100) / 100,
    },
    paymentTrends,
    overdueSummary: {
      count: overdueInvoices,
      totalAmount: Math.round(overdueAmount * 100) / 100,
      oldestDays,
    },
  };
}

export const getInvoicePaymentAnalysis = reuseQueryResult({
  keyPrefix: "invoice-payment-analysis",
  keyFn: (params: GetInvoicePaymentAnalysisParams) =>
    [params.teamId, params.from, params.to, params.currency ?? ""].join(":"),
  load: getInvoicePaymentAnalysisImpl,
});
