import { UTCDate } from "@date-fns/utc";
import { getCategoryColor } from "@tamias/categories";
import { getInvoiceAggregateRowsFromConvex } from "@tamias/app-data-convex";
import {
  eachMonthOfInterval,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  subMonths,
  subYears,
} from "date-fns";
import type { Database } from "../../client";
import { cacheAcrossRequests } from "../../utils/short-lived-cache";
import { getCashBalance } from "../bank-accounts";
import { getProfit, getRevenue } from "./core";
import {
  buildMonthlyAggregateSeriesMap,
  buildMonthlySeriesMap,
  getCategoryInfo,
  getExcludedCategorySlugs,
  getMonthBucket,
  getRecurringMonthlyEquivalent,
  getReportTransactionAggregateRows,
  getReportInvoices,
  getReportTransactionRecurringAggregateRows,
  getReportTransactionAmounts,
  getResolvedTransactionTaxRate,
  getResolvedTransactionTaxType,
  getTargetCurrency,
  humanizeCategorySlug,
  normalizeRecurringFrequency,
  roundMoney,
} from "./shared";

function serializeMetricRangeParams(params: {
  teamId: string;
  from: string;
  to: string;
  currency?: string;
  exactDates?: boolean;
}) {
  return [
    params.teamId,
    params.from,
    params.to,
    params.currency ?? "",
    params.exactDates ?? false,
  ].join(":");
}

export type GetBurnRateParams = {
  teamId: string;
  from: string;
  to: string;
  currency?: string;
};

interface BurnRateResultItem {
  value: string;
  date: string;
  currency: string;
}

async function getBurnRateImpl(db: Database, params: GetBurnRateParams) {
  const { teamId, from, to, currency: inputCurrency } = params;

  const fromDate = startOfMonth(new UTCDate(parseISO(from)));
  const toDate = endOfMonth(new UTCDate(parseISO(to)));

  const excludedCategorySlugs = getExcludedCategorySlugs();
  const aggregateData = await getReportTransactionAggregateRows(db, {
    teamId,
    from: format(fromDate, "yyyy-MM-dd"),
    to: format(toDate, "yyyy-MM-dd"),
    inputCurrency,
  });
  const monthSeries = eachMonthOfInterval({ start: fromDate, end: toDate });
  let targetCurrency: string | null = aggregateData?.targetCurrency ?? null;
  let dataMap: Map<string, number>;

  if (aggregateData) {
    dataMap = buildMonthlyAggregateSeriesMap(
      aggregateData.rows.filter((row) => {
        const slug = row.categorySlug;

        return (
          row.direction === "expense" &&
          (slug === null || !excludedCategorySlugs.includes(slug))
        );
      }),
      (row) => Math.abs(row.totalAmount),
    );
  } else {
    const reportTransactionData = await getReportTransactionAmounts(db, {
      teamId,
      from: format(fromDate, "yyyy-MM-dd"),
      to: format(toDate, "yyyy-MM-dd"),
      inputCurrency,
    });

    targetCurrency = reportTransactionData.targetCurrency;
    dataMap = buildMonthlySeriesMap(
      reportTransactionData.amounts.filter((row) => {
        const slug = row.transaction.categorySlug;

        return (
          row.amount < 0 &&
          (slug === null || !excludedCategorySlugs.includes(slug))
        );
      }),
      (row) => Math.abs(row.amount),
    );
  }

  const results: BurnRateResultItem[] = monthSeries.map((monthStart) => {
    const monthKey = format(monthStart, "yyyy-MM-dd");
    const value = dataMap.get(monthKey) || 0;

    return {
      date: monthKey,
      value: value.toString(),
      currency: targetCurrency || "USD",
    };
  });

  return results.map((item) => ({
    ...item,
    value: Number.parseFloat(item.value),
  }));
}

export const getBurnRate = cacheAcrossRequests({
  keyPrefix: "burn-rate",
  keyFn: serializeMetricRangeParams,
  load: getBurnRateImpl,
});

export type GetExpensesParams = {
  teamId: string;
  from: string;
  to: string;
  currency?: string;
  /** When true, use exact dates instead of expanding to month boundaries. Useful for weekly insights. */
  exactDates?: boolean;
};

interface ExpensesResultItem {
  value: string;
  date: string;
  currency: string;
  recurring_value?: number;
}

