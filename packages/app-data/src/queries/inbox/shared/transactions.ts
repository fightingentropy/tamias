import {
  getTransactionByIdFromConvex,
  getTransactionsByIdsFromConvex,
  upsertTransactionsInConvex,
  type TransactionRecord,
} from "@tamias/app-data-convex";
import { toUpsertTransaction } from "./serialization";

export type InboxTransactionSummary = Pick<
  TransactionRecord,
  "id" | "amount" | "currency" | "name" | "date"
>;

export function buildInboxTransactionSummary(
  transaction: TransactionRecord | null,
): InboxTransactionSummary | null {
  if (!transaction) {
    return null;
  }

  return {
    id: transaction.id,
    amount: transaction.amount,
    currency: transaction.currency,
    name: transaction.name,
    date: transaction.date,
  };
}

export async function getInboxTransactionMap(
  teamId: string,
  transactionIds: Array<string | null | undefined>,
) {
  const uniqueIds = [...new Set(transactionIds.filter(Boolean))] as string[];

  if (uniqueIds.length === 0) {
    return new Map<string, InboxTransactionSummary>();
  }

  const transactions = await getTransactionsByIdsFromConvex({
    teamId,
    transactionIds: uniqueIds,
  });

  return new Map(
    transactions.map((transaction) => [
      transaction.id,
      buildInboxTransactionSummary(transaction)!,
    ]),
  );
}

export async function patchTransactionFields(
  teamId: string,
  transactionId: string,
  overrides: Partial<TransactionRecord>,
) {
  const current = await getTransactionByIdFromConvex({
    teamId,
    transactionId,
  });

  if (!current) {
    throw new Error("Transaction not found or belongs to another team");
  }

  await upsertTransactionsInConvex({
    teamId,
    transactions: [toUpsertTransaction(current, overrides)],
  });
}
