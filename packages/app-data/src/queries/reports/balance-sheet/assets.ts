import type { BalanceSheetContext, BalanceSheetResult } from "./types";
import {
  buildNameMap,
  calculateAccumulatedDepreciation,
  groupTransactionsByCategory,
  mapBankAccountsByType,
  roundMoney,
  uniqueCurrencyPairs,
} from "./helpers";

const ASSET_CATEGORY_SLUGS = [
  "prepaid-expenses",
  "fixed-assets",
  "software",
  "inventory",
  "equipment",
];

export function getAssetCurrencyPairs(context: BalanceSheetContext) {
  const bankAccountMapping = mapBankAccountsByType(
    context.bankAccounts,
    context.currency,
  );

  return uniqueCurrencyPairs([
    ...context.accountsReceivableInvoices
      .filter(
        (invoice) =>
          (invoice.currency || context.currency) !== context.currency,
      )
      .map((invoice) => ({
        base: invoice.currency || context.currency,
        target: context.currency,
      })),
    ...bankAccountMapping.currencyPairs,
  ]);
}

export async function buildBalanceSheetAssets(
  context: BalanceSheetContext,
  exchangeRateMap: Map<string, number>,
): Promise<BalanceSheetResult["assets"]> {
  const assetTransactions = groupTransactionsByCategory(
    context.transactions,
    ASSET_CATEGORY_SLUGS,
  );
  const assetMap = new Map<string, number>();
  const assetNameMap = buildNameMap(assetTransactions, context.countryCode);

  for (const item of assetTransactions) {
    const slug = item.categorySlug || "";
    assetMap.set(slug, Math.abs(Number(item.amount) || 0));
  }

  const prepaidExpenses: number = assetMap.get("prepaid-expenses") || 0;
  const fixedAssetsRaw: number = assetMap.get("fixed-assets") || 0;
  const equipment: number = assetMap.get("equipment") || 0;
  const fixedAssets: number = fixedAssetsRaw + equipment;
  const softwareTechnology: number = assetMap.get("software") || 0;
  const inventory: number = assetMap.get("inventory") || 0;

  const fixedAssetTransactionsForDepreciation = context.transactions
    .filter((row) =>
      ["fixed-assets", "equipment", "software"].includes(
        row.categorySlug ?? "",
      ),
    )
    .map((row) => ({
      categorySlug: row.categorySlug,
      amount: Math.abs(row.totalAmount),
      date: row.date,
    }));

  const accumulatedDepreciation = calculateAccumulatedDepreciation(
    fixedAssetTransactionsForDepreciation,
    context.asOfDate,
  );

  const bankMapping = mapBankAccountsByType(context.bankAccounts, context.currency);

  let accountsReceivable = 0;
  const invoicesNeedingConversion: Array<{
    amount: number;
    currency: string;
  }> = [];

  for (const invoice of context.accountsReceivableInvoices) {
    const amount = Number(invoice.totalAmount) || 0;
    const invoiceCurrency = invoice.currency || context.currency;

    if (invoiceCurrency === context.currency) {
      accountsReceivable += amount;
    } else {
      invoicesNeedingConversion.push({ amount, currency: invoiceCurrency });
    }
  }

  for (const invoice of invoicesNeedingConversion) {
    const key = `${invoice.currency}:${context.currency}`;
    const rate = exchangeRateMap.get(key);
    if (rate) {
      accountsReceivable += invoice.amount * rate;
    }
  }

  const cash: number = context.accountBalanceData.totalBalance;
  const otherAssets = bankMapping.otherAssets;

  const currentAssetsTotal =
    cash + accountsReceivable + inventory + prepaidExpenses;
  const nonCurrentAssetsTotal =
    fixedAssets - accumulatedDepreciation + softwareTechnology + otherAssets;

  return {
    current: {
      cash: roundMoney(cash),
      accountsReceivable: roundMoney(accountsReceivable),
      inventory: roundMoney(inventory),
      inventoryName: assetNameMap.get("inventory"),
      prepaidExpenses: roundMoney(prepaidExpenses),
      prepaidExpensesName: assetNameMap.get("prepaid-expenses"),
      total: roundMoney(currentAssetsTotal),
    },
    nonCurrent: {
      fixedAssets: roundMoney(fixedAssets),
      fixedAssetsName: assetNameMap.get("fixed-assets"),
      accumulatedDepreciation: roundMoney(accumulatedDepreciation),
      softwareTechnology: roundMoney(softwareTechnology),
      softwareTechnologyName: assetNameMap.get("software"),
      longTermInvestments: 0,
      longTermInvestmentsName: assetNameMap.get("long-term-investments"),
      otherAssets: roundMoney(otherAssets),
      total: roundMoney(nonCurrentAssetsTotal),
    },
    total: roundMoney(currentAssetsTotal + nonCurrentAssetsTotal),
  };
}
