import { createHash } from "node:crypto";
import { capitalCase } from "change-case";
import type { Transaction } from "./types";
import { formatAmountValue, formatDate } from "./utils";

function normalizeFingerprintValue(value?: string) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function buildDeterministicInternalId({
  transaction,
  normalizedDescription,
  normalizedCounterparty,
  formattedDate,
  formattedAmount,
}: {
  transaction: Transaction;
  normalizedDescription?: string;
  normalizedCounterparty?: string;
  formattedDate?: string;
  formattedAmount: number;
}) {
  const fingerprintParts = [
    normalizeFingerprintValue(transaction.bankAccountId),
    normalizeFingerprintValue(formattedDate),
    String(formattedAmount),
    normalizeFingerprintValue(transaction.currency.toUpperCase()),
    normalizeFingerprintValue(normalizedDescription),
    normalizeFingerprintValue(normalizedCounterparty),
  ];

  if (transaction.duplicateIndex != null) {
    fingerprintParts.push(String(transaction.duplicateIndex));
  }

  const fingerprint = fingerprintParts.join("|");

  const hash = createHash("sha256").update(fingerprint).digest("hex").slice(0, 24);

  return `${transaction.teamId}_${hash}`;
}

function buildDuplicateFingerprint({
  transaction,
  inverted,
}: {
  transaction: Transaction;
  inverted: boolean;
}) {
  const normalizedDescription = transaction.description?.trim();
  const normalizedCounterparty = transaction.counterparty?.trim();
  const formattedDate = formatDate(transaction.date);
  const formattedAmount = formatAmountValue({
    amount: transaction.amount,
    inverted,
  });

  return [
    normalizeFingerprintValue(transaction.bankAccountId),
    normalizeFingerprintValue(formattedDate),
    String(formattedAmount),
    normalizeFingerprintValue(transaction.currency.toUpperCase()),
    normalizeFingerprintValue(normalizedDescription),
    normalizeFingerprintValue(normalizedCounterparty),
  ].join("|");
}

export function addDuplicateDisambiguators({
  transactions,
  inverted,
}: {
  transactions: Transaction[];
  inverted: boolean;
}): Transaction[] {
  const counts = new Map<string, number>();

  for (const transaction of transactions) {
    const fingerprint = buildDuplicateFingerprint({ transaction, inverted });
    counts.set(fingerprint, (counts.get(fingerprint) ?? 0) + 1);
  }

  const seen = new Map<string, number>();

  return transactions.map((transaction) => {
    const fingerprint = buildDuplicateFingerprint({ transaction, inverted });
    const occurrence = (seen.get(fingerprint) ?? 0) + 1;
    seen.set(fingerprint, occurrence);

    if ((counts.get(fingerprint) ?? 0) <= 1 || occurrence === 1) {
      return transaction;
    }

    return {
      ...transaction,
      duplicateIndex: occurrence,
    };
  });
}

export function transform({
  transaction,
  inverted,
}: {
  transaction: Transaction;
  inverted: boolean;
}) {
  const normalizedDescription = transaction.description?.trim();
  const normalizedCounterparty = transaction.counterparty?.trim();
  const formattedDate = formatDate(transaction.date);
  const formattedAmount = formatAmountValue({
    amount: transaction.amount,
    inverted,
  });

  return {
    internal_id: buildDeterministicInternalId({
      transaction,
      normalizedDescription,
      normalizedCounterparty,
      formattedDate,
      formattedAmount,
    }),
    team_id: transaction.teamId,
    status: "posted",
    method: "other",
    date: formattedDate,
    amount: formattedAmount,
    name: capitalCase(normalizedDescription || normalizedCounterparty || "Transaction"),
    counterparty_name: normalizedCounterparty ? capitalCase(normalizedCounterparty) : null,
    manual: true,
    category_slug:
      formatAmountValue({ amount: transaction.amount, inverted }) > 0 ? "income" : null,
    bank_account_id: transaction.bankAccountId,
    currency: transaction.currency.toUpperCase(),
    notified: true,
  };
}