async function getExpensesImpl(db: Database, params: GetExpensesParams) {
  const {
    teamId,
    from,
    to,
    currency: inputCurrency,
    exactDates = false,
  } = params;

  const fromDate = exactDates
    ? new UTCDate(parseISO(from))
    : startOfMonth(new UTCDate(parseISO(from)));
  const toDate = exactDates
    ? new UTCDate(parseISO(to))
    : endOfMonth(new UTCDate(parseISO(to)));

  const excludedCategorySlugs = getExcludedCategorySlugs();
  const aggregateData = await getReportTransactionAggregateRows(db, {
    teamId,
    from: format(fromDate, "yyyy-MM-dd"),
    to: format(toDate, "yyyy-MM-dd"),
    inputCurrency,
  });
  const monthSeries = eachMonthOfInterval({ start: fromDate, end: toDate });
  const dataMap = new Map<string, { value: number; recurringValue: number }>();
  let targetCurrency: string | null = aggregateData?.targetCurrency ?? null;

  if (aggregateData) {
    for (const row of aggregateData.rows.filter((aggregateRow) => {
      const slug = aggregateRow.categorySlug;

      return (
        aggregateRow.direction === "expense" &&
        (slug === null || !excludedCategorySlugs.includes(slug))
      );
    })) {
      const month = getMonthBucket(row.date);
      const current = dataMap.get(month) ?? { value: 0, recurringValue: 0 };
      const value = Math.abs(row.totalAmount);

      if (row.recurring) {
        current.recurringValue = roundMoney(current.recurringValue + value);
      } else {
        current.value = roundMoney(current.value + value);
      }

      dataMap.set(month, current);
    }
  } else {
    const reportTransactionData = await getReportTransactionAmounts(db, {
      teamId,
      from: format(fromDate, "yyyy-MM-dd"),
      to: format(toDate, "yyyy-MM-dd"),
      inputCurrency,
    });

    targetCurrency = reportTransactionData.targetCurrency;

    for (const row of reportTransactionData.amounts.filter((amountRow) => {
      const slug = amountRow.transaction.categorySlug;

      return (
        amountRow.amount < 0 &&
        (slug === null || !excludedCategorySlugs.includes(slug))
      );
    })) {
      const month = getMonthBucket(row.transaction.date);
      const current = dataMap.get(month) ?? { value: 0, recurringValue: 0 };
      const value = Math.abs(row.amount);

      if (row.transaction.recurring) {
        current.recurringValue = roundMoney(current.recurringValue + value);
      } else {
        current.value = roundMoney(current.value + value);
      }

      dataMap.set(month, current);
    }
  }

  const rawData: ExpensesResultItem[] = monthSeries.map((monthStart) => {
    const monthKey = format(monthStart, "yyyy-MM-dd");
    const monthData = dataMap.get(monthKey) || {
      value: 0,
      recurringValue: 0,
    };

    return {
      date: monthKey,
      value: monthData.value.toString(),
      currency: targetCurrency || "USD",
      recurring_value: monthData.recurringValue,
    };
  });

  const averageExpense =
    rawData && rawData.length > 0
      ? Number(
          (
            rawData.reduce(
              (sum, item) => sum + Number.parseFloat(item.value || "0"),
              0,
            ) / rawData.length
          ).toFixed(2),
        )
      : 0;

  return {
    summary: {
      averageExpense,
      currency: rawData?.at(0)?.currency ?? inputCurrency,
    },
    meta: {
      type: "expense",
      currency: rawData?.at(0)?.currency ?? inputCurrency,
    },
    result: rawData?.map((item) => {
      const value = Number.parseFloat(
        Number.parseFloat(item.value || "0").toFixed(2),
      );
      const recurring = Number.parseFloat(
        Number.parseFloat(
          item.recurring_value !== undefined
            ? String(item.recurring_value)
            : "0",
        ).toFixed(2),
      );
      return {
        date: item.date,
        value,
        currency: item.currency,
        recurring,
        total: Number((value + recurring).toFixed(2)),
      };
    }),
  };
}

export const getExpenses = cacheAcrossRequests({
  keyPrefix: "expenses",
  keyFn: serializeMetricRangeParams,
  load: getExpensesImpl,
});

export type GetSpendingParams = {
  teamId: string;
  from: string;
  to: string;
  currency?: string;
};

interface SpendingResultItem {
  name: string;
  slug: string;
  amount: number;
  currency: string;
  color: string;
  percentage: number;
}

