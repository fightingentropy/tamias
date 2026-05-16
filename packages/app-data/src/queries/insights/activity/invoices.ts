import type { Database } from "../../../client";
import { normalizeTimestampBoundary } from "../../date-boundaries";
import { getProjectedInvoicesByFilters } from "../../invoice-projections";
import { getInvoiceAnalyticsAggregateRowsFromD1 } from "../../reports/shared/aggregates";
import type { GetInsightActivityDataParams } from "./types";

type InvoiceActivityStats = {
  sent: number;
  paid: number;
  largestPayment?: { customer: string; amount: number };
};

export async function getInvoiceActivityStats(
  db: Database,
  params: GetInsightActivityDataParams,
): Promise<InvoiceActivityStats> {
  const { teamId, from, to } = params;
  const fromBoundary = normalizeTimestampBoundary(from, "start");
  const toBoundary = normalizeTimestampBoundary(to, "end");
  const [sentRows, paidRows, paidInvoices] = await Promise.all([
    getInvoiceAnalyticsAggregateRowsFromD1(db, {
      teamId,
      dateField: "sentAt",
      dateFrom: fromBoundary,
      dateTo: toBoundary,
    }),
    getInvoiceAnalyticsAggregateRowsFromD1(db, {
      teamId,
      statuses: ["paid"],
      dateField: "paidAt",
      dateFrom: fromBoundary,
      dateTo: toBoundary,
    }),
    getProjectedInvoicesByFilters(db, {
      teamId,
      statuses: ["paid"],
      dateField: "paidAt",
      from,
      to,
    }),
  ]);
  const largestPayment = [...paidInvoices].sort(
    (left, right) => (Number(right.amount) || 0) - (Number(left.amount) || 0),
  )[0];

  return {
    sent: sentRows.reduce((sum, row) => sum + row.invoiceCount, 0),
    paid: paidRows.reduce((sum, row) => sum + row.invoiceCount, 0),
    largestPayment:
      largestPayment && Number(largestPayment.amount) > 0
        ? {
            customer: largestPayment.customerName ?? "Unknown",
            amount: Number(largestPayment.amount),
          }
        : undefined,
  };
}
