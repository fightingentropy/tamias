import { parseISO } from "date-fns";
import { getCategoryInfo, REVENUE_CATEGORIES, CONTRA_REVENUE_CATEGORIES } from "../shared";
import type {
  BalanceSheetBankAccount,
  BalanceSheetTransactionRow,
  CurrencyPair,
} from "./types";

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function groupTransactionsByCategory(
  rows: BalanceSheetTransactionRow[],
  slugs: string[],
) {
  const totals = new Map<string, number>();

  for (const row of rows) {
    const slug = row.categorySlug;

    if (!slug || !slugs.includes(slug)) {
      continue;
    }

    totals.set(slug, (totals.get(slug) ?? 0) + row.totalAmount);
  }

  return Array.from(totals.entries()).map(([categorySlug, amount]) => ({
    categorySlug,
    amount,
  }));
}

export function buildNameMap(
  rows: Array<{ categorySlug: string | null }>,
  countryCode: string | null,
) {
  const map = new Map<string, string>();

  for (const row of rows) {
    const slug = row.categorySlug || "";
    const categoryInfo = getCategoryInfo(slug, countryCode);

    if (categoryInfo) {
      map.set(slug, categoryInfo.name);
    }
  }

  return map;
}

export function calculateAccumulatedDepreciation(
  rows: Array<{
    categorySlug: string | null;
    amount: number;
    date: string;
  }>,
  asOfDate: Date,
) {
  let accumulatedDepreciation = 0;

  for (const asset of rows) {
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

    const usefulLifeMonths = category === "software" ? 36 : 60;
    const depreciationPercentage = Math.min(
      monthsSincePurchase / usefulLifeMonths,
      1,
    );

    accumulatedDepreciation += assetAmount * depreciationPercentage;
  }

  return accumulatedDepreciation;
}

export function sumRevenueTransactions(rows: BalanceSheetTransactionRow[]) {
  return rows.reduce((sum, row) => {
    const slug = row.categorySlug;

    if (!slug) {
      return sum;
    }

    if (
      row.direction === "income" &&
      (REVENUE_CATEGORIES as readonly string[]).includes(slug) &&
      !(CONTRA_REVENUE_CATEGORIES as readonly string[]).includes(slug)
    ) {
      return sum + row.totalAmount;
    }

    return sum;
  }, 0);
}

export function sumExpenseTransactions(rows: BalanceSheetTransactionRow[]) {
  return rows.reduce((sum, row) => {
    const slug = row.categorySlug;

    if (row.direction !== "expense") {
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

    return sum + Math.abs(row.totalAmount);
  }, 0);
}

export function uniqueCurrencyPairs(pairs: CurrencyPair[]) {
  return Array.from(new Map(pairs.map((pair) => [`${pair.base}:${pair.target}`, pair])).values());
}

export function mapBankAccountsByType(
  accounts: BalanceSheetBankAccount[],
  currency: string,
) {
  return accounts.reduce(
    (acc, account) => {
      const balance = Number(account.balance) || 0;
      const accountCurrency = account.currency || currency;

      if (
        account.baseBalance !== null &&
        account.baseCurrency === currency &&
        accountCurrency !== currency
      ) {
        const convertedBalance = Number(account.baseBalance);

        if (account.type === "credit") {
          acc.creditCardDebt += Math.abs(convertedBalance);
        } else if (account.type === "loan") {
          acc.loanAccountDebt += Math.abs(convertedBalance);
        } else if (account.type === "other_asset") {
          acc.otherAssets += Math.abs(convertedBalance);
        } else if (account.type === "other_liability") {
          acc.otherLiabilities += Math.abs(convertedBalance);
        }

        return acc;
      }

      if (accountCurrency !== currency) {
        acc.currencyPairs.push({ base: accountCurrency, target: currency });
        acc.needingConversion.push({
          balance,
          currency: accountCurrency,
          type: account.type,
        });
        return acc;
      }

      if (account.type === "credit") {
        acc.creditCardDebt += Math.abs(balance);
      } else if (account.type === "loan") {
        acc.loanAccountDebt += Math.abs(balance);
      } else if (account.type === "other_asset") {
        acc.otherAssets += Math.abs(balance);
      } else if (account.type === "other_liability") {
        acc.otherLiabilities += Math.abs(balance);
      }

      return acc;
    },
    {
      creditCardDebt: 0,
      loanAccountDebt: 0,
      otherAssets: 0,
      otherLiabilities: 0,
      currencyPairs: [] as CurrencyPair[],
      needingConversion: [] as Array<{
        balance: number;
        currency: string;
        type: BalanceSheetBankAccount["type"];
      }>,
    },
  );
}