async function getSpendingImpl(
  db: Database,
  params: GetSpendingParams,
): Promise<SpendingResultItem[]> {
  const { teamId, from, to, currency: inputCurrency } = params;

  const fromDate = startOfMonth(new UTCDate(parseISO(from)));
  const toDate = endOfMonth(new UTCDate(parseISO(to)));

  const excludedCategorySlugs = getExcludedCategorySlugs();
  const aggregateData = await getReportTransactionAggregateRows(db, {
    teamId,
    from: format(fromDate, "yyyy-MM-dd"),
    to: format(toDate, "yyyy-MM-dd"),
    inputCurrency,
  });
  let targetCurrency: string | null = aggregateData?.targetCurrency ?? null;
  let totalAmount = 0;
  const categoryTotals = new Map<string, number>();
  let uncategorizedAmount = 0;

  if (aggregateData) {
    for (const row of aggregateData.rows.filter(
      (aggregateRow) => aggregateRow.direction === "expense",
    )) {
      const slug = row.categorySlug;
      const amount = Math.abs(row.totalAmount);

      if (slug && excludedCategorySlugs.includes(slug)) {
        uncategorizedAmount = roundMoney(uncategorizedAmount + amount);
        continue;
      }

      totalAmount = roundMoney(totalAmount + amount);

      if (!slug) {
        uncategorizedAmount = roundMoney(uncategorizedAmount + amount);
        continue;
      }

      categoryTotals.set(
        slug,
        roundMoney((categoryTotals.get(slug) ?? 0) + amount),
      );
    }
  } else {
    const reportTransactionData = await getReportTransactionAmounts(db, {
      teamId,
      from: format(fromDate, "yyyy-MM-dd"),
      to: format(toDate, "yyyy-MM-dd"),
      inputCurrency,
    });

    targetCurrency = reportTransactionData.targetCurrency;
    for (const row of reportTransactionData.amounts.filter(
      (amountRow) => amountRow.amount < 0,
    )) {
      const slug = row.transaction.categorySlug;
      const amount = Math.abs(row.amount);

      if (slug && excludedCategorySlugs.includes(slug)) {
        uncategorizedAmount = roundMoney(uncategorizedAmount + amount);
        continue;
      }

      totalAmount = roundMoney(totalAmount + amount);

      if (!slug) {
        uncategorizedAmount = roundMoney(uncategorizedAmount + amount);
        continue;
      }

      categoryTotals.set(
        slug,
        roundMoney((categoryTotals.get(slug) ?? 0) + amount),
      );
    }
  }

  const categorySpending = [...categoryTotals.entries()].map(
    ([slug, amount]) => {
      const categoryInfo = getCategoryInfo(slug, null);
      const percentage = totalAmount !== 0 ? (amount / totalAmount) * 100 : 0;

      return {
        name: categoryInfo?.name || humanizeCategorySlug(slug),
        slug,
        amount,
        currency: targetCurrency || "USD",
        color: categoryInfo?.color || getCategoryColor(slug),
        percentage:
          percentage > 1
            ? Math.round(percentage)
            : Math.round(percentage * 100) / 100,
      };
    },
  );

  if (uncategorizedAmount > 0) {
    const percentage =
      totalAmount !== 0 ? (uncategorizedAmount / totalAmount) * 100 : 0;

    categorySpending.push({
      name: "Uncategorized",
      slug: "uncategorized",
      amount: uncategorizedAmount,
      currency: targetCurrency || "USD",
      color: "#606060",
      percentage:
        percentage > 1
          ? Math.round(percentage)
          : Math.round(percentage * 100) / 100,
    });
  }

  return categorySpending
    .sort((a, b) => b.amount - a.amount)
    .map((item) => ({
      ...item,
      amount: Number.parseFloat(Number(item.amount).toFixed(2)),
      percentage: Number.parseFloat(Number(item.percentage).toFixed(2)),
    }));
}

export const getSpending = cacheAcrossRequests({
  keyPrefix: "spending",
  keyFn: serializeMetricRangeParams,
  load: getSpendingImpl,
});

export type GetRunwayParams = {
  teamId: string;
  currency?: string;
};

async function getRunwayImpl(db: Database, params: GetRunwayParams) {
  const { teamId, currency: inputCurrency } = params;

  const toDate = endOfMonth(new UTCDate());
  const fromDate = startOfMonth(subMonths(toDate, 5));

  const burnRateFrom = format(fromDate, "yyyy-MM-dd");
  const burnRateTo = format(toDate, "yyyy-MM-dd");

  const targetCurrency = await getTargetCurrency(db, teamId, inputCurrency);

  if (!targetCurrency) {
    return 0;
  }

  const [cashBalance, burnRateData] = await Promise.all([
    getCashBalance(db, {
      teamId,
      currency: targetCurrency,
    }),
    getBurnRate(db, {
      teamId,
      from: burnRateFrom,
      to: burnRateTo,
      currency: inputCurrency,
    }),
  ]);

  const totalBalance = cashBalance.totalBalance || 0;
  if (burnRateData.length === 0) {
    return 0;
  }

  const totalBurnRate = burnRateData.reduce((sum, item) => sum + item.value, 0);
  const avgBurnRate = Math.round(totalBurnRate / burnRateData.length);

  if (avgBurnRate === 0) {
    return 0;
  }

  return Math.round(totalBalance / avgBurnRate);
}

export const getRunway = cacheAcrossRequests({
  keyPrefix: "runway",
  keyFn: (params: GetRunwayParams) =>
    [params.teamId, params.currency ?? ""].join(":"),
  load: getRunwayImpl,
});

export type GetSpendingForPeriodParams = {
  teamId: string;
  from: string;
  to: string;
  currency?: string;
  /** When true, use exact dates instead of expanding to month boundaries. Useful for weekly insights. */
  exactDates?: boolean;
};

async function getSpendingForPeriodImpl(
  db: Database,
  params: GetSpendingForPeriodParams,
) {
  const {
    teamId,
    from,
    to,
    currency: inputCurrency,
    exactDates = false,
  } = params;

  const expensesData = await getExpenses(db, {
    teamId,
    from,
    to,
    currency: inputCurrency,
    exactDates,
  });

  const totalSpending = expensesData.result.reduce(
    (sum, item) => sum + item.total,
    0,
  );

  const currency = expensesData.meta.currency || inputCurrency || "USD";

  const spendingCategories = await getSpending(db, {
    teamId,
    from,
    to,
    currency: inputCurrency,
  });

  const topCategory = spendingCategories[0] || null;

  return {
    totalSpending: Math.round(totalSpending * 100) / 100,
    currency,
    topCategory: topCategory
      ? {
          name: topCategory.name,
          amount:
            Math.round(((totalSpending * topCategory.percentage) / 100) * 100) /
            100,
          percentage: topCategory.percentage,
        }
      : null,
  };
}

export const getSpendingForPeriod = cacheAcrossRequests({
  keyPrefix: "spending-for-period",
  keyFn: serializeMetricRangeParams,
  load: getSpendingForPeriodImpl,
});

