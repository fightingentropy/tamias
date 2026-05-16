import type { Database } from "../../../client";
import {
  getTransactionByIdFromD1,
  getTransactionsByIdsFromD1,
  requireTransactionsD1,
  upsertTransactionsInD1,
} from "../../transactions/d1";
import type { TransactionRecord } from "../../transactions/shared";
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
  db: Database,
  teamId: string,
  transactionIds: Array<string | null | undefined>,
) {
  const uniqueIds = [...new Set(transactionIds.filter(Boolean))] as string[];

  if (uniqueIds.length === 0) {
    return new Map<string, InboxTransactionSummary>();
  }

  const transactions = await getTransactionsByIdsFromD1(requireTransactionsD1(db), {
    teamId,
    transactionIds: uniqueIds,
  });

  return new Map(
    transactions.map((transaction) => [transaction.id, buildInboxTransactionSummary(transaction)!]),
  );
}

export async function patchTransactionFields(
  db: Database,
  teamId: string,
  transactionId: string,
  overrides: Partial<TransactionRecord>,
) {
  const current = await getTransactionByIdFromD1(requireTransactionsD1(db), {
    teamId,
    transactionId,
  });

  if (!current) {
    throw new Error("Transaction not found or belongs to another team");
  }

  await upsertTransactionsInD1(requireTransactionsD1(db), {
    teamId,
    transactions: [toUpsertTransaction(current, overrides)],
  });
}
