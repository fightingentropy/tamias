import type { Transaction } from "./types";

export const mapTransactions = (
  data: Record<string, string>[],
  mappings: Record<string, string>,
  currency: string,
  teamId: string,
  bankAccountId: string,
): Transaction[] => {
  return data.map((row) => {
    const mapped = Object.fromEntries(
      Object.entries(mappings)
        .filter(([_, value]) => typeof value === "string" && value.trim().length > 0)
        .map(([key, value]) => [key, row[value]]),
    ) as Partial<Transaction>;

    return {
      ...mapped,
      currency,
      teamId,
      bankAccountId,
    } as Transaction;
  });
};