export type GetTaxParams = {
  teamId: string;
  type: "paid" | "collected";
  from: string;
  to: string;
  categorySlug?: string;
  taxType?: string;
  currency?: string;
};

async function getTaxSummaryImpl(db: Database, params: GetTaxParams) {
  const {
    teamId,
    type,
    from,
    to,
    categorySlug,
    taxType,
    currency: inputCurrency,
  } = params;

  const fromDate = format(
    startOfMonth(new UTCDate(parseISO(from))),
    "yyyy-MM-dd",
  );
  const toDate = format(endOfMonth(new UTCDate(parseISO(to))), "yyyy-MM-dd");
  const excludedCategorySlugs = getExcludedCategorySlugs();
  const { countryCode, targetCurrency, amounts } =
    await getReportTransactionAmounts(db, {
      teamId,
      from: fromDate,
      to: toDate,
      inputCurrency,
    });
  const grouped = new Map<
    string,
    {
      category_slug: string;
      total_tax_amount: number;
      total_transaction_amount: number;
      transaction_count: number;
      total_tax_rate: number;
      tax_type: string | null;
      currency: string | null;
      earliest_date: string;
      latest_date: string;
    }
  >();

  for (const row of amounts) {
    const slug = row.transaction.categorySlug;

    if (slug && excludedCategorySlugs.includes(slug)) {
      continue;
    }

    if (categorySlug && slug !== categorySlug) {
      continue;
    }

    if (type === "paid" ? row.amount >= 0 : row.amount <= 0) {
      continue;
    }

    const resolvedTaxType = getResolvedTransactionTaxType(
      row.transaction,
      countryCode,
    );

    if (taxType && resolvedTaxType !== taxType) {
      continue;
    }

    const resolvedTaxRate = getResolvedTransactionTaxRate(
      row.transaction,
      countryCode,
    );
    const resolvedSlug = slug ?? "uncategorized";
    const resolvedCurrency =
      targetCurrency ??
      inputCurrency ??
      row.transaction.baseCurrency ??
      row.transaction.currency;
    const key = `${resolvedSlug}:${resolvedTaxType ?? ""}:${resolvedCurrency ?? ""}`;
    const existing = grouped.get(key);
    const taxAmount =
      resolvedTaxRate > 0
        ? Math.abs((row.amount * resolvedTaxRate) / (100 + resolvedTaxRate))
        : 0;

    if (existing) {
      existing.total_tax_amount += taxAmount;
      existing.total_transaction_amount += Math.abs(row.amount);
      existing.transaction_count += 1;
      existing.total_tax_rate += resolvedTaxRate;
      if (row.transaction.date < existing.earliest_date) {
        existing.earliest_date = row.transaction.date;
      }
      if (row.transaction.date > existing.latest_date) {
        existing.latest_date = row.transaction.date;
      }
      continue;
    }

    grouped.set(key, {
      category_slug: resolvedSlug,
      total_tax_amount: taxAmount,
      total_transaction_amount: Math.abs(row.amount),
      transaction_count: 1,
      total_tax_rate: resolvedTaxRate,
      tax_type: resolvedTaxType,
      currency: resolvedCurrency,
      earliest_date: row.transaction.date,
      latest_date: row.transaction.date,
    });
  }

  const processedData = Array.from(grouped.values())
    .map((item) => ({
      category_slug: item.category_slug,
      category_name:
        getCategoryInfo(item.category_slug, countryCode)?.name ??
        humanizeCategorySlug(item.category_slug),
      total_tax_amount: roundMoney(item.total_tax_amount),
      total_transaction_amount: roundMoney(item.total_transaction_amount),
      transaction_count: item.transaction_count,
      avg_tax_rate: roundMoney(item.total_tax_rate / item.transaction_count),
      tax_type: item.tax_type,
      currency: item.currency,
      earliest_date: item.earliest_date,
      latest_date: item.latest_date,
    }))
    .sort((left, right) => right.total_tax_amount - left.total_tax_amount);

  const totalTaxAmount = Number(
    (
      processedData?.reduce((sum, item) => sum + item.total_tax_amount, 0) ?? 0
    ).toFixed(2),
  );

  const totalTransactionAmount = Number(
    (
      processedData?.reduce(
        (sum, item) => sum + item.total_transaction_amount,
        0,
      ) ?? 0
    ).toFixed(2),
  );

  const totalTransactions =
    processedData?.reduce((sum, item) => sum + item.transaction_count, 0) ?? 0;

  return {
    summary: {
      totalTaxAmount,
      totalTransactionAmount,
      totalTransactions,
      categoryCount: processedData?.length ?? 0,
      type,
      currency: processedData?.at(0)?.currency ?? inputCurrency,
    },
    meta: {
      type: "tax",
      taxType: type,
      currency: processedData?.at(0)?.currency ?? inputCurrency,
      period: {
        from,
        to,
      },
    },
    result: processedData,
  };
}

export const getTaxSummary = cacheAcrossRequests({
  keyPrefix: "tax-summary",
  keyFn: (params: GetTaxParams) =>
    [
      params.teamId,
      params.type,
      params.from,
      params.to,
      params.categorySlug ?? "",
      params.taxType ?? "",
      params.currency ?? "",
    ].join(":"),
  load: getTaxSummaryImpl,
});

