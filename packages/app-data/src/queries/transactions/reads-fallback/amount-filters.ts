import type { GetTransactionsParams } from "../reads-shared";

type NormalizedAmountRange = {
  min: number;
  max: number;
} | null;

type ParsedAmountFilter = {
  operator: "gte" | "lte";
  value: number;
} | null;

export function normalizeAmountRange(
  amountRange: GetTransactionsParams["amountRange"],
): NormalizedAmountRange {
  if (
    !amountRange ||
    amountRange.length !== 2 ||
    amountRange[0] == null ||
    amountRange[1] == null
  ) {
    return null;
  }

  let min = Number(amountRange[0]);
  let max = Number(amountRange[1]);

  if (Number.isNaN(min) || Number.isNaN(max)) {
    return null;
  }

  if (min > max) {
    [min, max] = [max, min];
  }

  return { min, max };
}

export function parseAmountFilter(
  amount: GetTransactionsParams["amount"],
): ParsedAmountFilter {
  if (!amount || amount.length !== 2) {
    return null;
  }

  const [operator, rawValue] = amount;

  if (operator !== "gte" && operator !== "lte") {
    return null;
  }

  const value = Number(rawValue);

  if (Number.isNaN(value)) {
    return null;
  }

  return {
    operator,
    value,
  };
}
