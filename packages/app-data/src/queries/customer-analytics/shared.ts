import { getCustomersByIdsFromConvex } from "../../convex";

export const CUSTOMER_REVENUE_STATUSES = ["paid", "unpaid", "overdue"] as const;

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export async function getCustomerNameMap(teamId: string, customerIds: string[]) {
  if (customerIds.length === 0) {
    return new Map<string, string>();
  }

  const customers = await getCustomersByIdsFromConvex({
    teamId,
    customerIds: [...new Set(customerIds)],
  });

  return new Map(customers.map((customer) => [customer.id, customer.name]));
}

export type RevenueConcentration = {
  topCustomer: {
    id: string;
    name: string;
    revenue: number;
    percentage: number;
  } | null;
  totalRevenue: number;
  customerCount: number;
  isConcentrated: boolean;
  currency: string;
};

export type GetRevenueConcentrationParams = {
  teamId: string;
  from: string;
  to: string;
  currency: string;
};

export type GetTopRevenueClientParams = {
  teamId: string;
};

export type GetNewCustomersCountParams = {
  teamId: string;
};

export type GetCustomerLifetimeValueParams = {
  teamId: string;
  currency?: string;
};
