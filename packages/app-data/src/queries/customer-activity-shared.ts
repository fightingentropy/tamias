import type { Database } from "../client";
import {
  countCustomersCreatedBetweenFromD1,
  getCustomersByIdsFromD1,
  getRecentCustomerCountsFromD1,
  requireCustomersD1,
} from "./customers/d1";
import { normalizeTimestampBoundary } from "./date-boundaries";
import { getInvoiceCustomerDateAggregateRowsFromD1 } from "./reports/shared/aggregates";
import { getTrackerEntriesByRangeFromD1, requireTrackerEntriesD1 } from "./tracker-entries/d1";
import { getTrackerProjectsByIdsFromD1, requireTrackerProjectsD1 } from "./tracker-projects/d1";

const ALL_INVOICE_STATUSES = [
  "draft",
  "overdue",
  "paid",
  "unpaid",
  "canceled",
  "scheduled",
  "refunded",
] as const;
const RECENT_REVENUE_INVOICE_STATUSES = new Set<string>(["paid", "unpaid", "overdue"]);
const MAX_TRACKER_ENTRY_DATE = "9999-12-31";

export type CustomerRevenueSummary = {
  customerId: string;
  customerName: string;
  totalRevenue: number;
  currency: string | null;
  invoiceCount: number;
};

export type RecentCustomerActivity = {
  invoiceCountsByCustomerId: Map<string, number>;
  trackerTimeByCustomerId: Map<string, number>;
  topRevenueByCustomerKey: Map<string, CustomerRevenueSummary>;
  customerNameById: Map<string, string>;
};

function hasStringValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

export async function getRecentCustomerActivity(args: {
  db: Database;
  teamId: string;
  sinceIso: string;
  sinceDate: string;
}): Promise<RecentCustomerActivity> {
  const [recentInvoiceRows, trackerEntries] = await Promise.all([
    getInvoiceCustomerDateAggregateRowsFromD1(args.db, {
      teamId: args.teamId,
      statuses: [...ALL_INVOICE_STATUSES],
      dateField: "createdAt",
      dateFrom: args.sinceIso,
    }),
    getTrackerEntriesByRangeFromD1(requireTrackerEntriesD1(args.db), {
      teamId: args.teamId,
      from: args.sinceDate,
      to: MAX_TRACKER_ENTRY_DATE,
    }),
  ]);

  const invoiceCountsByCustomerId = new Map<string, number>();
  const topRevenueByCustomerKey = new Map<string, Omit<CustomerRevenueSummary, "customerName">>();

  for (const row of recentInvoiceRows) {
    invoiceCountsByCustomerId.set(
      row.customerId,
      (invoiceCountsByCustomerId.get(row.customerId) ?? 0) + row.invoiceCount,
    );

    if (!RECENT_REVENUE_INVOICE_STATUSES.has(row.status)) {
      continue;
    }

    const currency = row.currency ?? null;
    const key = `${row.customerId}:${currency ?? "__null__"}`;
    const current = topRevenueByCustomerKey.get(key) ?? {
      customerId: row.customerId,
      totalRevenue: 0,
      currency,
      invoiceCount: 0,
    };

    current.totalRevenue += row.totalAmount;
    current.invoiceCount += row.invoiceCount;
    topRevenueByCustomerKey.set(key, current);
  }

  const projectIds = [
    ...new Set(
      trackerEntries
        .map((entry) => entry.projectId)
        .filter((projectId): projectId is string => hasStringValue(projectId)),
    ),
  ];
  const trackerProjects =
    projectIds.length > 0
      ? await getTrackerProjectsByIdsFromD1(requireTrackerProjectsD1(args.db), {
          teamId: args.teamId,
          projectIds,
        })
      : [];
  const trackerProjectCustomerById = new Map(
    trackerProjects.flatMap((project) =>
      hasStringValue(project.customerId) ? [[project.id, project.customerId]] : [],
    ),
  );
  const trackerTimeByCustomerId = new Map<string, number>();

  for (const entry of trackerEntries) {
    if (!hasStringValue(entry.projectId)) {
      continue;
    }

    const customerId = trackerProjectCustomerById.get(entry.projectId);

    if (!customerId) {
      continue;
    }

    trackerTimeByCustomerId.set(
      customerId,
      (trackerTimeByCustomerId.get(customerId) ?? 0) + (entry.duration ?? 0),
    );
  }

  const customerNameById = new Map<string, string>();
  const customerIds = [
    ...new Set([
      ...invoiceCountsByCustomerId.keys(),
      ...trackerTimeByCustomerId.keys(),
      ...[...topRevenueByCustomerKey.values()].map((row) => row.customerId),
    ]),
  ];

  if (customerIds.length > 0) {
    const customers = await getCustomersByIdsFromD1(requireCustomersD1(args.db), {
      teamId: args.teamId,
      customerIds,
    });

    for (const customer of customers) {
      customerNameById.set(customer.id, customer.name);
    }
  }

  return {
    invoiceCountsByCustomerId,
    trackerTimeByCustomerId,
    topRevenueByCustomerKey: new Map(
      [...topRevenueByCustomerKey.entries()].map(([key, row]) => [
        key,
        {
          ...row,
          customerName: customerNameById.get(row.customerId) ?? "Unknown Customer",
        },
      ]),
    ),
    customerNameById,
  };
}

export async function getRecentCustomerCounts(args: {
  db: Database;
  teamId: string;
  sinceIso: string;
  activeCustomerIds: ReadonlySet<string>;
}) {
  return getRecentCustomerCountsFromD1(requireCustomersD1(args.db), args);
}

export async function countCustomersCreatedBetween(args: {
  db: Database;
  teamId: string;
  from: string;
  to: string;
}) {
  const fromBoundary = normalizeTimestampBoundary(args.from, "start");
  const toBoundary = normalizeTimestampBoundary(args.to, "end");

  return countCustomersCreatedBetweenFromD1(requireCustomersD1(args.db), {
    teamId: args.teamId,
    from: fromBoundary,
    to: toBoundary,
  });
}
