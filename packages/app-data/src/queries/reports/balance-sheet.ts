import { UTCDate } from "@date-fns/utc";
import { format, parseISO } from "date-fns";
import type { Database } from "../../client";
import { getBankAccountsFromConvex } from "@tamias/app-data-convex";
import { getCashBalance } from "../bank-accounts";
import { getExchangeRatesBatch } from "../exhange-rates";
import { getInboxItemsPaged } from "../paged-records";
import {
  CONTRA_REVENUE_CATEGORIES,
  getCategoryInfo,
  getExcludedCategorySlugs,
  getReportInvoices,
  getReportTransactionAmounts,
  getTargetCurrency,
  getTeamReportContext,
  REVENUE_CATEGORIES,
} from "./shared";

export type GetBalanceSheetParams = {
  teamId: string;
  currency?: string;
  asOf?: string;
};

export type BalanceSheetResult = {
  assets: {
    current: {
      cash: number;
      accountsReceivable: number;
      inventory: number;
      inventoryName?: string;
      prepaidExpenses: number;
      prepaidExpensesName?: string;
      total: number;
    };
    nonCurrent: {
      fixedAssets: number;
      fixedAssetsName?: string;
      accumulatedDepreciation: number;
      softwareTechnology: number;
      softwareTechnologyName?: string;
      longTermInvestments: number;
      longTermInvestmentsName?: string;
      otherAssets: number;
      total: number;
    };
    total: number;
  };
  liabilities: {
    current: {
      accountsPayable: number;
      accruedExpenses: number;
      accruedExpensesName?: string;
      shortTermDebt: number;
      creditCardDebt: number;
      creditCardDebtName?: string;
      total: number;
    };
    nonCurrent: {
      longTermDebt: number;
      deferredRevenue: number;
      deferredRevenueName?: string;
      leases: number;
      leasesName?: string;
      otherLiabilities: number;
      total: number;
    };
    total: number;
  };
  equity: {
    capitalInvestment: number;
    capitalInvestmentName?: string;
    ownerDraws: number;
    ownerDrawsName?: string;
    retainedEarnings: number;
    total: number;
  };
  currency: string;
};

