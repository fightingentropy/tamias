import { getInvoiceAnalyticsAggregateRowsFromConvex } from "../../../convex";
import type { Database } from "../../../client";
import { reuseQueryResult } from "../../../utils/request-cache";

export type GetAverageDaysToPaymentParams = {
  teamId: string;
};

async function getAverageDaysToPaymentImpl(
  _db: Database,
  params: GetAverageDaysToPaymentParams,
) {
  const { teamId } = params;
  const thirtyDaysAgo = new Date();

  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const rows = await getInvoiceAnalyticsAggregateRowsFromConvex({
    teamId,
    dateField: "paidAt",
    statuses: ["paid"],
    dateFrom: thirtyDaysAgo.toISOString(),
  });
  const validCount = rows.reduce(
    (sum, row) => sum + row.sentToPaidValidCount,
    0,
  );
  const totalDays = rows.reduce((sum, row) => sum + row.sentToPaidTotalDays, 0);

  if (validCount === 0) {
    return 0;
  }

  return Math.round(totalDays / validCount);
}

export const getAverageDaysToPayment = reuseQueryResult({
  keyPrefix: "average-days-to-payment",
  keyFn: (params: GetAverageDaysToPaymentParams) => params.teamId,
  load: getAverageDaysToPaymentImpl,
});

export type GetAverageInvoiceSizeParams = {
  teamId: string;
};

async function getAverageInvoiceSizeImpl(
  _db: Database,
  params: GetAverageInvoiceSizeParams,
) {
  const { teamId } = params;
  const thirtyDaysAgo = new Date();

  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const grouped = new Map<
    string,
    {
      currency: string | null;
      totalAmount: number;
      invoiceCount: number;
    }
  >();

  for (const row of await getInvoiceAnalyticsAggregateRowsFromConvex({
    teamId,
    dateField: "sentAt",
    dateFrom: thirtyDaysAgo.toISOString(),
  })) {
    const currency = row.currency ?? null;
    const key = currency ?? "__null__";
    const current = grouped.get(key) ?? {
      currency,
      totalAmount: 0,
      invoiceCount: 0,
    };

    current.totalAmount += row.totalAmount;
    current.invoiceCount += row.invoiceCount;
    grouped.set(key, current);
  }

  return [...grouped.values()].map((entry) => ({
    currency: entry.currency,
    averageAmount:
      entry.invoiceCount > 0
        ? Math.round((entry.totalAmount / entry.invoiceCount) * 100) / 100
        : 0,
    invoiceCount: entry.invoiceCount,
  }));
}

export const getAverageInvoiceSize = reuseQueryResult({
  keyPrefix: "average-invoice-size",
  keyFn: (params: GetAverageInvoiceSizeParams) => params.teamId,
  load: getAverageInvoiceSizeImpl,
});