export type GetGrowthRateParams = {
  teamId: string;
  from: string;
  to: string;
  currency?: string;
  type?: "revenue" | "profit";
  revenueType?: "gross" | "net";
  period?: "quarterly" | "monthly" | "yearly";
};

async function getGrowthRateImpl(db: Database, params: GetGrowthRateParams) {
  const {
    teamId,
    from,
    to,
    currency: inputCurrency,
    type = "revenue",
    revenueType = "net",
    period = "quarterly",
  } = params;

  const fromDate = startOfMonth(new UTCDate(parseISO(from)));
  const toDate = endOfMonth(new UTCDate(parseISO(to)));

  let prevFromDate: UTCDate;
  let prevToDate: UTCDate;

  switch (period) {
    case "quarterly":
      prevFromDate = startOfMonth(new UTCDate(fromDate.getTime()));
      prevFromDate.setMonth(prevFromDate.getMonth() - 3);
      prevToDate = endOfMonth(new UTCDate(toDate.getTime()));
      prevToDate.setMonth(prevToDate.getMonth() - 3);
      break;
    case "yearly":
      prevFromDate = subYears(fromDate, 1);
      prevToDate = subYears(toDate, 1);
      break;
    default:
      prevFromDate = startOfMonth(new UTCDate(fromDate.getTime()));
      prevFromDate.setMonth(prevFromDate.getMonth() - 1);
      prevToDate = endOfMonth(new UTCDate(toDate.getTime()));
      prevToDate.setMonth(prevToDate.getMonth() - 1);
      break;
  }

  const dataFunction = type === "profit" ? getProfit : getRevenue;

  const [targetCurrency, currentData, previousData] = await Promise.all([
    getTargetCurrency(db, teamId, inputCurrency),
    dataFunction(db, {
      teamId,
      from,
      to,
      currency: inputCurrency,
      revenueType,
    }),
    dataFunction(db, {
      teamId,
      from: prevFromDate.toISOString(),
      to: prevToDate.toISOString(),
      currency: inputCurrency,
      revenueType,
    }),
  ]);

  const currentTotal = currentData.reduce(
    (sum, item) => sum + Number.parseFloat(item.value),
    0,
  );
  const previousTotal = previousData.reduce(
    (sum, item) => sum + Number.parseFloat(item.value),
    0,
  );

  let growthRate = 0;
  if (previousTotal > 0) {
    growthRate = ((currentTotal - previousTotal) / previousTotal) * 100;
  }

  let periodGrowthRate = 0;
  if (period === "quarterly") {
    periodGrowthRate = growthRate;
  } else {
    const recentMonths = Math.min(3, currentData.length);
    const recentCurrent = currentData
      .slice(-recentMonths)
      .reduce((sum, item) => sum + Number.parseFloat(item.value), 0);
    const recentPrevious = previousData
      .slice(-recentMonths)
      .reduce((sum, item) => sum + Number.parseFloat(item.value), 0);

    if (recentPrevious > 0) {
      periodGrowthRate =
        ((recentCurrent - recentPrevious) / recentPrevious) * 100;
    }
  }

  const trend =
    periodGrowthRate > 0
      ? "positive"
      : periodGrowthRate < 0
        ? "negative"
        : "neutral";

  return {
    summary: {
      currentTotal: Number(currentTotal.toFixed(2)),
      previousTotal: Number(previousTotal.toFixed(2)),
      growthRate: Number(growthRate.toFixed(2)),
      periodGrowthRate: Number(periodGrowthRate.toFixed(2)),
      currency: targetCurrency || "USD",
      trend,
      period,
      type,
      revenueType,
    },
    meta: {
      type: "growth_rate",
      period,
      currency: targetCurrency || "USD",
      dateRange: {
        current: { from, to },
        previous: {
          from: prevFromDate.toISOString(),
          to: prevToDate.toISOString(),
        },
      },
    },
    result: {
      current: {
        total: Number(currentTotal.toFixed(2)),
        period: { from, to },
        data: currentData.map((item) => ({
          date: item.date,
          value: Number.parseFloat(item.value),
          currency: item.currency,
        })),
      },
      previous: {
        total: Number(previousTotal.toFixed(2)),
        period: {
          from: prevFromDate.toISOString(),
          to: prevToDate.toISOString(),
        },
        data: previousData.map((item) => ({
          date: item.date,
          value: Number.parseFloat(item.value),
          currency: item.currency,
        })),
      },
    },
  };
}

export const getGrowthRate = cacheAcrossRequests({
  keyPrefix: "growth-rate",
  keyFn: (params: GetGrowthRateParams) =>
    [
      params.teamId,
      params.from,
      params.to,
      params.currency ?? "",
      params.type ?? "revenue",
      params.revenueType ?? "net",
      params.period ?? "quarterly",
    ].join(":"),
  load: getGrowthRateImpl,
});

export type GetProfitMarginParams = {
  teamId: string;
  from: string;
  to: string;
  currency?: string;
  revenueType?: "gross" | "net";
};

