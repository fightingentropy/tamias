import { roundCurrency } from "@tamias/compliance";
import type { ComplianceJournalEntryRecord } from "../../../convex";
import type {
  RetainedEarningsRollforward,
  SummaryLine,
  TrialBalanceLine,
  WorkingPaperSection,
} from "../types";
import { describeAccount, presentBalance } from "./accounts";

export function buildTrialBalance(
  entries: ComplianceJournalEntryRecord[],
  periodStart: string,
  periodEnd: string,
) {
  const totals = new Map<
    string,
    {
      debit: number;
      credit: number;
      accountName: string;
      accountType: TrialBalanceLine["accountType"];
    }
  >();

  for (const entry of entries) {
    for (const line of entry.lines) {
      const descriptor = describeAccount(line.accountCode);

      if (
        (descriptor.accountType === "income" ||
          descriptor.accountType === "expense") &&
        (entry.entryDate < periodStart || entry.entryDate > periodEnd)
      ) {
        continue;
      }

      if (
        (descriptor.accountType === "asset" ||
          descriptor.accountType === "liability" ||
          descriptor.accountType === "equity") &&
        entry.entryDate > periodEnd
      ) {
        continue;
      }

      const existing = totals.get(line.accountCode) ?? {
        debit: 0,
        credit: 0,
        accountName: descriptor.accountName,
        accountType: descriptor.accountType,
      };

      existing.debit = roundCurrency(existing.debit + (line.debit ?? 0));
      existing.credit = roundCurrency(existing.credit + (line.credit ?? 0));
      totals.set(line.accountCode, existing);
    }
  }

  return [...totals.entries()]
    .map(([accountCode, totalsForAccount]) => ({
      accountCode,
      accountName: totalsForAccount.accountName,
      accountType: totalsForAccount.accountType,
      debit: roundCurrency(totalsForAccount.debit),
      credit: roundCurrency(totalsForAccount.credit),
      balance: roundCurrency(totalsForAccount.debit - totalsForAccount.credit),
    }))
    .sort((left, right) => left.accountCode.localeCompare(right.accountCode));
}

function sumPresentedBalances(
  lines: TrialBalanceLine[],
  accountTypes: TrialBalanceLine["accountType"][],
) {
  return roundCurrency(
    lines
      .filter((line) => accountTypes.includes(line.accountType))
      .reduce(
        (total, line) => total + presentBalance(line.accountType, line.balance),
        0,
      ),
  );
}

export function buildProfitAndLoss(trialBalance: TrialBalanceLine[]): SummaryLine[] {
  const revenue = sumPresentedBalances(trialBalance, ["income"]);
  const expenses = sumPresentedBalances(trialBalance, ["expense"]);
  const profitBeforeTax = roundCurrency(revenue - expenses);

  return [
    { key: "revenue", label: "Revenue", amount: revenue },
    { key: "expenses", label: "Expenses", amount: expenses * -1 },
    {
      key: "profit_before_tax",
      label: "Profit before tax",
      amount: profitBeforeTax,
    },
  ];
}

export function buildBalanceSheet(
  trialBalance: TrialBalanceLine[],
  retainedEarnings: RetainedEarningsRollforward,
): SummaryLine[] {
  const assets = sumPresentedBalances(trialBalance, ["asset"]);
  const liabilities = sumPresentedBalances(trialBalance, ["liability"]);
  const shareCapital = trialBalance
    .filter(
      (line) => line.accountType === "equity" && line.accountCode === "3000",
    )
    .reduce(
      (total, line) => total + presentBalance(line.accountType, line.balance),
      0,
    );
  const otherEquity = trialBalance
    .filter(
      (line) =>
        line.accountType === "equity" &&
        line.accountCode !== "3000" &&
        line.accountCode !== "3100",
    )
    .reduce(
      (total, line) => total + presentBalance(line.accountType, line.balance),
      0,
    );
  const equity = roundCurrency(
    shareCapital + retainedEarnings.closingBalance + otherEquity,
  );

  return [
    { key: "assets", label: "Assets", amount: assets },
    { key: "liabilities", label: "Liabilities", amount: liabilities },
    { key: "equity", label: "Equity", amount: equity },
  ];
}

export function buildWorkingPapers(
  trialBalance: TrialBalanceLine[],
): WorkingPaperSection[] {
  const sectionMatchers: Array<{
    key: WorkingPaperSection["key"];
    label: string;
    matches: (line: TrialBalanceLine) => boolean;
  }> = [
    {
      key: "bank",
      label: "Bank",
      matches: (line) => line.accountCode === "1000",
    },
    {
      key: "receivables",
      label: "Receivables",
      matches: (line) => line.accountCode === "1100",
    },
    {
      key: "payables",
      label: "Payables",
      matches: (line) =>
        line.accountCode === "2000" || line.accountCode === "2100",
    },
    {
      key: "vat",
      label: "VAT",
      matches: (line) =>
        line.accountCode === "1200" || line.accountCode === "2200",
    },
    {
      key: "debt",
      label: "Debt",
      matches: (line) => line.accountCode === "2400",
    },
    {
      key: "equity",
      label: "Equity",
      matches: (line) =>
        line.accountCode === "3000" || line.accountCode === "3100",
    },
    {
      key: "tax_accruals",
      label: "Tax accruals",
      matches: (line) =>
        line.accountCode === "2210" || line.accountCode === "2300",
    },
  ];

  return sectionMatchers.map((section) => {
    const lines = trialBalance.filter(section.matches).map((line) => ({
      accountCode: line.accountCode,
      accountName: line.accountName,
      accountType: line.accountType,
      balance: presentBalance(line.accountType, line.balance),
    }));

    return {
      key: section.key,
      label: section.label,
      total: roundCurrency(
        lines.reduce((total, line) => total + roundCurrency(line.balance), 0),
      ),
      lines,
    };
  });
}
