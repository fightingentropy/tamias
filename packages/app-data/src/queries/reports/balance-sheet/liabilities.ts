import { parseISO } from "date-fns";
import { buildNameMap, mapBankAccountsByType, roundMoney, uniqueCurrencyPairs } from "./helpers";
import type { BalanceSheetContext, BalanceSheetResult } from "./types";

const LIABILITY_CATEGORY_SLUGS = [
  "loan-proceeds",
  "loan-principal-repayment",
  "deferred-revenue",
  "leases",
];

export function getLiabilityCurrencyPairs(context: BalanceSheetContext) {
  const bankAccountMapping = mapBankAccountsByType(context.bankAccounts, context.currency);

  return uniqueCurrencyPairs([
    ...context.unmatchedBills
      .filter((bill) => (bill.currency || context.currency) !== context.currency)
      .map((bill) => ({
        base: bill.currency || context.currency,
        target: context.currency,
      })),
    ...bankAccountMapping.currencyPairs,
  ]);
}

export async function buildBalanceSheetLiabilities(
  context: BalanceSheetContext,
  exchangeRateMap: Map<string, number>,
): Promise<BalanceSheetResult["liabilities"]> {
  const liabilityTransactions = context.transactions.filter((row) =>
    LIABILITY_CATEGORY_SLUGS.includes(row.categorySlug ?? ""),
  );
  const liabilityMap = new Map<string, number>();
  const liabilityNameMap = buildNameMap(liabilityTransactions, context.countryCode);

  for (const item of liabilityTransactions) {
    const slug = item.categorySlug || "";
    liabilityMap.set(slug, Number(item.totalAmount) || 0);
  }

  const loanProceeds: number = liabilityMap.get("loan-proceeds") || 0;
  const loanRepayments: number = liabilityMap.get("loan-principal-repayment") || 0;
  const deferredRevenue: number = liabilityMap.get("deferred-revenue") || 0;
  const leases: number = liabilityMap.get("leases") || 0;
  const leasesName: string = liabilityNameMap.get("leases") || "Leases";

  let accountsPayable = 0;
  const billsNeedingConversion: Array<{
    amount: number;
    currency: string;
  }> = [];

  for (const bill of context.unmatchedBills) {
    const amount = Number(bill.totalAmount) || 0;
    const billCurrency = bill.currency || context.currency;

    if (billCurrency === context.currency) {
      accountsPayable += Math.abs(amount);
    } else {
      billsNeedingConversion.push({
        amount: Math.abs(amount),
        currency: billCurrency,
      });
    }
  }

  for (const bill of billsNeedingConversion) {
    const key = `${bill.currency}:${context.currency}`;
    const rate = exchangeRateMap.get(key);
    if (rate) {
      accountsPayable += bill.amount * rate;
    }
  }

  const bankMapping = mapBankAccountsByType(context.bankAccounts, context.currency);

  let shortTermLoanAmount = 0;
  let longTermLoanAmount = 0;

  const loanProceedsTransactions = context.transactions
    .filter((row) => row.categorySlug === "loan-proceeds")
    .map((row) => ({
      amount: Math.abs(row.totalAmount),
      date: row.date,
    }));

  const twelveMonthsAgo = new Date(context.asOfDate);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  for (const loan of loanProceedsTransactions) {
    const loanDate = parseISO(loan.date);
    const loanAmount = Number(loan.amount) || 0;

    if (loanDate >= twelveMonthsAgo) {
      shortTermLoanAmount += loanAmount;
    } else {
      longTermLoanAmount += loanAmount;
    }
  }

  const totalLoanProceeds = loanProceeds || 1;
  const shortTermProportion = totalLoanProceeds > 0 ? shortTermLoanAmount / totalLoanProceeds : 0;
  const longTermProportion = totalLoanProceeds > 0 ? longTermLoanAmount / totalLoanProceeds : 0;

  const shortTermAfterRepayments = Math.max(
    0,
    shortTermLoanAmount - loanRepayments * shortTermProportion,
  );
  const longTermAfterRepayments = Math.max(
    0,
    longTermLoanAmount - loanRepayments * longTermProportion,
  );

  const longTermDebt: number = Math.max(0, longTermAfterRepayments + bankMapping.loanAccountDebt);
  const shortTermDebt: number = Math.max(0, shortTermAfterRepayments);
  const creditCardDebt: number = bankMapping.creditCardDebt;
  const otherLiabilities: number = bankMapping.otherLiabilities;

  const accruedExpenses: number = 0;
  const accruedExpensesName: string | undefined = undefined;

  const currentLiabilitiesTotal =
    accountsPayable + accruedExpenses + shortTermDebt + creditCardDebt;
  const nonCurrentLiabilitiesTotal = longTermDebt + deferredRevenue + leases + otherLiabilities;

  return {
    current: {
      accountsPayable: roundMoney(accountsPayable),
      accruedExpenses: roundMoney(accruedExpenses),
      accruedExpensesName,
      shortTermDebt: roundMoney(shortTermDebt),
      creditCardDebt: roundMoney(creditCardDebt),
      creditCardDebtName: "Credit Card Debt",
      total: roundMoney(currentLiabilitiesTotal),
    },
    nonCurrent: {
      longTermDebt: roundMoney(longTermDebt),
      deferredRevenue: roundMoney(deferredRevenue),
      deferredRevenueName: liabilityNameMap.get("deferred-revenue"),
      leases: roundMoney(leases),
      leasesName,
      otherLiabilities: roundMoney(otherLiabilities),
      total: roundMoney(nonCurrentLiabilitiesTotal),
    },
    total: roundMoney(currentLiabilitiesTotal + nonCurrentLiabilitiesTotal),
  };
}
