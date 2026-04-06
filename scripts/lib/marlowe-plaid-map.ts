import { createHash } from "node:crypto";
import type { Transaction } from "../../packages/banking/src/types";
import type { UpsertTransactionInConvexInput } from "../../packages/app-data-convex/src/transaction-records";

const CONVEX_METHODS = new Set<UpsertTransactionInConvexInput["method"]>([
  "payment",
  "card_purchase",
  "card_atm",
  "transfer",
  "other",
  "unknown",
  "ach",
  "interest",
  "deposit",
  "wire",
  "fee",
]);

export function normalizeBankingMethodForConvex(
  method: string,
): UpsertTransactionInConvexInput["method"] {
  if (CONVEX_METHODS.has(method as UpsertTransactionInConvexInput["method"])) {
    return method as UpsertTransactionInConvexInput["method"];
  }

  return "other";
}

export function stablePlaidTransactionPublicId(teamId: string, plaidTransactionId: string): string {
  return createHash("sha256")
    .update(`${teamId}:${plaidTransactionId}`)
    .digest("hex")
    .slice(0, 32);
}

export function buildMarlowePlaidUpsert(args: {
  transaction: Transaction;
  teamId: string;
  bankAccountPublicId: string;
  createdAt: string;
}): UpsertTransactionInConvexInput {
  const { transaction, teamId, bankAccountPublicId, createdAt } = args;

  return {
    id: stablePlaidTransactionPublicId(teamId, transaction.id),
    createdAt,
    date: transaction.date,
    name: transaction.name,
    method: normalizeBankingMethodForConvex(transaction.method),
    amount: transaction.amount,
    currency: transaction.currency,
    internalId: `${teamId}_${transaction.id}`,
    status: transaction.status,
    balance: transaction.balance,
    manual: false,
    notified: true,
    description: transaction.description,
    categorySlug: transaction.category,
    counterpartyName: transaction.counterparty_name,
    merchantName: transaction.merchant_name,
    bankAccountId: bankAccountPublicId,
    enrichmentCompleted: false,
  };
}
