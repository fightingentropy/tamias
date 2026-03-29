import {
  getCustomersByIdsFromConvex,
  getCustomersPageFromConvex,
  getTrackerEntriesByRangeFromConvex,
  getTrackerProjectsByIdsFromConvex,
} from "@tamias/app-data-convex";
import {
  getProjectedInvoicesByFilters,
  type ProjectedInvoiceRecord,
} from "./invoice-projections";
import { normalizeTimestampBoundary } from "./date-boundaries";

const RECENT_REVENUE_INVOICE_STATUSES = new Set<string>([
  "paid",
  "unpaid",
  "overdue",
]);
const CUSTOMER_COUNT_PAGE_SIZE = 200;
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

function getProjectedCustomerName(invoice: ProjectedInvoiceRecord) {
  return invoice.customer.name ?? invoice.customerName ?? "Unknown Customer";
}

function hasStringValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

export async function getRecentCustomerActivity(args: {
  teamId: string;
  sinceIso: string;
  sinceDate: string;
}): Promise<RecentCustomerActivity> {
  const [recentInvoices, trackerEntries] = await Promise.all([
    getProjectedInvoicesByFilters({
      teamId: args.teamId,
      dateField: "createdAt",
      from: args.sinceIso,
    }),
    getTrackerEntriesByRangeFromConvex({
      teamId: args.teamId,
      from: args.sinceDate,
      to: MAX_TRACKER_ENTRY_DATE,
    }),
  ]);

  const invoiceCountsByCustomerId = new Map<string, number>();
  const topRevenueByCustomerKey = new Map<string, CustomerRevenueSummary>();
  const customerNameById = new Map<string, string>();

  for (const invoice of recentInvoices) {
    if (!hasStringValue(invoice.customerId)) {
      continue;
    }

    customerNameById.set(
      invoice.customerId,
      getProjectedCustomerName(invoice),
    );
    invoiceCountsByCustomerId.set(
      invoice.customerId,
      (invoiceCountsByCustomerId.get(invoice.customerId) ?? 0) + 1,
    );

    if (!RECENT_REVENUE_INVOICE_STATUSES.has(invoice.status)) {
      continue;
    }

    const currency = invoice.currency ?? null;
    const key = `${invoice.customerId}:${currency ?? "__null__"}`;
    const current = topRevenueByCustomerKey.get(key) ?? {
      customerId: invoice.customerId,
      customerName: getProjectedCustomerName(invoice),
      totalRevenue: 0,
      currency,
      invoiceCount: 0,
    };

    current.totalRevenue += Number(invoice.amount) || 0;
    current.invoiceCount += 1;
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
      ? await getTrackerProjectsByIdsFromConvex({
          teamId: args.teamId,
          projectIds,
        })
      : [];
  const trackerProjectCustomerById = new Map(
    trackerProjects.flatMap((project) =>
      hasStringValue(project.customerId)
        ? [[project.id, project.customerId]]
        : [],
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

  const missingCustomerIds = [
    ...new Set(
      [...invoiceCountsByCustomerId.keys(), ...trackerTimeByCustomerId.keys()].filter(
        (customerId) => !customerNameById.has(customerId),
      ),
    ),
  ];

  if (missingCustomerIds.length > 0) {
    const customers = await getCustomersByIdsFromConvex({
      teamId: args.teamId,
      customerIds: missingCustomerIds,
    });

    for (const customer of customers) {
      customerNameById.set(customer.id, customer.name);
    }
  }

  return {
    invoiceCountsByCustomerId,
    trackerTimeByCustomerId,
    topRevenueByCustomerKey,
    customerNameById,
  };
}

export async function getRecentCustomerCounts(args: {
  teamId: string;
  sinceIso: string;
  activeCustomerIds: ReadonlySet<string>;
}) {
  let cursor: string | null = null;
  let newCustomersCount = 0;
  let inactiveClientsCount = 0;

  while (true) {
    const page = await getCustomersPageFromConvex({
      teamId: args.teamId,
      cursor,
      pageSize: CUSTOMER_COUNT_PAGE_SIZE,
      order: "desc",
    });

    for (const customer of page.page) {
      if (customer.createdAt >= args.sinceIso) {
        newCustomersCount += 1;
        continue;
      }

      if (!args.activeCustomerIds.has(customer.id)) {
        inactiveClientsCount += 1;
      }
    }

    if (page.isDone) {
      break;
    }

    cursor = page.continueCursor;
  }

  return {
    newCustomersCount,
    inactiveClientsCount,
  };
}

export async function countCustomersCreatedBetween(args: {
  teamId: string;
  from: string;
  to: string;
}) {
  const fromBoundary = normalizeTimestampBoundary(args.from, "start");
  const toBoundary = normalizeTimestampBoundary(args.to, "end");
  let cursor: string | null = null;
  let count = 0;

  while (true) {
    const page = await getCustomersPageFromConvex({
      teamId: args.teamId,
      cursor,
      pageSize: CUSTOMER_COUNT_PAGE_SIZE,
      order: "desc",
    });

    for (const customer of page.page) {
      if (customer.createdAt > toBoundary) {
        continue;
      }

      if (customer.createdAt < fromBoundary) {
        return count;
      }

      count += 1;
    }

    if (page.isDone) {
      return count;
    }

    cursor = page.continueCursor;
  }
}
