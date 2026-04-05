import { roundCurrency } from "@tamias/compliance";
import type { ComplianceJournalLineRecord } from "../../../convex";

export function validateBalancedLines(
  lines: Array<
    Pick<ComplianceJournalLineRecord, "accountCode" | "debit" | "credit">
  >,
) {
  if (lines.length < 2) {
    throw new Error("At least two journal lines are required");
  }

  const totalDebit = roundCurrency(
    lines.reduce((total, line) => total + (line.debit ?? 0), 0),
  );
  const totalCredit = roundCurrency(
    lines.reduce((total, line) => total + (line.credit ?? 0), 0),
  );

  if (totalDebit <= 0 || totalCredit <= 0) {
    throw new Error("Journal lines must include both debit and credit values");
  }

  if (Math.abs(totalDebit - totalCredit) > 0.009) {
    throw new Error("Journal entry must balance");
  }
}
