import { parseISO } from "date-fns";
import { getInvoiceCustomerDateAggregateRowsFromConvex } from "@tamias/app-data-convex";
import type { Database } from "../../client";
import { reuseQueryResult } from "../../utils/request-cache";
import {
  CUSTOMER_REVENUE_STATUSES,
  getCustomerNameMap,
  roundMoney,
  type GetCustomerLifetimeValueParams,
} from "./shared";

async function getCustomerLifetimeValueImpl(_db: Database, params: GetCustomerLifetimeValueParams) {
  const { teamId, currency } = params;
  const rows = await getInvoiceCustomerDateAggregateRowsFromConvex({
    teamId,
    statuses: [...CUSTOMER_REVENUE_STATUSES],
    dateField: "createdAt",
    currency: currency ?? null,
  });

  if (rows.length === 0) {
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

  const customerNames = await getCustomerNameMap(
    teamId,
    rows.map((row) => row.customerId),
  );
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

  for (const row of rows) {
    const invoiceCurrency = row.currency ?? null;
    const key = `${row.customerId}:${invoiceCurrency ?? "__null__"}`;
    const current = grouped.get(key) ?? {
      customerId: row.customerId,
      customerName: customerNames.get(row.customerId) ?? "Unknown Customer",
      totalRevenue: 0,
      invoiceCount: 0,
      firstInvoiceDate: row.date,
      lastInvoiceDate: row.date,
      currency: invoiceCurrency,
    };

    current.totalRevenue = roundMoney(current.totalRevenue + row.totalAmount);
    current.invoiceCount += row.invoiceCount;

    if (row.date < current.firstInvoiceDate) {
      current.firstInvoiceDate = row.date;
    }

    if (row.date > current.lastInvoiceDate) {
      current.lastInvoiceDate = row.date;
    }

    grouped.set(key, current);
  }

  const customerValues = [...grouped.values()];
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const customersWithMetrics = customerValues.map((customer) => {
    const lastInvoice = parseISO(customer.lastInvoiceDate);
    const firstInvoice = parseISO(customer.firstInvoiceDate);
    const lifespanMs = lastInvoice.getTime() - firstInvoice.getTime();
    const lifespanDays = Math.max(1, Math.floor(lifespanMs / (1000 * 60 * 60 * 24)));
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

  const totalRevenue = customersWithMetrics.reduce((sum, c) => sum + c.totalRevenue, 0);
  const totalCustomers = customersWithMetrics.length;
  const activeCustomers = customersWithMetrics.filter((c) => c.isActive).length;
  const averageCLV = totalRevenue / totalCustomers;

  const sortedValues = customersWithMetrics.map((c) => c.totalRevenue).sort((a, b) => a - b);
  const medianCLV =
    sortedValues.length % 2 === 0
      ? ((sortedValues[sortedValues.length / 2 - 1] ?? 0) +
          (sortedValues[sortedValues.length / 2] ?? 0)) /
        2
      : (sortedValues[Math.floor(sortedValues.length / 2)] ?? 0);

  const averageLifespanDays =
    customersWithMetrics.reduce((sum, c) => sum + c.lifespanDays, 0) / totalCustomers;

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

export const getCustomerLifetimeValue = reuseQueryResult({
  keyPrefix: "customer-lifetime-value",
  keyFn: (params: GetCustomerLifetimeValueParams) =>
    [params.teamId, params.currency ?? ""].join(":"),
  load: getCustomerLifetimeValueImpl,
});
