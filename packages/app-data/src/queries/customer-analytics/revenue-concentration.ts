import { getInvoiceCustomerDateAggregateRowsFromConvex } from "@tamias/app-data-convex";
import type { Database } from "../../client";
import { reuseQueryResult } from "../../utils/request-cache";
import { normalizeTimestampBoundary } from "../date-boundaries";
import {
  getCustomerNameMap,
  roundMoney,
  type GetRevenueConcentrationParams,
  type RevenueConcentration,
} from "./shared";

async function getRevenueConcentrationImpl(
  _db: Database,
  params: GetRevenueConcentrationParams,
): Promise<RevenueConcentration> {
  const { teamId, from, to, currency } = params;
  const rows = await getInvoiceCustomerDateAggregateRowsFromConvex({
    teamId,
    statuses: ["paid"],
    dateField: "paidAt",
    dateFrom: normalizeTimestampBoundary(from, "start"),
    dateTo: normalizeTimestampBoundary(to, "end"),
    currency,
  });

  if (rows.length === 0) {
    return {
      topCustomer: null,
      totalRevenue: 0,
      customerCount: 0,
      isConcentrated: false,
      currency,
    };
  }

  const customerNames = await getCustomerNameMap(
    teamId,
    rows.map((row) => row.customerId),
  );
  const customerRevenueMap = new Map<
    string,
    { customerId: string; customerName: string; revenue: number }
  >();

  for (const row of rows) {
    const current = customerRevenueMap.get(row.customerId) ?? {
      customerId: row.customerId,
      customerName: customerNames.get(row.customerId) ?? "Unknown Customer",
      revenue: 0,
    };

    current.revenue = roundMoney(current.revenue + row.totalAmount);
    customerRevenueMap.set(row.customerId, current);
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

export const getRevenueConcentration = reuseQueryResult({
  keyPrefix: "revenue-concentration",
  keyFn: (params: GetRevenueConcentrationParams) =>
    [params.teamId, params.from, params.to, params.currency].join(":"),
  load: getRevenueConcentrationImpl,
});
