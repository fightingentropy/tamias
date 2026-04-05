import {
  CONTRA_REVENUE_CATEGORIES,
  REVENUE_CATEGORIES,
} from "@tamias/categories";
import { db } from "@tamias/app-data/client";
import {
  getReports,
  getSpending,
  getSpendingForPeriod,
} from "@tamias/app-data/queries";
import { getTransactionsPage } from "@tamias/app-services/transactions";
import { formatAmount } from "@tamias/utils/format";
import { format, parseISO } from "date-fns";
import type {
  AggregatedBreakdownTransaction,
  AggregatedMonthlyBreakdown,
  BreakdownCategory,
  BreakdownPeriodResult,
  BreakdownTransaction,
  MonthlyBreakdownData,
} from "./types";

type TransactionRecord =
  Awaited<ReturnType<typeof getTransactionsPage>>["data"][number];

type PeriodDataOptions = {
  teamId: string;
  from: string;
  to: string;
  finalCurrency?: string | null;
  targetCurrency: string;
  locale: string;
};

function shouldIncludeTransaction(transaction: TransactionRecord) {
  const revenueCategories = REVENUE_CATEGORIES as readonly string[];
  const contraRevenueCategories = CONTRA_REVENUE_CATEGORIES as readonly string[];

  if (transaction.internal) {
    return false;
  }

  if (transaction.amount > 0) {
    if (
      !transaction.categorySlug ||
      !revenueCategories.includes(transaction.categorySlug)
    ) {
      return false;
    }

    if (contraRevenueCategories.includes(transaction.categorySlug)) {
      return false;
    }
  }

  return true;
}

function getTransactionAmount(
  transaction: TransactionRecord,
  targetCurrency: string,
) {
  if (
    transaction.baseCurrency === targetCurrency &&
    transaction.baseAmount != null
  ) {
    return transaction.baseAmount;
  }

  return transaction.amount;
}

async function getAllTransactionsForRange(options: {
  teamId: string;
  from: string;
  to: string;
}) {
  const allTransactions: TransactionRecord[] = [];
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const transactionsResult = await getTransactionsPage({
      db,
      teamId: options.teamId,
      input: {
        start: options.from,
        end: options.to,
        sort: ["date", "desc"],
        pageSize: 10000,
        cursor,
      },
    });

    allTransactions.push(...transactionsResult.data);
    cursor = transactionsResult.meta.cursor ?? null;
    hasMore = transactionsResult.meta.hasNextPage ?? false;
  }

  return allTransactions;
}

function buildBreakdownTransactions(options: {
  transactions: TransactionRecord[];
  targetCurrency: string;
  locale: string;
}): BreakdownTransaction[] {
  const transactionAmounts = options.transactions.map((transaction) =>
    getTransactionAmount(transaction, options.targetCurrency),
  );

  const totalExpenses = Math.abs(
    transactionAmounts
      .filter((amount) => amount < 0)
      .reduce((sum, amount) => sum + amount, 0),
  );
  const totalRevenue = transactionAmounts
    .filter((amount) => amount > 0)
    .reduce((sum, amount) => sum + amount, 0);

  return options.transactions
    .map((transaction, index) => {
      const amount = transactionAmounts[index]!;
      const formattedAmount =
        formatAmount({
          amount: Math.abs(amount),
          currency:
            transaction.baseCurrency ||
            transaction.currency ||
            options.targetCurrency,
          locale: options.locale,
        }) || `${options.targetCurrency}${Math.abs(amount).toLocaleString()}`;
      const totalForPercentage = amount < 0 ? totalExpenses : totalRevenue;

      return {
        id: transaction.id,
        date: format(parseISO(transaction.date), "MMM d, yyyy"),
        name: transaction.name,
        amount,
        formattedAmount,
        category: transaction.category?.name || "Uncategorized",
        type: (amount >= 0 ? "income" : "expense") as "income" | "expense",
        vendor: transaction.name,
        percentage:
          totalForPercentage > 0
            ? (Math.abs(amount) / totalForPercentage) * 100
            : 0,
      };
    })
    .sort((left, right) => right.percentage - left.percentage)
    .slice(0, 10);
}

function buildBreakdownCategories(
  spendingCategories: Awaited<ReturnType<typeof getSpending>>,
): BreakdownCategory[] {
  return spendingCategories.map((category) => ({
    name: category.name,
    amount: category.amount,
    percentage: category.percentage,
    ...(category.color && { color: category.color }),
  }));
}

