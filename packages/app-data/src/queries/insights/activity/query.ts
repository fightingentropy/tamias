import type { Database } from "../../../client";
import { getCustomerActivityStats } from "./customers";
import { getInboxActivityStats } from "./inbox";
import { getInvoiceActivityStats } from "./invoices";
import { getTrackerActivityStats } from "./tracker";
import { getTransactionActivityStats } from "./transactions";
import type { GetInsightActivityDataParams, InsightActivityData } from "./types";

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
