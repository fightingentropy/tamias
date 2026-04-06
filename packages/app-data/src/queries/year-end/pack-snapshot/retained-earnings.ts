import { roundCurrency } from "@tamias/compliance";
import type { ComplianceJournalEntryRecord } from "@tamias/app-data-convex";
import type { RetainedEarningsRollforward, SummaryLine } from "../types";
import { presentBalance } from "./accounts";

export function buildRetainedEarnings(
  entries: ComplianceJournalEntryRecord[],
  periodStart: string,
  periodEnd: string,
  profitAndLoss: SummaryLine[],
): RetainedEarningsRollforward {
  const retainedEntries = entries.flatMap((entry) =>
    entry.lines
      .filter((line) => line.accountCode === "3100")
      .map((line) => ({ entryDate: entry.entryDate, line })),
  );

  const openingBalance = roundCurrency(
    retainedEntries
      .filter((row) => row.entryDate < periodStart)
      .reduce(
        (total, row) =>
          total + presentBalance("equity", (row.line.debit ?? 0) - (row.line.credit ?? 0)),
        0,
      ),
  );

  const manualEquityAdjustments = roundCurrency(
    retainedEntries
      .filter((row) => row.entryDate >= periodStart && row.entryDate <= periodEnd)
      .reduce(
        (total, row) =>
          total + presentBalance("equity", (row.line.debit ?? 0) - (row.line.credit ?? 0)),
        0,
      ),
  );

  const currentPeriodProfit =
    profitAndLoss.find((line) => line.key === "profit_before_tax")?.amount ?? 0;

  return {
    openingBalance,
    currentPeriodProfit,
    manualEquityAdjustments,
    closingBalance: roundCurrency(openingBalance + currentPeriodProfit + manualEquityAdjustments),
  };
}
