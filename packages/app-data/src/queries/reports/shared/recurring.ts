import type { RecurringFrequency } from "./types";

export function normalizeRecurringFrequency(
  frequency: string | null | undefined,
): RecurringFrequency {
  switch (frequency) {
    case "weekly":
    case "biweekly":
    case "monthly":
    case "semi_monthly":
    case "annually":
      return frequency;
    default:
      return "irregular";
  }
}

export function getRecurringMonthlyEquivalent(
  amount: number,
  frequency: string | null | undefined,
) {
  switch (normalizeRecurringFrequency(frequency)) {
    case "weekly":
      return amount * 4.33;
    case "biweekly":
      return amount * 2.17;
    case "semi_monthly":
      return amount * 2;
    case "annually":
      return amount / 12;
    default:
      return amount;
  }
}
