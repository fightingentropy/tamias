import {
  getTransactionsByIdsFromConvex,
  upsertTransactionsInConvex,
} from "../../../convex";
import type { Database } from "../../../client";
import { toConvexTransactionInput } from "../shared";

export type UpsertTransactionData = {
  name: string;
  date: string;
  method: "other" | "card_purchase" | "transfer";
  amount: number;
  currency: string;
  teamId: string;
  bankAccountId: string | null;
  internalId: string;
  status: "pending" | "completed" | "archived" | "posted" | "excluded";
  manual: boolean;
  categorySlug?: string | null;
  description?: string | null;
  balance?: number | null;
  note?: string | null;
  counterpartyName?: string | null;
  merchantName?: string | null;
  assignedId?: string | null;
  internal?: boolean;
  notified?: boolean;
  baseAmount?: number | null;
  baseCurrency?: string | null;
  taxAmount?: number | null;
  taxRate?: number | null;
  taxType?: string | null;
  recurring?: boolean;
  frequency?:
    | "weekly"
    | "biweekly"
    | "monthly"
    | "semi_monthly"
    | "annually"
    | "irregular"
    | "unknown"
    | null;
  enrichmentCompleted?: boolean;
};

export type UpsertTransactionsParams = {
  transactions: UpsertTransactionData[];
  teamId: string;
};

export type BulkUpdateTransactionsBaseCurrencyParams = {
  transactions: Array<{
    id: string;
    baseAmount: number;
    baseCurrency: string;
  }>;
  teamId: string;
};

function buildUpsertTransactionInput(transaction: UpsertTransactionData) {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    date: transaction.date,
    name: transaction.name,
    method: transaction.method,
    amount: transaction.amount,
    currency: transaction.currency,
    assignedId: transaction.assignedId ?? null,
    note: transaction.note ?? null,
    bankAccountId: transaction.bankAccountId ?? null,
    internalId: transaction.internalId,
    status: transaction.status,
    balance: transaction.balance ?? null,
    manual: transaction.manual,
    notified: transaction.notified ?? false,
    internal: transaction.internal ?? false,
    description: transaction.description ?? null,
    categorySlug: transaction.categorySlug ?? null,
    baseAmount: transaction.baseAmount ?? null,
    counterpartyName: transaction.counterpartyName ?? null,
    baseCurrency: transaction.baseCurrency ?? null,
    taxAmount: transaction.taxAmount ?? null,
    taxRate: transaction.taxRate ?? null,
    taxType: transaction.taxType ?? null,
    recurring: transaction.recurring ?? false,
    frequency: transaction.frequency ?? null,
    merchantName: transaction.merchantName ?? null,
    enrichmentCompleted: transaction.enrichmentCompleted ?? false,
  };
}

export async function upsertTransactions(
  _db: Database,
  params: UpsertTransactionsParams,
): Promise<Array<{ id: string }>> {
  if (params.transactions.length === 0) {
    return [];
  }

  const upserted = await upsertTransactionsInConvex({
    teamId: params.teamId,
    transactions: params.transactions.map((transaction) =>
      buildUpsertTransactionInput(transaction),
    ),
  });

  return upserted.map((transaction) => ({ id: transaction.id }));
}

export async function bulkUpdateTransactionsBaseCurrency(
  _db: Database,
  params: BulkUpdateTransactionsBaseCurrencyParams,
) {
  const { transactions: transactionsData, teamId } = params;

  if (!teamId?.trim()) {
    throw new Error("bulkUpdateTransactionsBaseCurrency: teamId is required");
  }

  if (transactionsData.length === 0) {
    return;
  }

  const currentTransactions = await getTransactionsByIdsFromConvex({
    teamId,
    transactionIds: transactionsData.map((transaction) => transaction.id),
  });
  const updatesById = new Map(
    transactionsData.map((transaction) => [transaction.id, transaction]),
  );

  await upsertTransactionsInConvex({
    teamId,
    transactions: currentTransactions.map((transaction) =>
      toConvexTransactionInput(transaction, {
        baseAmount:
          updatesById.get(transaction.id)?.baseAmount ?? transaction.baseAmount,
        baseCurrency:
          updatesById.get(transaction.id)?.baseCurrency ??
          transaction.baseCurrency,
      }),
    ),
  });
}
