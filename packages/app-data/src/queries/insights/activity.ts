import {
  getInboxItemsFromConvex,
  getInboxStatusCountSummaryFromConvex,
  getInvoiceAnalyticsAggregateRowsFromConvex,
  getTrackerEntriesByRangeFromConvex,
  getTrackerProjectsByIdsFromConvex,
  getTrackerProjectsFromConvex,
  getTransactionsPageFromConvex,
  getTransactionsFromConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../../client";
import { countCustomersCreatedBetween } from "../customer-activity-shared";
import { normalizeTimestampBoundary } from "../date-boundaries";
import { getProjectedInvoicesByFilters } from "../invoice-projections";

const ACTIVITY_PAGE_SIZE = 200;

export type GetInsightActivityDataParams = {
  teamId: string;
  from: string;
  to: string;
  currency: string;
};

type InvoiceActivityStats = {
  sent: number;
  paid: number;
  largestPayment?: { customer: string; amount: number };
};

async function getInvoiceActivityStats(
  _db: Database,
  params: GetInsightActivityDataParams,
): Promise<InvoiceActivityStats> {
  const { teamId, from, to } = params;
  const fromBoundary = normalizeTimestampBoundary(from, "start");
  const toBoundary = normalizeTimestampBoundary(to, "end");
  const [sentRows, paidRows, paidInvoices] = await Promise.all([
    getInvoiceAnalyticsAggregateRowsFromConvex({
      teamId,
      dateField: "sentAt",
      dateFrom: fromBoundary,
      dateTo: toBoundary,
    }),
    getInvoiceAnalyticsAggregateRowsFromConvex({
      teamId,
      statuses: ["paid"],
      dateField: "paidAt",
      dateFrom: fromBoundary,
      dateTo: toBoundary,
    }),
    getProjectedInvoicesByFilters({
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

type TrackerActivityStats = {
  totalHours: number;
  unbilledHours: number;
  billableAmount: number;
};

async function getTrackerActivityStats(
  _db: Database,
  params: GetInsightActivityDataParams,
): Promise<TrackerActivityStats> {
  const { teamId, from, to } = params;
  const entries = await getTrackerEntriesByRangeFromConvex({
    teamId,
    from,
    to,
  });
  const projectIds = [
    ...new Set(
      entries
        .map((entry) => entry.projectId)
        .filter((projectId): projectId is string => projectId !== null),
    ),
  ];
  const projects =
    projectIds.length > 0
      ? await getTrackerProjectsByIdsFromConvex({
          teamId,
          projectIds,
        })
      : [];
  const projectById = new Map(projects.map((project) => [project.id, project]));

  let totalSeconds = 0;
  let unbilledSeconds = 0;
  let billableAmount = 0;

  for (const entry of entries) {
    const duration = entry.duration ?? 0;
    totalSeconds += duration;

    if (!entry.billed) {
      unbilledSeconds += duration;
      const rate = Number(
        entry.rate ??
          (entry.projectId ? projectById.get(entry.projectId)?.rate : 0) ??
          0,
      );
      billableAmount += (rate * duration) / 3600;
    }
  }

  return {
    totalHours: Math.round((totalSeconds / 3600) * 10) / 10,
    unbilledHours: Math.round((unbilledSeconds / 3600) * 10) / 10,
    billableAmount: Math.round(billableAmount * 100) / 100,
  };
}

type CustomerActivityStats = {
  newCount: number;
};

async function getCustomerActivityStats(
  _db: Database,
  params: GetInsightActivityDataParams,
): Promise<CustomerActivityStats> {
  const { teamId, from, to } = params;

  return {
    newCount: await countCustomersCreatedBetween({
      teamId,
      from,
      to,
    }),
  };
}

type InboxActivityStats = {
  matchedCount: number;
};

async function countInboxItemsCreatedBetween(args: {
  teamId: string;
  from: string;
  to: string;
  status: "done";
}) {
  const fromBoundary = normalizeTimestampBoundary(args.from, "start");
  const toBoundary = normalizeTimestampBoundary(args.to, "end");
  const summary = await getInboxStatusCountSummaryFromConvex({
    teamId: args.teamId,
    createdAtFrom: fromBoundary,
    createdAtTo: toBoundary,
    rangeStatus: args.status,
  });

  return summary.rangeCount;
}

async function getInboxActivityStats(
  _db: Database,
  params: GetInsightActivityDataParams,
): Promise<InboxActivityStats> {
  const { teamId, from, to } = params;

  return {
    matchedCount: await countInboxItemsCreatedBetween({
      teamId,
      from,
      to,
      status: "done",
    }),
  };
}

type TransactionActivityStats = {
  categorizedCount: number;
};

async function countCategorizedTransactionsByDateRange(args: {
  teamId: string;
  from: string;
  to: string;
}) {
  let cursor: string | null = null;
  let categorizedCount = 0;

  while (true) {
    const page = await getTransactionsPageFromConvex({
      teamId: args.teamId,
      cursor,
      pageSize: ACTIVITY_PAGE_SIZE,
      order: "desc",
      dateGte: args.from,
    });

    for (const transaction of page.page) {
      if (transaction.date > args.to) {
        continue;
      }

      if (transaction.date < args.from) {
        return categorizedCount;
      }

      if (transaction.categorySlug !== null) {
        categorizedCount += 1;
      }
    }

    if (page.isDone) {
      return categorizedCount;
    }

    cursor = page.continueCursor;
  }
}

async function getTransactionActivityStats(
  _db: Database,
  params: GetInsightActivityDataParams,
): Promise<TransactionActivityStats> {
  const { teamId, from, to } = params;

  return {
    categorizedCount: await countCategorizedTransactionsByDateRange({
      teamId,
      from,
      to,
    }),
  };
}

export type InsightActivityData = {
  invoicesSent: number;
  invoicesPaid: number;
  largestPayment?: { customer: string; amount: number };
  hoursTracked: number;
  unbilledHours: number;
  billableAmount: number;
  newCustomers: number;
  receiptsMatched: number;
  transactionsCategorized: number;
};

export async function getInsightActivityData(
  db: Database,
  params: GetInsightActivityDataParams,
): Promise<InsightActivityData> {
  const [
    invoiceStats,
    trackerStats,
    customerStats,
    inboxStats,
    transactionStats,
  ] = await Promise.all([
    getInvoiceActivityStats(db, params),
    getTrackerActivityStats(db, params),
    getCustomerActivityStats(db, params),
    getInboxActivityStats(db, params),
    getTransactionActivityStats(db, params),
  ]);

  return {
    invoicesSent: invoiceStats.sent,
    invoicesPaid: invoiceStats.paid,
    largestPayment: invoiceStats.largestPayment,
    hoursTracked: trackerStats.totalHours,
    unbilledHours: trackerStats.unbilledHours,
    billableAmount: trackerStats.billableAmount,
    newCustomers: customerStats.newCount,
    receiptsMatched: inboxStats.matchedCount,
    transactionsCategorized: transactionStats.categorizedCount,
  };
}
