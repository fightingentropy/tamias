import {
  type TransactionMethod as ConvexTransactionMethod,
  type TransactionStatus as ConvexTransactionStatus,
  type TransactionRecord,
  type UpsertTransactionInConvexInput,
} from "../../../convex";
import type { AccountingSyncRecord } from "../../accounting-sync";
import type { TransactionFrequency } from "./types";

export const MATCHING_EXCLUDED_TRANSACTION_STATUSES: ConvexTransactionStatus[] =
  ["pending", "excluded", "completed", "archived", "exported"];

export function toConvexTransactionInput(
  row: TransactionRecord,
  overrides: Partial<TransactionRecord> = {},
): UpsertTransactionInConvexInput {
  const next = { ...row, ...overrides };

  return {
    id: next.id,
    createdAt: next.createdAt,
    date: next.date,
    name: next.name,
    method: next.method as ConvexTransactionMethod,
    amount: Number(next.amount),
    currency: next.currency,
    assignedId: next.assignedId,
    note: next.note,
    bankAccountId: next.bankAccountId,
    internalId: next.internalId,
    status: next.status as ConvexTransactionStatus,
    balance: next.balance,
    manual: next.manual ?? false,
    notified: next.notified ?? false,
    internal: next.internal ?? false,
    description: next.description,
    categorySlug: next.categorySlug,
    baseAmount: next.baseAmount,
    counterpartyName: next.counterpartyName,
    baseCurrency: next.baseCurrency,
    taxAmount: next.taxAmount,
    taxRate: next.taxRate,
    taxType: next.taxType,
    recurring: next.recurring ?? false,
    frequency: next.frequency as TransactionFrequency | null | undefined,
    merchantName: next.merchantName,
    enrichmentCompleted: next.enrichmentCompleted ?? false,
    hasAttachment: next.hasAttachment ?? false,
  };
}

function pickLatestAccountingSyncRecord(
  current: AccountingSyncRecord | undefined,
  next: AccountingSyncRecord,
) {
  if (!current) {
    return next;
  }

  return next.syncedAt.localeCompare(current.syncedAt) > 0 ? next : current;
}

export function buildAccountingSyncLookups(records: AccountingSyncRecord[]) {
  const syncedByTransactionId = new Map<string, AccountingSyncRecord>();
  const errorByTransactionId = new Map<string, AccountingSyncRecord>();

  for (const record of records) {
    if (record.status === "synced") {
      syncedByTransactionId.set(
        record.transactionId,
        pickLatestAccountingSyncRecord(
          syncedByTransactionId.get(record.transactionId),
          record,
        ),
      );
      continue;
    }

    if (record.status === "failed" || record.status === "partial") {
      errorByTransactionId.set(
        record.transactionId,
        pickLatestAccountingSyncRecord(
          errorByTransactionId.get(record.transactionId),
          record,
        ),
      );
    }
  }

  return {
    syncedByTransactionId,
    errorByTransactionId,
    syncedTransactionIds: [...syncedByTransactionId.keys()],
    errorTransactionIds: [...errorByTransactionId.keys()],
  };
}