async function getProfitMarginImpl(
  db: Database,
  params: GetProfitMarginParams,
) {
  const {
    teamId,
    from,
    to,
    currency: inputCurrency,
    revenueType = "net",
  } = params;

  const targetCurrency = await getTargetCurrency(db, teamId, inputCurrency);

  const [revenueData, profitData] = await Promise.all([
    getRevenue(db, {
      teamId,
      from,
      to,
      currency: inputCurrency,
      revenueType: "net",
    }),
    getProfit(db, {
      teamId,
      from,
      to,
      currency: inputCurrency,
      revenueType,
    }),
  ]);

  const totalRevenue = revenueData.reduce(
    (sum, item) => sum + Number.parseFloat(item.value),
    0,
  );
  const totalProfit = profitData.reduce(
    (sum, item) => sum + Number.parseFloat(item.value),
    0,
  );

  let profitMargin = 0;
  if (totalRevenue > 0) {
    profitMargin = (totalProfit / totalRevenue) * 100;
  }

  const monthlyMargins = revenueData.map((revenueItem, index) => {
    const profitItem = profitData[index];
    const monthRevenue = Number.parseFloat(revenueItem.value);
    const monthProfit = profitItem ? Number.parseFloat(profitItem.value) : 0;

    let monthMargin = 0;
    if (monthRevenue > 0) {
      monthMargin = (monthProfit / monthRevenue) * 100;
    }

    return {
      date: revenueItem.date,
      revenue: monthRevenue,
      profit: monthProfit,
      margin: Number(monthMargin.toFixed(2)),
      currency: revenueItem.currency,
    };
  });

  const avgMargin =
    monthlyMargins.length > 0
      ? monthlyMargins.reduce((sum, item) => sum + item.margin, 0) /
        monthlyMargins.length
      : 0;

  let trend: "positive" | "negative" | "neutral" = "neutral";
  if (monthlyMargins.length >= 2) {
    const firstMonth = monthlyMargins[0];
    const lastMonth = monthlyMargins[monthlyMargins.length - 1];
    if (firstMonth && lastMonth) {
      const firstMargin = firstMonth.margin;
      const lastMargin = lastMonth.margin;
      trend =
        lastMargin > firstMargin
          ? "positive"
          : lastMargin < firstMargin
            ? "negative"
            : "neutral";
    }
  }

  return {
    summary: {
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalProfit: Number(totalProfit.toFixed(2)),
      profitMargin: Number(profitMargin.toFixed(2)),
      averageMargin: Number(avgMargin.toFixed(2)),
      currency: targetCurrency || "USD",
      revenueType,
      trend,
      monthCount: monthlyMargins.length,
    },
    meta: {
      type: "profit_margin",
      currency: targetCurrency || "USD",
      revenueType,
      period: {
        from,
        to,
      },
    },
    result: monthlyMargins,
  };
}

export const getProfitMargin = cacheAcrossRequests({
  keyPrefix: "profit-margin",
  keyFn: (params: GetProfitMarginParams) =>
    [
      params.teamId,
      params.from,
      params.to,
      params.currency ?? "",
      params.revenueType ?? "net",
    ].join(":"),
  load: getProfitMarginImpl,
});

export type GetCashFlowParams = {
  teamId: string;
  from: string;
  to: string;
  currency?: string;
  period?: "monthly" | "quarterly";
  /** When true, use exact dates instead of expanding to month boundaries. Useful for weekly insights. */
  exactDates?: boolean;
};