export async function getMetricsBreakdownPeriodData(
  options: PeriodDataOptions,
): Promise<BreakdownPeriodResult> {
  const [
    revenueResult,
    spendingCategories,
    periodSummary,
    profitResult,
    allTransactions,
  ] = await Promise.all([
    getReports(db, {
      teamId: options.teamId,
      from: options.from,
      to: options.to,
      currency: options.finalCurrency ?? undefined,
      type: "revenue",
      revenueType: "net",
    }),
    getSpending(db, {
      teamId: options.teamId,
      from: options.from,
      to: options.to,
      currency: options.finalCurrency ?? undefined,
    }),
    getSpendingForPeriod(db, {
      teamId: options.teamId,
      from: options.from,
      to: options.to,
      currency: options.finalCurrency ?? undefined,
    }),
    getReports(db, {
      teamId: options.teamId,
      from: options.from,
      to: options.to,
      currency: options.finalCurrency ?? undefined,
      type: "profit",
      revenueType: "net",
    }),
    getAllTransactionsForRange({
      teamId: options.teamId,
      from: options.from,
      to: options.to,
    }),
  ]);

  const relevantTransactions = buildBreakdownTransactions({
    transactions: allTransactions.filter(shouldIncludeTransaction),
    targetCurrency: options.targetCurrency,
    locale: options.locale,
  });

  return {
    summary: {
      revenue: revenueResult.summary.currentTotal,
      expenses: Math.abs(periodSummary.totalSpending),
      profit: profitResult.summary.currentTotal,
      transactionCount: allTransactions.filter(shouldIncludeTransaction).length,
    },
    transactions: relevantTransactions,
    categories: buildBreakdownCategories(spendingCategories),
  };
}

export function createMonthlyBreakdownData(options: {
  monthKey: string;
  from: string;
  result: BreakdownPeriodResult;
}): MonthlyBreakdownData {
  return {
    monthKey: options.monthKey,
    monthLabel: format(parseISO(options.from), "MMM yyyy"),
    revenue: options.result.summary.revenue,
    expenses: options.result.summary.expenses,
    profit: options.result.summary.profit,
    transactionCount: options.result.summary.transactionCount,
    topCategories: options.result.categories.slice(0, 5).map((category) => ({
      name: category.name,
      amount: category.amount,
      percentage: category.percentage,
    })),
    topTransactions: options.result.transactions.slice(0, 5).map((transaction) => ({
      name: transaction.name,
      amount: transaction.amount,
      formattedAmount: transaction.formattedAmount,
      category: transaction.category,
      percentage: transaction.percentage,
    })),
  };
}

export function aggregateMonthlyBreakdownResults(options: {
  monthlyData: MonthlyBreakdownData[];
  summary: {
    revenue: number;
    expenses: number;
  };
  targetCurrency: string;
  locale: string;
  from: string;
  to: string;
}): AggregatedMonthlyBreakdown {
  const categoryMap = new Map<
    string,
    { name: string; amount: number; percentage: number }
  >();

  for (const month of options.monthlyData) {
    for (const category of month.topCategories) {
      const existing = categoryMap.get(category.name);

      if (existing) {
        categoryMap.set(category.name, {
          name: category.name,
          amount: existing.amount + category.amount,
          percentage: 0,
        });
        continue;
      }

      categoryMap.set(category.name, { ...category });
    }
  }

  const categories = Array.from(categoryMap.values())
    .map((category) => ({
      ...category,
      percentage:
        options.summary.expenses > 0
          ? (category.amount / options.summary.expenses) * 100
          : 0,
    }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 5);

  const transactionMap = new Map<string, AggregatedBreakdownTransaction>();
  for (const month of options.monthlyData) {
    for (const transaction of month.topTransactions) {
      const key = `${transaction.name}-${transaction.category}`;
      const existing = transactionMap.get(key);

      if (existing) {
        transactionMap.set(key, {
          ...existing,
          amount: existing.amount + transaction.amount,
          percentage: 0,
        });
        continue;
      }

      transactionMap.set(key, { ...transaction });
    }
  }

  const transactions = Array.from(transactionMap.values())
    .map((transaction) => {
      const totalForPercentage =
        transaction.amount < 0 ? options.summary.expenses : options.summary.revenue;

      return {
        name: transaction.name,
        category: transaction.category,
        amount: transaction.amount,
        formattedAmount:
          formatAmount({
            amount: transaction.amount,
            currency: options.targetCurrency,
            locale: options.locale,
          }) || `${options.targetCurrency}${transaction.amount.toLocaleString()}`,
        percentage:
          totalForPercentage > 0
            ? (Math.abs(transaction.amount) / totalForPercentage) * 100
            : 0,
      };
    })
    .sort((left, right) => right.percentage - left.percentage)
    .slice(0, 5);

  const dateLabel = `${format(parseISO(options.from), "MMM d")} - ${format(parseISO(options.to), "MMM d, yyyy")}`;
  const formattedTransactions = transactions.map((transaction) => ({
    id: `aggregated-${transaction.name}-${transaction.category}`,
    date: dateLabel,
    name: transaction.name,
    amount: transaction.amount,
    formattedAmount: transaction.formattedAmount,
    category: transaction.category,
    type: (transaction.amount >= 0 ? "income" : "expense") as
      | "income"
      | "expense",
    vendor: transaction.name,
    percentage: transaction.percentage,
  }));

  return {
    categories,
    transactions,
    formattedTransactions,
  };
}
