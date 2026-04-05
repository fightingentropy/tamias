import type { Database } from "../../../client";
import type {
  ReportInboxLiabilityAggregateRow,
  ReportInvoiceDateAggregateRow,
  ReportTransactionAggregateRow,
} from "../shared";

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

export type BalanceSheetTransactionRow = Pick<
  ReportTransactionAggregateRow,
  "categorySlug" | "date" | "direction" | "totalAmount"
>;

export type BalanceSheetInvoiceRow = Pick<
  NonNullable<ReportInvoiceDateAggregateRow>,
  "currency" | "totalAmount"
>;

export type BalanceSheetLiabilityRow = Pick<
  ReportInboxLiabilityAggregateRow,
  "currency" | "totalAmount"
>;

export type BalanceSheetBankAccount = {
  id: string;
  name: string | null;
  currency: string;
  balance: number;
  baseCurrency: string | null;
  baseBalance: number | null;
  type: "credit" | "loan" | "other_asset" | "other_liability";
};

export type BalanceSheetContext = {
  db: Database;
  teamId: string;
  currency: string;
  countryCode: string | null;
  asOfDate: Date;
  asOfDateStr: string;
  excludedCategorySlugs: string[];
  accountBalanceData: {
    totalBalance: number;
  };
  transactions: BalanceSheetTransactionRow[];
  accountsReceivableInvoices: BalanceSheetInvoiceRow[];
  bankAccounts: BalanceSheetBankAccount[];
  unmatchedBills: BalanceSheetLiabilityRow[];
};

export type CurrencyPair = {
  base: string;
  target: string;
};
