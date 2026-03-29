import { parseISO } from "date-fns";
import type { Database } from "../client";
import {
  getProjectedInvoicesByFilters,
  type ProjectedInvoiceRecord,
} from "./index";
import { getCustomerPageSummary } from "./customer-summary";

const REVENUE_INVOICE_STATUSES = new Set<string>(["paid", "unpaid", "overdue"]);

function getProjectedCustomerName(invoice: ProjectedInvoiceRecord) {
  return invoice.customer.name ?? invoice.customerName ?? "Unknown Customer";
}

function hasStringValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * Revenue concentration data for a period
 */
export type RevenueConcentration = {
  topCustomer: {
    id: string;
    name: string;
    revenue: number;
    percentage: number;
  } | null;
  totalRevenue: number;
  customerCount: number;
  isConcentrated: boolean; // >50% from one customer
  currency: string;
};

export type GetRevenueConcentrationParams = {
  teamId: string;
  from: string;
  to: string;
  currency: string;
};

/**
 * Calculate revenue concentration for a period.
 * Returns the top customer and their share of total revenue.
 * Warns if a single customer accounts for >50% of revenue.
 */
export async function getRevenueConcentration(
  _db: Database,
  params: GetRevenueConcentrationParams,
): Promise<RevenueConcentration> {
  const { teamId, from, to, currency } = params;
  const customerRevenueMap = new Map<
    string,
    { customerId: string; customerName: string; revenue: number }
  >();

  for (const invoice of await getProjectedInvoicesByFilters({
    teamId,
    statuses: ["paid"],
    currency,
    dateField: "paidAt",
    from,
    to,
  })) {
    if (
      !hasStringValue(invoice.customerId) ||
      !hasStringValue(invoice.paidAt)
    ) {
      continue;
    }

    const current = customerRevenueMap.get(invoice.customerId) ?? {
      customerId: invoice.customerId,
      customerName: getProjectedCustomerName(invoice),
      revenue: 0,
    };

    current.revenue += Number(invoice.amount) || 0;
    customerRevenueMap.set(invoice.customerId, current);
  }

  const customerRevenue = [...customerRevenueMap.values()].sort(
    (left, right) => right.revenue - left.revenue,
  );

  if (customerRevenue.length === 0) {
    return {
      topCustomer: null,
      totalRevenue: 0,
      customerCount: 0,
      isConcentrated: false,
      currency,
    };
  }

  const totalRevenue = customerRevenue.reduce((sum, c) => sum + c.revenue, 0);
  const topCustomerData = customerRevenue[0];

  if (!topCustomerData) {
    return {
      topCustomer: null,
      totalRevenue,
      customerCount: customerRevenue.length,
      isConcentrated: false,
      currency,
    };
  }

  const topCustomerPercentage = (topCustomerData.revenue / totalRevenue) * 100;

  return {
    topCustomer: {
      id: topCustomerData.customerId,
      name: topCustomerData.customerName,
      revenue: topCustomerData.revenue,
      percentage: Math.round(topCustomerPercentage),
    },
    totalRevenue,
    customerCount: customerRevenue.length,
    isConcentrated: topCustomerPercentage > 50,
    currency,
  };
}

export type GetTopRevenueClientParams = {
  teamId: string;
};

export async function getTopRevenueClient(
  _db: Database,
  params: GetTopRevenueClientParams,
) {
  return (await getCustomerPageSummary(_db, params)).topRevenueClient;
}

export type GetNewCustomersCountParams = {
  teamId: string;
};

export async function getNewCustomersCount(
  _db: Database,
  params: GetNewCustomersCountParams,
) {
  return (await getCustomerPageSummary(_db, params)).newCustomersCount;
}

export type GetCustomerLifetimeValueParams = {
  teamId: string;
  currency?: string;
};

