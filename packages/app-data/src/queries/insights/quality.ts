import {
  getBankConnectionsFromConvex,
  getInvoiceDateAggregateRowsFromConvex,
  getTransactionsFromConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../../client";
import { isDefined } from "./shared";

export const DATA_QUALITY_THRESHOLDS = {
  MIN_TRANSACTIONS: 3,
  MAX_BANK_SYNC_AGE_DAYS: 7,
  MIN_TOTAL_DATA_POINTS: 3,
} as const;

export type DataQualityResult = {
  hasSufficientData: boolean;
  skipReason?: string;
  metrics: {
    transactionCount: number;
    invoiceCount: number;
    hasBankConnection: boolean;
    lastBankSyncDate: Date | null;
    bankSyncAgeDays: number | null;
  };
};

const ALL_INVOICE_STATUSES = [
  "draft",
  "overdue",
  "paid",
  "unpaid",
  "canceled",
  "scheduled",
  "refunded",
] as const;

export async function checkInsightDataQuality(
  db: Database,
  params: {
    teamId: string;
    periodStart: string;
    periodEnd: string;
  },
): Promise<DataQualityResult> {
  const { teamId, periodStart, periodEnd } = params;
  const issueDateFrom = periodStart.slice(0, 10);
  const issueDateTo = periodEnd.slice(0, 10);

  const [transactionResult, invoiceResult, bankConnectionResult] =
    await Promise.all([
      getTransactionsFromConvex({
        teamId,
        dateGte: periodStart,
      }).then(
        (transactions) =>
          transactions.filter((transaction) => transaction.date <= periodEnd)
            .length,
      ),
      getInvoiceDateAggregateRowsFromConvex({
        teamId,
        statuses: [...ALL_INVOICE_STATUSES],
        dateField: "issueDate",
        dateFrom: issueDateFrom,
        dateTo: issueDateTo,
      }).then((rows) => rows.reduce((sum, row) => sum + row.invoiceCount, 0)),
      getBankConnectionsFromConvex({
        teamId,
        enabled: true,
      }).then(
        (connections) =>
          connections
            .filter(
              (connection) =>
                !!connection.lastAccessed && connection.bankAccounts.length > 0,
            )
            .map((connection) => connection.lastAccessed)
            .filter(isDefined)
            .sort((left, right) => right.localeCompare(left))[0] ?? null,
      ),
    ]);

  const transactionCount = transactionResult;
  const invoiceCount = invoiceResult;
  const lastBankSync = bankConnectionResult
    ? new Date(bankConnectionResult)
    : null;

  const bankSyncAgeDays = lastBankSync
    ? Math.floor((Date.now() - lastBankSync.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const metrics: DataQualityResult["metrics"] = {
    transactionCount,
    invoiceCount,
    hasBankConnection: lastBankSync !== null,
    lastBankSyncDate: lastBankSync,
    bankSyncAgeDays,
  };

  if (transactionCount < DATA_QUALITY_THRESHOLDS.MIN_TRANSACTIONS) {
    const totalDataPoints = transactionCount + invoiceCount;
    if (totalDataPoints < DATA_QUALITY_THRESHOLDS.MIN_TOTAL_DATA_POINTS) {
      return {
        hasSufficientData: false,
        skipReason: `Insufficient data: only ${transactionCount} transactions and ${invoiceCount} invoices in period (minimum ${DATA_QUALITY_THRESHOLDS.MIN_TOTAL_DATA_POINTS} data points required)`,
        metrics,
      };
    }
  }

  if (lastBankSync && bankSyncAgeDays !== null) {
    if (bankSyncAgeDays > DATA_QUALITY_THRESHOLDS.MAX_BANK_SYNC_AGE_DAYS) {
      return {
        hasSufficientData: false,
        skipReason: `Stale bank data: last sync was ${bankSyncAgeDays} days ago (maximum ${DATA_QUALITY_THRESHOLDS.MAX_BANK_SYNC_AGE_DAYS} days allowed)`,
        metrics,
      };
    }
  }

  if (!lastBankSync && invoiceCount === 0 && transactionCount === 0) {
    return {
      hasSufficientData: false,
      skipReason: "No bank connection and no activity in period",
      metrics,
    };
  }

  return {
    hasSufficientData: true,
    metrics,
  };
}
