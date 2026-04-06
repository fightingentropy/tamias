import type { Database } from "../../client";
import { reuseQueryResult } from "../../utils/request-cache";
import {
  getCategoryInfo,
  getExcludedCategorySlugs,
  getRecurringMonthlyEquivalent,
  getReportTransactionRecurringAggregateRows,
  getTargetCurrency,
  normalizeRecurringFrequency,
  roundMoney,
} from "./shared";

export type GetRecurringExpensesParams = {
  teamId: string;
  currency?: string;
  from?: string;
  to?: string;
};

interface RecurringExpenseItem {
  name: string;
  amount: number;
  frequency: "weekly" | "biweekly" | "monthly" | "semi_monthly" | "annually" | "irregular";
  categoryName: string | null;
  categorySlug: string | null;
  lastDate: string;
}

async function getRecurringExpensesImpl(db: Database, params: GetRecurringExpensesParams) {
  const { teamId, currency: inputCurrency, from, to } = params;

  const targetCurrency = await getTargetCurrency(db, teamId, inputCurrency);
  const excludedCategorySlugs = getExcludedCategorySlugs();
  const aggregateData = await getReportTransactionRecurringAggregateRows(db, {
    teamId,
    direction: "expense",
    from,
    to,
    inputCurrency,
  });
  const grouped = new Map<
    string,
    {
      name: string;
      frequency: string | null;
      categorySlug: string | null;
      total: number;
      count: number;
      lastDate: string;
    }
  >();

  for (const row of aggregateData.rows) {
    const slug = row.categorySlug;

    if (slug && excludedCategorySlugs.includes(slug)) {
      continue;
    }

    const key = [row.name, normalizeRecurringFrequency(row.frequency), slug ?? ""].join("\0");
    const current = grouped.get(key) ?? {
      name: row.name,
      frequency: row.frequency,
      categorySlug: slug,
      total: 0,
      count: 0,
      lastDate: row.date,
    };

    current.total = roundMoney(current.total + Math.abs(row.totalAmount));
    current.count += row.transactionCount;

    if (row.date > current.lastDate) {
      current.lastDate = row.date;
    }

    grouped.set(key, current);
  }

  const recurringExpenses = [...grouped.values()]
    .map((expense) => ({
      name: expense.name,
      frequency: normalizeRecurringFrequency(expense.frequency),
      categorySlug: expense.categorySlug,
      amount: expense.count > 0 ? expense.total / expense.count : 0,
      count: expense.count,
      lastDate: expense.lastDate,
    }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 10);

  const frequencyTotals = {
    weekly: 0,
    biweekly: 0,
    monthly: 0,
    semi_monthly: 0,
    annually: 0,
    irregular: 0,
  };
  let totalRecurringAmount = 0;

  for (const expense of recurringExpenses) {
    const amount = Number(expense.amount);
    const frequency = normalizeRecurringFrequency(expense.frequency);
    const monthlyEquivalent = getRecurringMonthlyEquivalent(amount, frequency);

    switch (frequency) {
      case "weekly":
        frequencyTotals.weekly += amount;
        break;
      case "biweekly":
        frequencyTotals.biweekly += amount;
        break;
      case "monthly":
        frequencyTotals.monthly += amount;
        break;
      case "semi_monthly":
        frequencyTotals.semi_monthly += amount;
        break;
      case "annually":
        frequencyTotals.annually += amount;
        break;
      case "irregular":
        frequencyTotals.irregular += amount;
        break;
    }

    totalRecurringAmount += monthlyEquivalent;
  }

  const currency = recurringExpenses[0]
    ? inputCurrency || targetCurrency || "USD"
    : targetCurrency || "USD";
  const expenses: RecurringExpenseItem[] = recurringExpenses.map((expense) => ({
    name: expense.name,
    amount: Number(Number(expense.amount).toFixed(2)),
    frequency: normalizeRecurringFrequency(expense.frequency),
    categoryName: getCategoryInfo(expense.categorySlug, null)?.name ?? null,
    categorySlug: expense.categorySlug,
    lastDate: expense.lastDate,
  }));

  return {
    summary: {
      totalMonthlyEquivalent: Number(totalRecurringAmount.toFixed(2)),
      totalExpenses: recurringExpenses.length,
      currency,
      byFrequency: {
        weekly: Number((frequencyTotals.weekly || 0).toFixed(2)),
        biweekly: Number((frequencyTotals.biweekly || 0).toFixed(2)),
        monthly: Number((frequencyTotals.monthly || 0).toFixed(2)),
        semi_monthly: Number((frequencyTotals.semi_monthly || 0).toFixed(2)),
        annually: Number((frequencyTotals.annually || 0).toFixed(2)),
        irregular: Number((frequencyTotals.irregular || 0).toFixed(2)),
      },
    },
    expenses,
    meta: {
      type: "recurring_expenses",
      currency,
    },
  };
}

export const getRecurringExpenses = reuseQueryResult({
  keyPrefix: "recurring-expenses",
  keyFn: (params: GetRecurringExpensesParams) =>
    [params.teamId, params.currency ?? "", params.from ?? "", params.to ?? ""].join(":"),
  load: getRecurringExpensesImpl,
});