export async function getCustomerLifetimeValue(
  _db: Database,
  params: GetCustomerLifetimeValueParams,
) {
  const { teamId, currency } = params;
  const grouped = new Map<
    string,
    {
      customerId: string;
      customerName: string;
      totalRevenue: number;
      invoiceCount: number;
      firstInvoiceDate: string;
      lastInvoiceDate: string;
      currency: string | null;
    }
  >();

  for (const invoice of await getProjectedInvoicesByFilters({
    teamId,
    statuses: ["paid", "unpaid", "overdue"],
    currency,
  })) {
    if (
      !hasStringValue(invoice.customerId) ||
      !REVENUE_INVOICE_STATUSES.has(invoice.status)
    ) {
      continue;
    }

    const invoiceCurrency = invoice.currency ?? null;

    if (currency && invoiceCurrency !== currency) {
      continue;
    }

    const key = `${invoice.customerId}:${invoiceCurrency ?? "__null__"}`;
    const current = grouped.get(key) ?? {
      customerId: invoice.customerId,
      customerName: getProjectedCustomerName(invoice),
      totalRevenue: 0,
      invoiceCount: 0,
      firstInvoiceDate: invoice.createdAt,
      lastInvoiceDate: invoice.createdAt,
      currency: invoiceCurrency,
    };

    current.totalRevenue += Number(invoice.amount) || 0;
    current.invoiceCount += 1;

    if (invoice.createdAt < current.firstInvoiceDate) {
      current.firstInvoiceDate = invoice.createdAt;
    }

    if (invoice.createdAt > current.lastInvoiceDate) {
      current.lastInvoiceDate = invoice.createdAt;
    }

    grouped.set(key, current);
  }

  const customerValues = [...grouped.values()];

  if (customerValues.length === 0) {
    return {
      summary: {
        averageCLV: 0,
        medianCLV: 0,
        totalCustomers: 0,
        activeCustomers: 0,
        averageLifespanDays: 0,
        currency: currency || "USD",
      },
      topCustomers: [],
      meta: {
        type: "customer_lifetime_value",
        currency: currency || "USD",
      },
    };
  }

  // Calculate customer lifespans and active status
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const customersWithMetrics = customerValues.map((customer) => {
    const lastInvoice = parseISO(customer.lastInvoiceDate);
    const firstInvoice = parseISO(customer.firstInvoiceDate);

    // Calculate lifespan (from first invoice to last invoice or now)
    const lifespanMs = lastInvoice.getTime() - firstInvoice.getTime();
    const lifespanDays = Math.max(
      1,
      Math.floor(lifespanMs / (1000 * 60 * 60 * 24)),
    );

    // Is customer active? (invoice in last 30 days)
    const isActive = lastInvoice >= thirtyDaysAgo;

    return {
      customerId: customer.customerId,
      customerName: customer.customerName,
      totalRevenue: customer.totalRevenue,
      invoiceCount: customer.invoiceCount,
      lifespanDays,
      isActive,
      currency: customer.currency || currency || "USD",
    };
  });

  // Calculate summary statistics
  const totalRevenue = customersWithMetrics.reduce(
    (sum, c) => sum + c.totalRevenue,
    0,
  );
  const totalCustomers = customersWithMetrics.length;
  const activeCustomers = customersWithMetrics.filter((c) => c.isActive).length;

  const averageCLV = totalRevenue / totalCustomers;

  // Calculate median CLV
  const sortedValues = customersWithMetrics
    .map((c) => c.totalRevenue)
    .sort((a, b) => a - b);
  const medianCLV =
    sortedValues.length % 2 === 0
      ? ((sortedValues[sortedValues.length / 2 - 1] ?? 0) +
          (sortedValues[sortedValues.length / 2] ?? 0)) /
        2
      : (sortedValues[Math.floor(sortedValues.length / 2)] ?? 0);

  // Average lifespan
  const averageLifespanDays =
    customersWithMetrics.reduce((sum, c) => sum + c.lifespanDays, 0) /
    totalCustomers;

  // Get top 5 customers by CLV
  const topCustomers = customersWithMetrics
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5)
    .map((c) => ({
      customerId: c.customerId,
      customerName: c.customerName,
      lifetimeValue: Number(c.totalRevenue.toFixed(2)),
      invoiceCount: c.invoiceCount,
      lifespanDays: c.lifespanDays,
      isActive: c.isActive,
      currency: c.currency,
    }));

  const mainCurrency = customerValues[0]?.currency || currency || "USD";

  return {
    summary: {
      averageCLV: Number(averageCLV.toFixed(2)),
      medianCLV: Number((medianCLV ?? 0).toFixed(2)),
      totalCustomers,
      activeCustomers,
      averageLifespanDays: Math.round(averageLifespanDays),
      currency: mainCurrency,
    },
    topCustomers,
    meta: {
      type: "customer_lifetime_value",
      currency: mainCurrency,
    },
  };
}
