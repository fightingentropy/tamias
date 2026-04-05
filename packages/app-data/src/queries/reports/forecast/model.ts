import type { ConfidenceBounds, ForecastBreakdown } from "./types";

export function calculateConfidenceBounds(
  breakdown: ForecastBreakdown,
): ConfidenceBounds {
  const optimistic =
    breakdown.recurringInvoices * 1.05 +
    breakdown.recurringTransactions * 1.1 +
    breakdown.scheduled * 1.05 +
    breakdown.collections * 1.2 +
    breakdown.billableHours * 1.15 +
    breakdown.newBusiness * 1.5;

  const pessimistic =
    breakdown.recurringInvoices * 0.95 +
    breakdown.recurringTransactions * 0.85 +
    breakdown.scheduled * 0.9 +
    breakdown.collections * 0.6 +
    breakdown.billableHours * 0.7 +
    breakdown.newBusiness * 0.4;

  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const confidence =
    total > 0
      ? (breakdown.recurringInvoices / total) * 95 +
        (breakdown.recurringTransactions / total) * 85 +
        (breakdown.scheduled / total) * 90 +
        (breakdown.collections / total) * 70 +
        (breakdown.billableHours / total) * 75 +
        (breakdown.newBusiness / total) * 35
      : 0;

  return {
    optimistic,
    pessimistic,
    confidence: Math.round(confidence),
  };
}

export function checkForOverlap(
  recurringInvoices: number,
  recurringTransactions: number,
): string | null {
  if (recurringInvoices > 500 && recurringTransactions > 500) {
    return (
      "Both recurring invoices and recurring transactions detected. " +
      "If these represent the same revenue (e.g., a retainer billed via invoice " +
      "that also shows as a recurring bank deposit), the forecast may be overstated."
    );
  }

  return null;
}
