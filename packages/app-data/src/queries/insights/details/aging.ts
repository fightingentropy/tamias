import { getInvoiceAgingAggregateRowsFromConvex } from "../../../convex";
import type { Database } from "../../../client";

export type UpcomingInvoicesResult = {
  totalDue: number;
  count: number;
  currency: string;
};

export async function getUpcomingInvoicesForInsight(
  _db: Database,
  params: {
    teamId: string;
    fromDate: Date;
    toDate: Date;
    currency?: string;
  },
): Promise<UpcomingInvoicesResult> {
  const { teamId, fromDate, toDate, currency } = params;
  const dueDateFrom = fromDate.toISOString().slice(0, 10);
  const dueDateTo = toDate.toISOString().slice(0, 10);
  const matchingRows = (
    await getInvoiceAgingAggregateRowsFromConvex({
      teamId,
      statuses: ["unpaid", "overdue"],
      currency: currency ?? null,
    })
  ).filter(
    (row) =>
      !!row.dueDate && row.dueDate >= dueDateFrom && row.dueDate <= dueDateTo,
  );
  const row = matchingRows.length
    ? {
        totalAmount: matchingRows.reduce(
          (sum, aggregateRow) => sum + aggregateRow.totalAmount,
          0,
        ),
        invoiceCount: matchingRows.reduce(
          (sum, aggregateRow) => sum + aggregateRow.invoiceCount,
          0,
        ),
        currency: matchingRows[0]?.currency ?? null,
      }
    : null;

  return {
    totalDue: Number(row?.totalAmount ?? 0),
    count: row?.invoiceCount ?? 0,
    currency: row?.currency ?? currency ?? "USD",
  };
}

export type OverdueInvoicesSummary = {
  count: number;
  totalAmount: number;
  oldestDays: number;
  currency: string;
};

export async function getOverdueInvoicesSummary(
  _db: Database,
  params: {
    teamId: string;
    asOfDate: Date;
    currency?: string;
  },
): Promise<OverdueInvoicesSummary> {
  const { teamId, asOfDate, currency } = params;
  const asOfBoundary = asOfDate.toISOString().slice(0, 10);
  const overdueRows = (
    await getInvoiceAgingAggregateRowsFromConvex({
      teamId,
      statuses: ["overdue"],
      currency: currency ?? null,
    })
  ).filter((row) => !!row.dueDate && row.dueDate < asOfBoundary);

  const summaryResult =
    overdueRows.length > 0
      ? {
          totalAmount: overdueRows.reduce(
            (sum, aggregateRow) => sum + aggregateRow.totalAmount,
            0,
          ),
          invoiceCount: overdueRows.reduce(
            (sum, aggregateRow) => sum + aggregateRow.invoiceCount,
            0,
          ),
          oldestDueDate:
            [...overdueRows]
              .map((aggregateRow) => aggregateRow.dueDate!)
              .sort((left, right) => left.localeCompare(right))[0] ??
            asOfDate.toISOString(),
          currency: overdueRows[0]?.currency ?? null,
        }
      : null;

  if (!summaryResult || summaryResult.invoiceCount === 0) {
    return {
      count: 0,
      totalAmount: 0,
      oldestDays: 0,
      currency: currency ?? "USD",
    };
  }

  const oldestDueDate = new Date(summaryResult.oldestDueDate);
  const oldestDays = Math.floor(
    (asOfDate.getTime() - oldestDueDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  return {
    count: summaryResult.invoiceCount,
    totalAmount: Number(summaryResult.totalAmount),
    oldestDays: Math.max(0, oldestDays),
    currency: summaryResult.currency ?? currency ?? "USD",
  };
}