export async function getBalanceSheet(
  db: Database,
  params: GetBalanceSheetParams,
): Promise<BalanceSheetResult> {
  const { teamId, currency: inputCurrency, asOf } = params;

  const targetCurrency = await getTargetCurrency(db, teamId, inputCurrency);
  const { countryCode } = await getTeamReportContext(db, teamId, inputCurrency);
  const currency = targetCurrency || "USD";
  const excludedCategorySlugs = getExcludedCategorySlugs();

  const asOfDate = asOf ? parseISO(asOf) : new UTCDate();
  const asOfDateStr = format(asOfDate, "yyyy-MM-dd");

  const [
    accountBalanceData,
    reportTransactionData,
    accountsReceivableInvoices,
    bankAccountsData,
    unmatchedBillsData,
  ] = await Promise.all([
    getCashBalance(db, {
      teamId,
      currency: inputCurrency,
    }),
    getReportTransactionAmounts(db, {
      teamId,
      from: "1900-01-01",
      to: asOfDateStr,
      inputCurrency,
    }),
    Promise.all([
      getReportInvoices(db, {
        teamId,
        inputCurrency,
        statuses: ["unpaid", "overdue"],
      }),
      getReportInvoices(db, {
        teamId,
        inputCurrency,
        statuses: ["scheduled"],
        dateField: "issueDate",
        to: asOfDateStr,
      }),
    ]).then(([outstandingInvoices, scheduledInvoices]) => [
      ...outstandingInvoices,
      ...scheduledInvoices.filter((invoice) => !!invoice.issueDate),
    ]),
    getBankAccountsFromConvex({
      teamId,
      enabled: true,
    }).then((accounts) =>
      accounts.filter(
        (account) =>
          account.type === "credit" ||
          account.type === "loan" ||
          account.type === "other_asset" ||
          account.type === "other_liability",
      ),
    ),
    getInboxItemsPaged({ teamId }).then((items) =>
      items
        .filter((item) => item.transactionId == null)
        .filter((item) => item.amount !== null)
        .filter((item) => item.status !== "done" && item.status !== "deleted")
        .filter((item) => item.date !== null && item.date <= asOfDateStr)
        .map((item) => ({
          amount: item.amount,
          currency: item.currency,
          baseAmount: item.baseAmount,
          baseCurrency: item.baseCurrency,
        })),
    ),
  ]);

  const balanceSheetTransactions = reportTransactionData.amounts.filter(
    (row) => {
      const slug = row.transaction.categorySlug;
      return !slug || !excludedCategorySlugs.includes(slug);
    },
  );
  const groupTransactionsByCategory = (slugs: string[]) => {
    const totals = new Map<string, number>();

    for (const row of balanceSheetTransactions) {
      const slug = row.transaction.categorySlug;
      if (!slug || !slugs.includes(slug)) {
        continue;
      }

      totals.set(slug, (totals.get(slug) ?? 0) + row.amount);
    }

    return Array.from(totals.entries()).map(([categorySlug, amount]) => ({
      categorySlug,
      amount,
    }));
  };
  const outstandingInvoicesData = accountsReceivableInvoices.map((invoice) => ({
    amount: invoice.amount,
    currency: invoice.currency,
  }));
  const assetTransactions = groupTransactionsByCategory([
    "prepaid-expenses",
    "fixed-assets",
    "software",
    "inventory",
    "equipment",
  ]);
  const fixedAssetTransactionsForDepreciation = balanceSheetTransactions
    .filter((row) =>
      ["fixed-assets", "equipment", "software"].includes(
        row.transaction.categorySlug ?? "",
      ),
    )
    .map((row) => ({
      categorySlug: row.transaction.categorySlug,
      amount: Math.abs(row.amount),
      date: row.transaction.date,
    }));
  const liabilityTransactions = groupTransactionsByCategory([
    "loan-proceeds",
    "loan-principal-repayment",
    "deferred-revenue",
    "leases",
  ]);
  const loanProceedsTransactions = balanceSheetTransactions
    .filter((row) => row.transaction.categorySlug === "loan-proceeds")
    .map((row) => ({
      amount: Math.abs(row.amount),
      date: row.transaction.date,
    }));
  const equityTransactions = groupTransactionsByCategory([
    "capital-investment",
    "owner-draws",
  ]);
  const allRevenueTransactions = [
    {
      amount: balanceSheetTransactions.reduce((sum, row) => {
        const slug = row.transaction.categorySlug;
        if (!slug) {
          return sum;
        }

        if (
          (REVENUE_CATEGORIES as readonly string[]).includes(slug) &&
          !(CONTRA_REVENUE_CATEGORIES as readonly string[]).includes(slug) &&
          row.amount > 0
        ) {
          return sum + row.amount;
        }

        return sum;
      }, 0),
    },
  ];
  const allExpenseTransactions = [
    {
      amount: balanceSheetTransactions.reduce((sum, row) => {
        const slug = row.transaction.categorySlug;

        if (row.amount >= 0) {
          return sum;
        }

        if (
          slug &&
          [
            "prepaid-expenses",
            "fixed-assets",
            "software",
            "inventory",
            "equipment",
          ].includes(slug)
        ) {
          return sum;
        }

        return sum + Math.abs(row.amount);
      }, 0),
    },
  ];

  const assetMap = new Map<string, number>();
  const assetNameMap = new Map<string, string>();
  for (const item of assetTransactions) {
    const slug = item.categorySlug || "";
    assetMap.set(slug, Math.abs(Number(item.amount) || 0));
    const categoryInfo = getCategoryInfo(slug, countryCode);
    if (categoryInfo) {
      assetNameMap.set(slug, categoryInfo.name);
    }
  }
  const prepaidExpenses: number = assetMap.get("prepaid-expenses") || 0;
  const fixedAssetsRaw: number = assetMap.get("fixed-assets") || 0;
  const equipment: number = assetMap.get("equipment") || 0;
  const fixedAssets: number = fixedAssetsRaw + equipment;
  const softwareTechnology: number = assetMap.get("software") || 0;
  const inventory: number = assetMap.get("inventory") || 0;

  let accumulatedDepreciation = 0;
  const fixedAssetTransactionsList =
    fixedAssetTransactionsForDepreciation as unknown as Array<{
      categorySlug: string | null;
      amount: number;
      date: string;
    }>;

  for (const asset of fixedAssetTransactionsList) {
    const purchaseDate = parseISO(asset.date);
    const purchaseYear = purchaseDate.getFullYear();
    const purchaseMonth = purchaseDate.getMonth();
    const asOfYear = asOfDate.getFullYear();
    const asOfMonth = asOfDate.getMonth();

    const monthsSincePurchase =
      (asOfYear - purchaseYear) * 12 + (asOfMonth - purchaseMonth);

    if (monthsSincePurchase <= 0) continue;

    const assetAmount = Number(asset.amount) || 0;
    const category = asset.categorySlug || "";

    let usefulLifeMonths = 60;
    if (category === "software") {
      usefulLifeMonths = 36;
    }

    const depreciationPercentage = Math.min(
      monthsSincePurchase / usefulLifeMonths,
      1,
    );
    const depreciationAmount = assetAmount * depreciationPercentage;
    accumulatedDepreciation += depreciationAmount;
  }

  const liabilityMap = new Map<string, number>();
  const liabilityNameMap = new Map<string, string>();
  const liabilityTransactionsList = liabilityTransactions as unknown as Array<{
    categorySlug: string | null;
    amount: number;
  }>;
  for (const item of liabilityTransactionsList) {
    const slug = item.categorySlug || "";
    liabilityMap.set(slug, Number(item.amount) || 0);
    const categoryInfo = getCategoryInfo(slug, countryCode);
    if (categoryInfo) {
      liabilityNameMap.set(slug, categoryInfo.name);
    }
  }
  const loanProceeds: number = liabilityMap.get("loan-proceeds") || 0;
  const loanRepayments: number =
    liabilityMap.get("loan-principal-repayment") || 0;
  const deferredRevenue: number = liabilityMap.get("deferred-revenue") || 0;
  const leases: number = liabilityMap.get("leases") || 0;
  const leasesName: string = liabilityNameMap.get("leases") || "Leases";

  const accruedExpenses: number = 0;
  const accruedExpensesName: string | undefined = undefined;

  let accountsPayable = 0;
  const billsData = unmatchedBillsData as Array<{
    amount: number | null;
    currency: string | null;
    baseAmount: number | null;
    baseCurrency: string | null;
  }>;

  const billsCurrencyPairs: Array<{ base: string; target: string }> = [];
  const billsNeedingConversion: Array<{
    amount: number;
    currency: string;
  }> = [];

  for (const bill of billsData) {
    if (bill.baseAmount !== null && bill.baseCurrency !== null) {
      const baseAmountValue = Number(bill.baseAmount) || 0;
      if (bill.baseCurrency === currency) {
        accountsPayable += Math.abs(baseAmountValue);
      } else {
        billsNeedingConversion.push({
          amount: Math.abs(baseAmountValue),
          currency: bill.baseCurrency,
        });
        billsCurrencyPairs.push({ base: bill.baseCurrency, target: currency });
      }
    } else {
      const amount = Number(bill.amount) || 0;
      const billCurrency = bill.currency || currency;

      if (billCurrency === currency) {
        accountsPayable += Math.abs(amount);
      } else {
        billsNeedingConversion.push({
          amount: Math.abs(amount),
          currency: billCurrency,
        });
        billsCurrencyPairs.push({ base: billCurrency, target: currency });
      }
    }
  }

  const equityMap = new Map<string, number>();
  const equityNameMap = new Map<string, string>();
  for (const item of equityTransactions) {
    const slug = item.categorySlug || "";
    equityMap.set(slug, Number(item.amount) || 0);
    const categoryInfo = getCategoryInfo(slug, countryCode);
    if (categoryInfo) {
      equityNameMap.set(slug, categoryInfo.name);
    }
  }
  const capitalInvestment: number = equityMap.get("capital-investment") || 0;
  const ownerDrawsRaw: number = equityMap.get("owner-draws") || 0;
  const ownerDraws: number = Math.abs(ownerDrawsRaw);

  const totalRevenue: number = Number(allRevenueTransactions[0]?.amount) || 0;
  const totalExpenses: number = Number(allExpenseTransactions[0]?.amount) || 0;
  const retainedEarnings: number = totalRevenue - totalExpenses;

  const cash: number = accountBalanceData.totalBalance;

  let accountsReceivable = 0;
  const invoiceData = outstandingInvoicesData as Array<{
    amount: number;
    currency: string;
  }>;

  const invoiceCurrencyPairs: Array<{ base: string; target: string }> = [];
  const invoicesNeedingConversion: Array<{
    amount: number;
    currency: string;
  }> = [];

  for (const invoice of invoiceData) {
    const amount = Number(invoice.amount) || 0;
    const invoiceCurrency = invoice.currency || currency;

    if (invoiceCurrency === currency) {
      accountsReceivable += amount;
    } else {
      invoicesNeedingConversion.push({ amount, currency: invoiceCurrency });
      invoiceCurrencyPairs.push({ base: invoiceCurrency, target: currency });
    }
  }

  let creditCardDebt = 0;
  let loanAccountDebt = 0;
  let otherAssets = 0;
  let otherLiabilities = 0;
  const bankAccountsList = bankAccountsData as Array<{
    id: string;
    name: string;
    currency: string;
    balance: number;
    baseCurrency: string | null;
    baseBalance: number | null;
    type: string;
  }>;

  const accountCurrencyPairs: Array<{ base: string; target: string }> = [];
  const accountsNeedingConversion: Array<{
    balance: number;
    currency: string;
    type: string;
  }> = [];

  for (const account of bankAccountsList) {
    const balance = Number(account.balance) || 0;
    const accountCurrency = account.currency || currency;

    if (
      account.baseBalance !== null &&
      account.baseCurrency === currency &&
      accountCurrency !== currency
    ) {
      const convertedBalance = Number(account.baseBalance);
      if (account.type === "credit") {
        creditCardDebt += Math.abs(convertedBalance);
      } else if (account.type === "loan") {
        loanAccountDebt += Math.abs(convertedBalance);
      } else if (account.type === "other_asset") {
        otherAssets += Math.abs(convertedBalance);
      } else if (account.type === "other_liability") {
        otherLiabilities += Math.abs(convertedBalance);
      }
    } else if (accountCurrency === currency) {
      if (account.type === "credit") {
        creditCardDebt += Math.abs(balance);
      } else if (account.type === "loan") {
        loanAccountDebt += Math.abs(balance);
      } else if (account.type === "other_asset") {
        otherAssets += Math.abs(balance);
      } else if (account.type === "other_liability") {
        otherLiabilities += Math.abs(balance);
      }
    } else {
      accountsNeedingConversion.push({
        balance,
        currency: accountCurrency,
        type: account.type,
      });
      accountCurrencyPairs.push({ base: accountCurrency, target: currency });
    }
  }

  const allCurrencyPairs = [
    ...invoiceCurrencyPairs,
    ...accountCurrencyPairs,
    ...billsCurrencyPairs,
  ];
  const exchangeRateMap =
    allCurrencyPairs.length > 0
      ? await getExchangeRatesBatch(db, { pairs: allCurrencyPairs })
      : new Map<string, number>();

  for (const invoice of invoicesNeedingConversion) {
    const key = `${invoice.currency}:${currency}`;
    const rate = exchangeRateMap.get(key);
    if (rate) {
      const convertedAmount = invoice.amount * rate;
      accountsReceivable += convertedAmount;
    }
  }

  for (const bill of billsNeedingConversion) {
    const key = `${bill.currency}:${currency}`;
    const rate = exchangeRateMap.get(key);
    if (rate) {
      const convertedAmount = bill.amount * rate;
      accountsPayable += convertedAmount;
    }
  }

  for (const account of accountsNeedingConversion) {
    const key = `${account.currency}:${currency}`;
    const rate = exchangeRateMap.get(key);
    if (rate) {
      const convertedBalance = account.balance * rate;

      if (account.type === "credit") {
        creditCardDebt += Math.abs(convertedBalance);
      } else if (account.type === "loan") {
        loanAccountDebt += Math.abs(convertedBalance);
      } else if (account.type === "other_asset") {
        otherAssets += Math.abs(convertedBalance);
      } else if (account.type === "other_liability") {
        otherLiabilities += Math.abs(convertedBalance);
      }
    }
  }

  let shortTermLoanAmount = 0;
  let longTermLoanAmount = 0;

  const loanProceedsList = loanProceedsTransactions as unknown as Array<{
    amount: number;
    date: string;
  }>;

  const twelveMonthsAgo = new UTCDate(asOfDate);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  for (const loan of loanProceedsList) {
    const loanDate = parseISO(loan.date);
    const loanAmount = Number(loan.amount) || 0;

    if (loanDate >= twelveMonthsAgo) {
      shortTermLoanAmount += loanAmount;
    } else {
      longTermLoanAmount += loanAmount;
    }
  }

  const totalLoanProceeds = loanProceeds || 1;
  const shortTermProportion =
    totalLoanProceeds > 0 ? shortTermLoanAmount / totalLoanProceeds : 0;
  const longTermProportion =
    totalLoanProceeds > 0 ? longTermLoanAmount / totalLoanProceeds : 0;

  const shortTermAfterRepayments = Math.max(
    0,
    shortTermLoanAmount - loanRepayments * shortTermProportion,
  );
  const longTermAfterRepayments = Math.max(
    0,
    longTermLoanAmount - loanRepayments * longTermProportion,
  );

  const longTermDebt: number = Math.max(
    0,
    longTermAfterRepayments + loanAccountDebt,
  );
  const shortTermDebt: number = Math.max(0, shortTermAfterRepayments);

  const currentAssetsTotal =
    cash + accountsReceivable + inventory + prepaidExpenses;
  const nonCurrentAssetsTotal =
    fixedAssets - accumulatedDepreciation + softwareTechnology + otherAssets;
  const totalAssets = currentAssetsTotal + nonCurrentAssetsTotal;

  const currentLiabilitiesTotal =
    accountsPayable + accruedExpenses + shortTermDebt + creditCardDebt;
  const nonCurrentLiabilitiesTotal =
    longTermDebt + deferredRevenue + leases + otherLiabilities;
  const totalLiabilities = currentLiabilitiesTotal + nonCurrentLiabilitiesTotal;

  const equityTotal = capitalInvestment - ownerDraws + retainedEarnings;
  const totalLiabilitiesAndEquity = totalLiabilities + equityTotal;

  const balanceDifference = totalAssets - totalLiabilitiesAndEquity;
  if (Math.abs(balanceDifference) > 0.01) {
    const adjustedRetainedEarnings = retainedEarnings + balanceDifference;
    const adjustedEquityTotal =
      capitalInvestment - ownerDraws + adjustedRetainedEarnings;

    return {
      assets: {
        current: {
          cash: Math.round(cash * 100) / 100,
          accountsReceivable: Math.round(accountsReceivable * 100) / 100,
          inventory: Math.round(inventory * 100) / 100,
          inventoryName: assetNameMap.get("inventory"),
          prepaidExpenses: Math.round(prepaidExpenses * 100) / 100,
          prepaidExpensesName: assetNameMap.get("prepaid-expenses"),
          total: Math.round(currentAssetsTotal * 100) / 100,
        },
        nonCurrent: {
          fixedAssets: Math.round(fixedAssets * 100) / 100,
          fixedAssetsName: assetNameMap.get("fixed-assets"),
          accumulatedDepreciation:
            Math.round(accumulatedDepreciation * 100) / 100,
          softwareTechnology: Math.round(softwareTechnology * 100) / 100,
          softwareTechnologyName: assetNameMap.get("software"),
          longTermInvestments: 0,
          longTermInvestmentsName: assetNameMap.get("long-term-investments"),
          otherAssets: Math.round(otherAssets * 100) / 100,
          total: Math.round(nonCurrentAssetsTotal * 100) / 100,
        },
        total: Math.round(totalAssets * 100) / 100,
      },
      liabilities: {
        current: {
          accountsPayable: Math.round(accountsPayable * 100) / 100,
          accruedExpenses: Math.round(accruedExpenses * 100) / 100,
          accruedExpensesName,
          shortTermDebt: Math.round(shortTermDebt * 100) / 100,
          creditCardDebt: Math.round(creditCardDebt * 100) / 100,
          creditCardDebtName: "Credit Card Debt",
          total: Math.round(currentLiabilitiesTotal * 100) / 100,
        },
        nonCurrent: {
          longTermDebt: Math.round(longTermDebt * 100) / 100,
          deferredRevenue: Math.round(deferredRevenue * 100) / 100,
          deferredRevenueName: liabilityNameMap.get("deferred-revenue"),
          leases: Math.round(leases * 100) / 100,
          leasesName,
          otherLiabilities: Math.round(otherLiabilities * 100) / 100,
          total: Math.round(nonCurrentLiabilitiesTotal * 100) / 100,
        },
        total: Math.round(totalLiabilities * 100) / 100,
      },
      equity: {
        capitalInvestment: Math.round(capitalInvestment * 100) / 100,
        capitalInvestmentName: equityNameMap.get("capital-investment"),
        ownerDraws: Math.round(ownerDraws * 100) / 100,
        ownerDrawsName: equityNameMap.get("owner-draws"),
        retainedEarnings: Math.round(adjustedRetainedEarnings * 100) / 100,
        total: Math.round(adjustedEquityTotal * 100) / 100,
      },
      currency,
    };
  }

  return {
    assets: {
      current: {
        cash: Math.round(cash * 100) / 100,
        accountsReceivable: Math.round(accountsReceivable * 100) / 100,
        inventory: Math.round(inventory * 100) / 100,
        inventoryName: assetNameMap.get("inventory"),
        prepaidExpenses: Math.round(prepaidExpenses * 100) / 100,
        prepaidExpensesName: assetNameMap.get("prepaid-expenses"),
        total: Math.round(currentAssetsTotal * 100) / 100,
      },
      nonCurrent: {
        fixedAssets: Math.round(fixedAssets * 100) / 100,
        fixedAssetsName: assetNameMap.get("fixed-assets"),
        accumulatedDepreciation: 0,
        softwareTechnology: Math.round(softwareTechnology * 100) / 100,
        softwareTechnologyName: assetNameMap.get("software"),
        longTermInvestments: 0,
        longTermInvestmentsName: assetNameMap.get("long-term-investments"),
        otherAssets: Math.round(otherAssets * 100) / 100,
        total: Math.round(nonCurrentAssetsTotal * 100) / 100,
      },
      total: Math.round(totalAssets * 100) / 100,
    },
    liabilities: {
      current: {
        accountsPayable: Math.round(accountsPayable * 100) / 100,
        accruedExpenses: Math.round(accruedExpenses * 100) / 100,
        accruedExpensesName,
        shortTermDebt: Math.round(shortTermDebt * 100) / 100,
        creditCardDebt: Math.round(creditCardDebt * 100) / 100,
        creditCardDebtName: "Credit Card Debt",
        total: Math.round(currentLiabilitiesTotal * 100) / 100,
      },
      nonCurrent: {
        longTermDebt: Math.round(longTermDebt * 100) / 100,
        deferredRevenue: Math.round(deferredRevenue * 100) / 100,
        deferredRevenueName: liabilityNameMap.get("deferred-revenue"),
        leases: Math.round(leases * 100) / 100,
        leasesName,
        otherLiabilities: Math.round(otherLiabilities * 100) / 100,
        total: Math.round(nonCurrentLiabilitiesTotal * 100) / 100,
      },
      total: Math.round(totalLiabilities * 100) / 100,
    },
    equity: {
      capitalInvestment: Math.round(capitalInvestment * 100) / 100,
      capitalInvestmentName: equityNameMap.get("capital-investment"),
      ownerDraws: Math.round(ownerDraws * 100) / 100,
      ownerDrawsName: equityNameMap.get("owner-draws"),
      retainedEarnings: Math.round(retainedEarnings * 100) / 100,
      total: Math.round(equityTotal * 100) / 100,
    },
    currency,
  };
}