async function getCashFlowImpl(db: Database, params: GetCashFlowParams) {
  const {
    teamId,
    from,
    to,
    currency: inputCurrency,
    period = "monthly",
    exactDates = false,
  } = params;

  const fromDate = exactDates
    ? new UTCDate(parseISO(from))
    : startOfMonth(new UTCDate(parseISO(from)));
  const toDate = exactDates
    ? new UTCDate(parseISO(to))
    : endOfMonth(new UTCDate(parseISO(to)));

  const excludedCategorySlugs = getExcludedCategorySlugs();
  const aggregateData = await getReportTransactionAggregateRows(db, {
    teamId,
    from: format(fromDate, "yyyy-MM-dd"),
    to: format(toDate, "yyyy-MM-dd"),
    inputCurrency,
  });
  const monthlyData = new Map<string, { income: number; expenses: number }>();
  let targetCurrency: string | null = aggregateData?.targetCurrency ?? null;

  if (aggregateData) {
    for (const row of aggregateData.rows) {
      const slug = row.categorySlug;

      if (slug && excludedCategorySlugs.includes(slug)) {
        continue;
      }

      const month = getMonthBucket(row.date);
      const current = monthlyData.get(month) ?? { income: 0, expenses: 0 };
      const amount = row.totalAmount;

      if (row.direction === "income" && amount > 0) {
        current.income = roundMoney(current.income + amount);
      } else if (row.direction === "expense" && amount < 0) {
        current.expenses = roundMoney(current.expenses + Math.abs(amount));
      }

      monthlyData.set(month, current);
    }
  } else {
    const reportTransactionData = await getReportTransactionAmounts(db, {
      teamId,
      from: format(fromDate, "yyyy-MM-dd"),
      to: format(toDate, "yyyy-MM-dd"),
      inputCurrency,
    });

    targetCurrency = reportTransactionData.targetCurrency;

    for (const row of reportTransactionData.amounts) {
      const slug = row.transaction.categorySlug;

      if (slug && excludedCategorySlugs.includes(slug)) {
        continue;
      }

      const month = getMonthBucket(row.transaction.date);
      const current = monthlyData.get(month) ?? { income: 0, expenses: 0 };
      const amount = row.amount;

      if (amount > 0) {
        current.income = roundMoney(current.income + amount);
      } else if (amount < 0) {
        current.expenses = roundMoney(current.expenses + Math.abs(amount));
      }

      monthlyData.set(month, current);
    }
  }

  const monthSeries = eachMonthOfInterval({ start: fromDate, end: toDate });

  const completeMonthlyData = monthSeries.map((monthStart) => {
    const monthKey = format(monthStart, "yyyy-MM-dd");
    const monthData = monthlyData.get(monthKey) || { income: 0, expenses: 0 };
    const netCashFlow = monthData.income - monthData.expenses;

    return {
      month: format(monthStart, "MMM"),
      date: monthKey,
      income: Number(monthData.income.toFixed(2)),
      expenses: Number(monthData.expenses.toFixed(2)),
      netCashFlow: Number(netCashFlow.toFixed(2)),
    };
  });

  const totalIncome = completeMonthlyData.reduce(
    (sum, item) => sum + item.income,
    0,
  );
  const totalExpenses = completeMonthlyData.reduce(
    (sum, item) => sum + item.expenses,
    0,
  );
  const netCashFlow = totalIncome - totalExpenses;
  const averageMonthlyCashFlow =
    completeMonthlyData.length > 0
      ? netCashFlow / completeMonthlyData.length
      : 0;

  return {
    summary: {
      netCashFlow: Number(netCashFlow.toFixed(2)),
      totalIncome: Number(totalIncome.toFixed(2)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      averageMonthlyCashFlow: Number(averageMonthlyCashFlow.toFixed(2)),
      currency: targetCurrency || "USD",
      period,
    },
    monthlyData: completeMonthlyData,
    meta: {
      type: "cash_flow",
      currency: targetCurrency || "USD",
      period: {
        from,
        to,
      },
    },
  };
}

export const getCashFlow = cacheAcrossRequests({
  keyPrefix: "cash-flow",
  keyFn: (params: GetCashFlowParams) =>
    [
      params.teamId,
      params.from,
      params.to,
      params.currency ?? "",
      params.period ?? "monthly",
      params.exactDates ?? false,
    ].join(":"),
  load: getCashFlowImpl,
});

export type GetOutstandingInvoicesParams = {
  teamId: string;
  currency?: string;
  status?: ("unpaid" | "overdue")[];
};

export type GetOverdueInvoicesAlertParams = {
  teamId: string;
  currency?: string;
};

async function getOverdueInvoicesAlertImpl(
  db: Database,
  params: GetOverdueInvoicesAlertParams,
) {
  const { teamId, currency: inputCurrency } = params;

  const targetCurrency = await getTargetCurrency(db, teamId, inputCurrency);
  const grouped = new Map<
    string,
    { count: number; totalAmount: number; oldestDueDate: string | null }
  >();

  for (const row of await getInvoiceAggregateRowsFromConvex({
    teamId,
    statuses: ["overdue"],
  })) {
    const currency = row.currency ?? targetCurrency ?? "USD";

    if (inputCurrency && currency !== inputCurrency) {
      continue;
    }

    const current = grouped.get(currency) ?? {
      count: 0,
      totalAmount: 0,
      oldestDueDate: null,
    };

    current.count += Number(row.invoiceCount || 0);
    current.totalAmount = roundMoney(
      current.totalAmount + Number(row.totalAmount ?? 0),
    );

    if (
      row.oldestDueDate &&
      (!current.oldestDueDate || row.oldestDueDate < current.oldestDueDate)
    ) {
      current.oldestDueDate = row.oldestDueDate;
    }

    grouped.set(currency, current);
  }
  const result = [...grouped.entries()].map(([currency, value]) => ({
    currency,
    ...value,
  }));

  let totalCount = 0;
  let totalAmount = 0;
  let oldestDueDate: string | null = null;
  let mainCurrency = targetCurrency || "USD";

  if (result.length > 0) {
    if (inputCurrency && targetCurrency) {
      const singleResult = result[0];
      totalCount = Number(singleResult?.count || 0);
      totalAmount = Number(singleResult?.totalAmount || 0);
      oldestDueDate = singleResult?.oldestDueDate || null;
      mainCurrency = singleResult?.currency || targetCurrency;
    } else {
      totalCount = result.reduce(
        (sum, item) => sum + Number(item.count || 0),
        0,
      );

      const primaryResult =
        result.find((r) => r.currency === targetCurrency) || result[0];
      totalAmount = Number(primaryResult?.totalAmount || 0);
      oldestDueDate = primaryResult?.oldestDueDate || null;
      mainCurrency = primaryResult?.currency || targetCurrency || "USD";
    }
  }

  let daysOverdue = 0;
  if (oldestDueDate) {
    const now = new Date();
    const dueDate = parseISO(oldestDueDate);
    daysOverdue = Math.floor(
      (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  return {
    summary: {
      count: totalCount,
      totalAmount: Number(totalAmount.toFixed(2)),
      currency: mainCurrency,
      oldestDueDate,
      daysOverdue,
    },
    meta: {
      type: "overdue_invoices_alert",
      currency: mainCurrency,
    },
  };
}

export async function getOverdueInvoicesAlert(
  db: Database,
  params: GetOverdueInvoicesAlertParams,
) {
  return getOverdueInvoicesAlertImpl(db, params);
}

async function getOutstandingInvoicesImpl(
  db: Database,
  params: GetOutstandingInvoicesParams,
) {
  const {
    teamId,
    currency: inputCurrency,
    status = ["unpaid", "overdue", "draft", "scheduled"],
  } = params;

  const targetCurrency = await getTargetCurrency(db, teamId, inputCurrency);
  const statuses = new Set(status);
  const grouped = new Map<string, { count: number; totalAmount: number }>();

  for (const row of await getInvoiceAggregateRowsFromConvex({
    teamId,
    statuses: status,
  })) {
    if (!statuses.has(row.status as (typeof status)[number])) {
      continue;
    }

    const currency = row.currency ?? targetCurrency ?? "USD";

    if (inputCurrency && currency !== inputCurrency) {
      continue;
    }

    const current = grouped.get(currency) ?? { count: 0, totalAmount: 0 };

    current.count += Number(row.invoiceCount || 0);
    current.totalAmount = roundMoney(
      current.totalAmount + Number(row.totalAmount ?? 0),
    );
    grouped.set(currency, current);
  }
  const result = [...grouped.entries()].map(([currency, value]) => ({
    currency,
    ...value,
  }));

  let totalCount = 0;
  let totalAmount = 0;
  let mainCurrency = targetCurrency || "USD";

  if (result.length > 0) {
    if (inputCurrency && targetCurrency) {
      const singleResult = result[0];
      totalCount = Number(singleResult?.count || 0);
      totalAmount = Number(singleResult?.totalAmount || 0);
      mainCurrency = singleResult?.currency || targetCurrency;
    } else {
      totalCount = result.reduce(
        (sum, item) => sum + Number(item.count || 0),
        0,
      );

      const primaryResult =
        result.find((r) => r.currency === targetCurrency) || result[0];
      totalAmount = Number(primaryResult?.totalAmount || 0);
      mainCurrency = primaryResult?.currency || targetCurrency || "USD";
    }
  }

  return {
    summary: {
      count: totalCount,
      totalAmount: Number(totalAmount.toFixed(2)),
      currency: mainCurrency,
      status,
    },
    meta: {
      type: "outstanding_invoices",
      currency: mainCurrency,
      status,
    },
  };
}

export async function getOutstandingInvoices(
  db: Database,
  params: GetOutstandingInvoicesParams,
) {
  return getOutstandingInvoicesImpl(db, params);
}

export type GetRecurringExpensesParams = {
  teamId: string;
  currency?: string;
  from?: string;
  to?: string;
};

interface RecurringExpenseItem {
  name: string;
  amount: number;
  frequency:
    | "weekly"
    | "biweekly"
    | "monthly"
    | "semi_monthly"
    | "annually"
    | "irregular";
  categoryName: string | null;
  categorySlug: string | null;
  lastDate: string;
}

async function getRecurringExpensesImpl(
  db: Database,
  params: GetRecurringExpensesParams,
) {
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

  if (aggregateData) {
    for (const row of aggregateData.rows) {
      const slug = row.categorySlug;

      if (slug && excludedCategorySlugs.includes(slug)) {
        continue;
      }

      const key = [
        row.name,
        normalizeRecurringFrequency(row.frequency),
        slug ?? "",
      ].join("\0");
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
  } else {
    const reportTransactionData = await getReportTransactionAmounts(db, {
      teamId,
      from: from ?? "0000-01-01",
      to: to ?? "9999-12-31",
      inputCurrency,
    });

    for (const row of reportTransactionData.amounts) {
      if (!row.transaction.recurring || row.amount >= 0) {
        continue;
      }

      const slug = row.transaction.categorySlug;

      if (slug && excludedCategorySlugs.includes(slug)) {
        continue;
      }

      const key = [
        row.transaction.name,
        normalizeRecurringFrequency(row.transaction.frequency),
        slug ?? "",
      ].join("\0");
      const current = grouped.get(key) ?? {
        name: row.transaction.name,
        frequency: row.transaction.frequency,
        categorySlug: slug,
        total: 0,
        count: 0,
        lastDate: row.transaction.date,
      };

      current.total = roundMoney(current.total + Math.abs(row.amount));
      current.count += 1;

      if (row.transaction.date > current.lastDate) {
        current.lastDate = row.transaction.date;
      }

      grouped.set(key, current);
    }
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

  const expenses: RecurringExpenseItem[] = recurringExpenses.map((exp) => ({
    name: exp.name,
    amount: Number(Number(exp.amount).toFixed(2)),
    frequency: normalizeRecurringFrequency(exp.frequency),
    categoryName: getCategoryInfo(exp.categorySlug, null)?.name ?? null,
    categorySlug: exp.categorySlug,
    lastDate: exp.lastDate,
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

export const getRecurringExpenses = cacheAcrossRequests({
  keyPrefix: "recurring-expenses",
  keyFn: (params: GetRecurringExpensesParams) =>
    [
      params.teamId,
      params.currency ?? "",
      params.from ?? "",
      params.to ?? "",
    ].join(":"),
  load: getRecurringExpensesImpl,
});
