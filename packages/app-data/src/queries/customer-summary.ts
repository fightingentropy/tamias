import type { Database } from "../client";
import { reuseQueryResult } from "../utils/request-cache";
import { getRecentCustomerActivity, getRecentCustomerCounts } from "./customer-activity-shared";

export type CustomerPageSummary = {
  mostActiveClient: {
    customerId: string;
    customerName: string;
    invoiceCount: number;
    totalTrackerTime: number;
  } | null;
  inactiveClientsCount: number;
  topRevenueClient: {
    customerId: string;
    customerName: string;
    totalRevenue: number;
    currency: string | null;
    invoiceCount: number;
  } | null;
  newCustomersCount: number;
};

async function getCustomerPageSummaryImpl(
  _db: Database,
  params: { teamId: string },
): Promise<CustomerPageSummary> {
  const { teamId } = params;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoIso = thirtyDaysAgo.toISOString();
  const trackerDateFloor = thirtyDaysAgoIso.split("T")[0] ?? "";
  const recentActivity = await getRecentCustomerActivity({
    teamId,
    sinceIso: thirtyDaysAgoIso,
    sinceDate: trackerDateFloor,
  });
  const activeCustomerIds = new Set<string>([
    ...recentActivity.invoiceCountsByCustomerId.keys(),
    ...recentActivity.trackerTimeByCustomerId.keys(),
  ]);
  const { inactiveClientsCount, newCustomersCount } = await getRecentCustomerCounts({
    teamId,
    sinceIso: thirtyDaysAgoIso,
    activeCustomerIds,
  });
  const mostActiveClient =
    [...activeCustomerIds]
      .map((customerId) => ({
        customerId,
        customerName: recentActivity.customerNameById.get(customerId) ?? "Unknown Customer",
        invoiceCount: recentActivity.invoiceCountsByCustomerId.get(customerId) ?? 0,
        totalTrackerTime: recentActivity.trackerTimeByCustomerId.get(customerId) ?? 0,
      }))
      .filter((row) => row.invoiceCount > 0 || row.totalTrackerTime > 0)
      .sort(
        (left, right) =>
          right.invoiceCount +
          right.totalTrackerTime / 3600 -
          (left.invoiceCount + left.totalTrackerTime / 3600),
      )[0] ?? null;

  const topRevenueClient =
    [...recentActivity.topRevenueByCustomerKey.values()].sort(
      (left, right) => right.totalRevenue - left.totalRevenue,
    )[0] ?? null;

  return {
    mostActiveClient,
    inactiveClientsCount,
    topRevenueClient,
    newCustomersCount,
  };
}

export const getCustomerPageSummary = reuseQueryResult({
  keyPrefix: "customer-page-summary",
  keyFn: (params: { teamId: string }) => params.teamId,
  load: getCustomerPageSummaryImpl,
});
