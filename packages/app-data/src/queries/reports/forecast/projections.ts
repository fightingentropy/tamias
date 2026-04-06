import { UTCDate } from "@date-fns/utc";
import { addMonths, format, parseISO, subMonths } from "date-fns";
import type { Database } from "../../../client";
import { getRecurringInvoiceProjection } from "../../invoice-recurring";
import type { ReportsResultItem } from "../core";
import { getRevenue } from "../core";
import {
  getExcludedCategorySlugs,
  getReportInvoiceDateAggregateRows,
  getReportTransactionRecurringAggregateRows,
  getRecurringMonthlyEquivalent,
} from "../shared";
import type { GetRevenueForecastParams, RecurringTransactionProjection } from "./types";

export async function getRecurringTransactionProjection(
  db: Database,
  params: { teamId: string; forecastMonths: number; currency?: string },
): Promise<RecurringTransactionProjection> {
  const { teamId, forecastMonths, currency } = params;
  const excludedCategorySlugs = getExcludedCategorySlugs();
  const sixMonthsAgo = format(subMonths(new Date(), 6), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");
  const aggregateData = await getReportTransactionRecurringAggregateRows(db, {
    teamId,
    direction: "income",
    from: sixMonthsAgo,
    to: today,
    inputCurrency: currency,
  });

  const recurringByName = new Map<
    string,
    {
      amount: number;
      frequency: string | null;
      lastDate: string;
      lastCreatedAt: string;
    }
  >();

  for (const row of aggregateData.rows) {
    const slug = row.categorySlug;

    if (slug !== null && excludedCategorySlugs.includes(slug)) {
      continue;
    }

    const existing = recurringByName.get(row.name);
    const shouldReplace =
      !existing ||
      row.date > existing.lastDate ||
      (row.date === existing.lastDate && row.latestTransactionCreatedAt > existing.lastCreatedAt);

    if (!shouldReplace) {
      continue;
    }

    recurringByName.set(row.name, {
      amount: row.latestAmount,
      frequency: row.frequency,
      lastDate: row.date,
      lastCreatedAt: row.latestTransactionCreatedAt,
    });
  }

  const projection: RecurringTransactionProjection = new Map();
  const currentDate = new UTCDate();

  for (let i = 1; i <= forecastMonths; i++) {
    const monthKey = format(addMonths(currentDate, i), "yyyy-MM");
    let monthTotal = 0;
    let count = 0;

    for (const [, recurring] of recurringByName) {
      const monthlyAmount = getRecurringMonthlyEquivalent(recurring.amount, recurring.frequency);

      monthTotal += monthlyAmount;
      count++;
    }

    projection.set(monthKey, { amount: monthTotal, count });
  }

  return projection;
}

function calculateWeightedMedian(values: number[], weights: number[]): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0] ?? 0;

  const pairs = values.map((value, index) => ({
    value,
    weight: weights[index] ?? 1,
  }));
  pairs.sort((left, right) => left.value - right.value);

  const totalWeight = pairs.reduce((sum, pair) => sum + pair.weight, 0);
  const midWeight = totalWeight / 2;

  let cumulativeWeight = 0;
  for (const pair of pairs) {
    cumulativeWeight += pair.weight;
    if (cumulativeWeight >= midWeight) {
      return pair.value;
    }
  }

  return pairs[pairs.length - 1]?.value ?? 0;
}

export async function getHistoricalRecurringInvoiceAverage(
  db: Database,
  params: {
    teamId: string;
    currency?: string;
  },
): Promise<number> {
  const { teamId, currency } = params;

  const sixMonthsAgo = format(subMonths(new Date(), 6), "yyyy-MM-dd");
  const aggregateRows = await getReportInvoiceDateAggregateRows(db, {
    teamId,
    inputCurrency: currency,
    statuses: ["paid"],
    dateField: "paidAt",
    from: sixMonthsAgo,
    recurring: true,
  });

  if (aggregateRows) {
    const monthlyTotals = new Map<string, number>();

    for (const row of aggregateRows) {
      if (!row.totalAmount) {
        continue;
      }

      const monthKey = format(parseISO(row.date), "yyyy-MM");
      monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) || 0) + row.totalAmount);
    }

    if (monthlyTotals.size === 0) {
      return 0;
    }

    const totalRevenue = Array.from(monthlyTotals.values()).reduce((sum, value) => sum + value, 0);
    return totalRevenue / monthlyTotals.size;
  }

  return 0;
}

export async function calculateNonRecurringBaseline(
  db: Database,
  params: {
    teamId: string;
    currency?: string;
    recurringTxMonthlyAvg: number;
    recurringInvoiceMonthlyAvg: number;
  },
): Promise<number> {
  const { teamId, currency, recurringTxMonthlyAvg, recurringInvoiceMonthlyAvg } = params;

  const sixMonthsAgo = format(subMonths(new Date(), 6), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");

  const historicalRevenue = await getRevenue(db, {
    teamId,
    from: sixMonthsAgo,
    to: today,
    currency,
    revenueType: "net",
  });

  if (historicalRevenue.length === 0) {
    return 0;
  }

  const totalRecurringMonthlyAvg = recurringTxMonthlyAvg + recurringInvoiceMonthlyAvg;

  const nonRecurringValues = historicalRevenue.map((month: ReportsResultItem) =>
    Math.max(0, Number.parseFloat(month.value) - totalRecurringMonthlyAvg),
  );

  const weights = nonRecurringValues.map((_, index) => 0.5 + index * 0.1);

  return calculateWeightedMedian(nonRecurringValues, weights);
}

export async function getForecastRevenueInputs(
  db: Database,
  params: Pick<
    GetRevenueForecastParams,
    "teamId" | "from" | "to" | "forecastMonths" | "currency" | "revenueType"
  >,
) {
  const { teamId, from, to, forecastMonths, currency: inputCurrency, revenueType = "net" } = params;

  const historicalData = await getRevenue(db, {
    teamId,
    from,
    to,
    currency: inputCurrency,
    revenueType,
  });

  const recurringInvoiceData = await getRecurringInvoiceProjection(db, {
    teamId,
    forecastMonths,
    currency: inputCurrency,
  });
  const recurringTransactionData = await getRecurringTransactionProjection(db, {
    teamId,
    forecastMonths,
    currency: inputCurrency,
  });

  let recurringTxMonthlyAvg = 0;
  for (const [, data] of recurringTransactionData) {
    recurringTxMonthlyAvg = data.amount;
    break;
  }

  const recurringInvoiceMonthlyAvg = await getHistoricalRecurringInvoiceAverage(db, {
    teamId,
    currency: inputCurrency,
  });

  const nonRecurringBaseline = await calculateNonRecurringBaseline(db, {
    teamId,
    currency: inputCurrency,
    recurringTxMonthlyAvg,
    recurringInvoiceMonthlyAvg,
  });

  return {
    historicalData,
    recurringInvoiceData,
    recurringTransactionData,
    recurringInvoiceMonthlyAvg,
    recurringTxMonthlyAvg,
    nonRecurringBaseline,
  };
}
