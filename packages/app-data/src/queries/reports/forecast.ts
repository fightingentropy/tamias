import { UTCDate } from "@date-fns/utc";
import { addMonths, endOfMonth, format, parseISO, subMonths } from "date-fns";
import type { Database } from "../../client";
import { getRecurringInvoiceProjection } from "../invoice-recurring";
import { getBillableHours } from "../tracker-entries";
import type { ReportsResultItem } from "./core";
import { getRevenue } from "./core";
import { getOutstandingInvoices } from "./metrics";
import {
  getExcludedCategorySlugs,
  getReportInvoices,
  getReportTransactionAmounts,
} from "./shared";

type RecurringTransactionProjection = Map<
  string,
  { amount: number; count: number }
>;

async function getRecurringTransactionProjection(
  db: Database,
  params: { teamId: string; forecastMonths: number; currency?: string },
): Promise<RecurringTransactionProjection> {
  const { teamId, forecastMonths, currency } = params;
  const excludedCategorySlugs = getExcludedCategorySlugs();
  const sixMonthsAgo = format(subMonths(new Date(), 6), "yyyy-MM-dd");
  const { amounts } = await getReportTransactionAmounts(db, {
    teamId,
    from: sixMonthsAgo,
    to: format(new Date(), "yyyy-MM-dd"),
    inputCurrency: currency,
  });
  const recurringIncome = amounts
    .filter((row) => row.transaction.recurring && row.amount > 0)
    .filter((row) => {
      const slug = row.transaction.categorySlug;
      return slug === null || !excludedCategorySlugs.includes(slug);
    })
    .map((row) => ({
      name: row.transaction.name,
      amount: row.amount,
      baseAmount: row.transaction.baseAmount,
      baseCurrency: row.transaction.baseCurrency,
      frequency: row.transaction.frequency,
      date: row.transaction.date,
    }));

  const recurringByName = new Map<
    string,
    { amount: number; frequency: string | null; lastDate: string }
  >();

  for (const tx of recurringIncome) {
    const existing = recurringByName.get(tx.name);
    if (!existing || tx.date > existing.lastDate) {
      const effectiveAmount =
        currency && tx.baseCurrency === currency && tx.baseAmount !== null
          ? tx.baseAmount
          : tx.amount;

      recurringByName.set(tx.name, {
        amount: effectiveAmount,
        frequency: tx.frequency,
        lastDate: tx.date,
      });
    }
  }

  const projection: RecurringTransactionProjection = new Map();
  const currentDate = new UTCDate();

  for (let i = 1; i <= forecastMonths; i++) {
    const monthKey = format(addMonths(currentDate, i), "yyyy-MM");
    let monthTotal = 0;
    let count = 0;

    for (const [, recurring] of recurringByName) {
      let monthlyAmount = recurring.amount;

      switch (recurring.frequency) {
        case "weekly":
          monthlyAmount = recurring.amount * 4.33;
          break;
        case "biweekly":
          monthlyAmount = recurring.amount * 2.17;
          break;
        case "semi_monthly":
          monthlyAmount = recurring.amount * 2;
          break;
        case "annually":
          monthlyAmount = recurring.amount / 12;
          break;
      }

      monthTotal += monthlyAmount;
      count++;
    }

    projection.set(monthKey, { amount: monthTotal, count });
  }

  return projection;
}

interface TeamCollectionMetrics {
  onTimeRate: number;
  avgDaysToPay: number;
  sampleSize: number;
}

async function getTeamCollectionMetrics(
  db: Database,
  teamId: string,
): Promise<TeamCollectionMetrics> {
  const twelveMonthsAgo = format(subMonths(new UTCDate(), 12), "yyyy-MM-dd");
  const paidInvoices = (
    await getReportInvoices(db, {
      teamId,
      statuses: ["paid"],
      dateField: "paidAt",
      from: twelveMonthsAgo,
    })
  ).filter((invoice) => Boolean(invoice.paidAt) && Boolean(invoice.issueDate));

  if (paidInvoices.length === 0) {
    return {
      onTimeRate: 0.7,
      avgDaysToPay: 30,
      sampleSize: 0,
    };
  }

  let onTimeCount = 0;
  let totalDaysToPay = 0;
  let validPaymentCount = 0;

  for (const inv of paidInvoices) {
    if (!inv.issueDate || !inv.paidAt) continue;

    const issueDate = parseISO(inv.issueDate);
    const paidDate = parseISO(inv.paidAt);
    const daysToPay = Math.floor(
      (paidDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysToPay >= 0 && daysToPay <= 365) {
      totalDaysToPay += daysToPay;
      validPaymentCount++;

      if (inv.dueDate) {
        const dueDate = parseISO(inv.dueDate);
        if (paidDate <= dueDate) {
          onTimeCount++;
        }
      }
    }
  }

  return {
    onTimeRate: validPaymentCount > 0 ? onTimeCount / validPaymentCount : 0.7,
    avgDaysToPay:
      validPaymentCount > 0 ? totalDaysToPay / validPaymentCount : 30,
    sampleSize: validPaymentCount,
  };
}

interface ExpectedCollections {
  month1: number;
  month2: number;
  totalExpected: number;
  invoiceCount: number;
}

async function calculateExpectedCollections(
  db: Database,
  teamId: string,
  teamMetrics: TeamCollectionMetrics,
  currency?: string,
): Promise<ExpectedCollections> {
  const outstandingInvoices = await getReportInvoices(db, {
    teamId,
    inputCurrency: currency,
    statuses: ["unpaid", "overdue"],
  });

  if (outstandingInvoices.length === 0) {
    return {
      month1: 0,
      month2: 0,
      totalExpected: 0,
      invoiceCount: 0,
    };
  }

  const now = new Date();
  const teamFactor = teamMetrics.onTimeRate / 0.7;

  let month1Total = 0;
  let month2Total = 0;

  for (const inv of outstandingInvoices) {
    const amount = inv.amount ?? 0;
    const daysSinceIssue = inv.issueDate
      ? Math.floor(
          (now.getTime() - parseISO(inv.issueDate).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

    const daysPastDue = inv.dueDate
      ? Math.floor(
          (now.getTime() - parseISO(inv.dueDate).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

    let baseProbability: number;
    if (daysSinceIssue < 30) {
      baseProbability = 0.85;
    } else if (daysPastDue <= 0) {
      baseProbability = 0.75;
    } else if (daysPastDue <= 30) {
      baseProbability = 0.5;
    } else if (daysPastDue <= 60) {
      baseProbability = 0.3;
    } else if (daysPastDue <= 90) {
      baseProbability = 0.15;
    } else {
      baseProbability = 0.05;
    }

    const adjustedProbability = Math.min(
      0.95,
      Math.max(0.05, baseProbability * teamFactor),
    );

    const expectedAmount = amount * adjustedProbability;

    if (daysSinceIssue < 45) {
      month1Total += expectedAmount;
    } else {
      month1Total += expectedAmount * 0.6;
      month2Total += expectedAmount * 0.4;
    }
  }

  return {
    month1: month1Total,
    month2: month2Total,
    totalExpected: month1Total + month2Total,
    invoiceCount: outstandingInvoices.length,
  };
}

function calculateWeightedMedian(values: number[], weights: number[]): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0] ?? 0;

  const pairs = values.map((v, i) => ({
    value: v,
    weight: weights[i] ?? 1,
  }));
  pairs.sort((a, b) => a.value - b.value);

  const totalWeight = pairs.reduce((sum, p) => sum + p.weight, 0);
  const midWeight = totalWeight / 2;

  let cumWeight = 0;
  for (const pair of pairs) {
    cumWeight += pair.weight;
    if (cumWeight >= midWeight) {
      return pair.value;
    }
  }

  return pairs[pairs.length - 1]?.value ?? 0;
}

async function getHistoricalRecurringInvoiceAverage(
  db: Database,
  params: {
    teamId: string;
    currency?: string;
  },
): Promise<number> {
  const { teamId, currency } = params;

  const sixMonthsAgo = format(subMonths(new Date(), 6), "yyyy-MM-dd");
  const paidRecurringInvoices = (
    await getReportInvoices(db, {
      teamId,
      inputCurrency: currency,
      statuses: ["paid"],
      dateField: "paidAt",
      from: sixMonthsAgo,
    })
  ).filter((invoice) => !!invoice.invoiceRecurringId && !!invoice.paidAt);

  if (paidRecurringInvoices.length === 0) {
    return 0;
  }

  const monthlyTotals = new Map<string, number>();

  for (const inv of paidRecurringInvoices) {
    if (!inv.paidAt || !inv.amount) continue;
    const monthKey = format(parseISO(inv.paidAt), "yyyy-MM");
    const amount = Number(inv.amount) || 0;
    monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) || 0) + amount);
  }

  if (monthlyTotals.size === 0) {
    return 0;
  }

  const totalRevenue = Array.from(monthlyTotals.values()).reduce(
    (a, b) => a + b,
    0,
  );
  return totalRevenue / monthlyTotals.size;
}

async function calculateNonRecurringBaseline(
  db: Database,
  params: {
    teamId: string;
    currency?: string;
    recurringTxMonthlyAvg: number;
    recurringInvoiceMonthlyAvg: number;
  },
): Promise<number> {
  const {
    teamId,
    currency,
    recurringTxMonthlyAvg,
    recurringInvoiceMonthlyAvg,
  } = params;

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

  const totalRecurringMonthlyAvg =
    recurringTxMonthlyAvg + recurringInvoiceMonthlyAvg;

  const nonRecurringValues = historicalRevenue.map((month) =>
    Math.max(0, Number.parseFloat(month.value) - totalRecurringMonthlyAvg),
  );

  const weights = nonRecurringValues.map((_, i) => 0.5 + i * 0.1);

  return calculateWeightedMedian(nonRecurringValues, weights);
}

interface ForecastBreakdown {
  recurringInvoices: number;
  recurringTransactions: number;
  scheduled: number;
  collections: number;
  billableHours: number;
  newBusiness: number;
}

interface ConfidenceBounds {
  optimistic: number;
  pessimistic: number;
  confidence: number;
}

function calculateConfidenceBounds(
  breakdown: ForecastBreakdown,
): ConfidenceBounds {
  const optimistic =
    breakdown.recurringInvoices * 1.05 +
    breakdown.recurringTransactions * 1.1 +
    breakdown.scheduled * 1.05 +
    breakdown.collections * 1.2 +
    breakdown.billableHours * 1.15 +
    breakdown.newBusiness * 1.5;

  const pessimistic =
    breakdown.recurringInvoices * 0.95 +
    breakdown.recurringTransactions * 0.85 +
    breakdown.scheduled * 0.9 +
    breakdown.collections * 0.6 +
    breakdown.billableHours * 0.7 +
    breakdown.newBusiness * 0.4;

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const confidence =
    total > 0
      ? (breakdown.recurringInvoices / total) * 95 +
        (breakdown.recurringTransactions / total) * 85 +
        (breakdown.scheduled / total) * 90 +
        (breakdown.collections / total) * 70 +
        (breakdown.billableHours / total) * 75 +
        (breakdown.newBusiness / total) * 35
      : 0;

  return {
    optimistic,
    pessimistic,
    confidence: Math.round(confidence),
  };
}

function checkForOverlap(
  recurringInvoices: number,
  recurringTransactions: number,
): string | null {
  if (recurringInvoices > 500 && recurringTransactions > 500) {
    return (
      "Both recurring invoices and recurring transactions detected. " +
      "If these represent the same revenue (e.g., a retainer billed via invoice " +
      "that also shows as a recurring bank deposit), the forecast may be overstated."
    );
  }
  return null;
}

export type GetRevenueForecastParams = {
  teamId: string;
  from: string;
  to: string;
  forecastMonths: number;
  currency?: string;
  revenueType?: "gross" | "net";
};

interface ForecastDataPoint {
  date: string;
  value: number;
  currency: string;
  type: "actual" | "forecast";
}

interface EnhancedForecastDataPoint extends ForecastDataPoint {
  optimistic: number;
  pessimistic: number;
  confidence: number;
  breakdown: ForecastBreakdown;
}

export async function getRevenueForecast(
  db: Database,
  params: GetRevenueForecastParams,
) {
  const {
    teamId,
    from,
    to,
    forecastMonths,
    currency: inputCurrency,
    revenueType = "net",
  } = params;

  const currentDate = new UTCDate(parseISO(to));
  const forecastStartDate = format(
    endOfMonth(
      new UTCDate(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
    ),
    "yyyy-MM-dd",
  );
  const forecastEndDate = format(
    endOfMonth(
      new UTCDate(
        currentDate.getFullYear(),
        currentDate.getMonth() + forecastMonths,
        1,
      ),
    ),
    "yyyy-MM-dd",
  );

  const [
    historicalData,
    outstandingInvoicesData,
    billableHoursData,
    scheduledInvoicesData,
    recurringInvoiceData,
    recurringTransactionData,
    teamCollectionMetrics,
  ] = await Promise.all([
    getRevenue(db, {
      teamId,
      from,
      to,
      currency: inputCurrency,
      revenueType,
    }),
    getOutstandingInvoices(db, {
      teamId,
      currency: inputCurrency,
      status: ["unpaid", "overdue"],
    }),
    getBillableHours(db, {
      teamId,
      date: new Date().toISOString(),
      view: "month",
    }),
    getReportInvoices(db, {
      teamId,
      inputCurrency,
      statuses: ["scheduled"],
      dateField: "issueDate",
      from: forecastStartDate,
      to: forecastEndDate,
    }).then((records) => records.filter((invoice) => !!invoice.issueDate)),
    getRecurringInvoiceProjection(db, {
      teamId,
      forecastMonths,
      currency: inputCurrency,
    }),
    getRecurringTransactionProjection(db, {
      teamId,
      forecastMonths,
      currency: inputCurrency,
    }),
    getTeamCollectionMetrics(db, teamId),
  ]);

  const historical = historicalData.map((item: ReportsResultItem) => ({
    date: item.date,
    value: Number.parseFloat(item.value),
    currency: item.currency,
  }));

  const currency = historical[0]?.currency || inputCurrency || "USD";

  const scheduledByMonth = new Map<string, number>();
  for (const invoice of scheduledInvoicesData) {
    if (!invoice.issueDate) continue;
    const monthKey = format(parseISO(invoice.issueDate), "yyyy-MM");
    const amount = Number(invoice.amount) || 0;
    scheduledByMonth.set(
      monthKey,
      (scheduledByMonth.get(monthKey) || 0) + amount,
    );
  }

  const expectedCollections = await calculateExpectedCollections(
    db,
    teamId,
    teamCollectionMetrics,
    inputCurrency,
  );

  let recurringTxMonthlyAvg = 0;
  for (const [, data] of recurringTransactionData) {
    recurringTxMonthlyAvg = data.amount;
    break;
  }

  const recurringInvoiceMonthlyAvg = await getHistoricalRecurringInvoiceAverage(
    db,
    {
      teamId,
      currency: inputCurrency,
    },
  );

  const nonRecurringBaseline = await calculateNonRecurringBaseline(db, {
    teamId,
    currency: inputCurrency,
    recurringTxMonthlyAvg,
    recurringInvoiceMonthlyAvg,
  });

  const billableHoursTotal = Math.round(billableHoursData.totalDuration / 3600);
  const billableHoursValue = billableHoursData.totalAmount;

  const forecast: EnhancedForecastDataPoint[] = [];
  const warnings: string[] = [];

  for (let i = 1; i <= forecastMonths; i++) {
    const forecastDate = endOfMonth(
      new UTCDate(currentDate.getFullYear(), currentDate.getMonth() + i, 1),
    );
    const monthKey = format(
      new UTCDate(currentDate.getFullYear(), currentDate.getMonth() + i, 1),
      "yyyy-MM",
    );

    const recurringInvoices = recurringInvoiceData.get(monthKey)?.amount ?? 0;
    const recurringTransactions =
      recurringTransactionData.get(monthKey)?.amount ?? 0;
    const scheduled = scheduledByMonth.get(monthKey) ?? 0;

    const collections =
      i === 1
        ? expectedCollections.month1
        : i === 2
          ? expectedCollections.month2
          : 0;

    const billableHours = i === 1 ? billableHoursValue : 0;

    const decay = Math.max(0.5, 0.9 - i * 0.1);
    const newBusiness = nonRecurringBaseline * decay;

    const breakdown: ForecastBreakdown = {
      recurringInvoices,
      recurringTransactions,
      scheduled,
      collections,
      billableHours,
      newBusiness,
    };

    const value = Object.values(breakdown).reduce((a, b) => a + b, 0);
    const { optimistic, pessimistic, confidence } =
      calculateConfidenceBounds(breakdown);

    forecast.push({
      date: format(forecastDate, "yyyy-MM-dd"),
      value: Math.max(0, Number(value.toFixed(2))),
      optimistic: Math.max(0, Number(optimistic.toFixed(2))),
      pessimistic: Math.max(0, Number(pessimistic.toFixed(2))),
      confidence,
      breakdown,
      currency,
      type: "forecast",
    });
  }

  const firstMonthBreakdown = forecast[0]?.breakdown;
  if (firstMonthBreakdown) {
    const overlapWarning = checkForOverlap(
      firstMonthBreakdown.recurringInvoices,
      firstMonthBreakdown.recurringTransactions,
    );
    if (overlapWarning) {
      warnings.push(overlapWarning);
    }
  }

  const nextMonthProjection = forecast[0]?.value || 0;
  const totalProjectedRevenue = forecast.reduce(
    (sum, item) => sum + item.value,
    0,
  );
  const peakForecast = forecast.reduce(
    (max, curr) => (curr.value > max.value ? curr : max),
    forecast[0] || { date: "", value: 0 },
  );

  const avgConfidence =
    forecast.length > 0
      ? Math.round(
          forecast.reduce((sum, f) => sum + f.confidence, 0) / forecast.length,
        )
      : 0;

  const combinedData: ForecastDataPoint[] = [
    ...historical.map((item) => ({
      ...item,
      type: "actual" as const,
    })),
    ...forecast.map((item) => ({
      date: item.date,
      value: item.value,
      currency: item.currency,
      type: "forecast" as const,
    })),
  ];

  const firstBreakdown = forecast[0]?.breakdown || {
    recurringInvoices: 0,
    recurringTransactions: 0,
    scheduled: 0,
    collections: 0,
    billableHours: 0,
    newBusiness: 0,
  };

  const totalRecurringRevenue =
    firstBreakdown.recurringInvoices + firstBreakdown.recurringTransactions;

  const lastHistoricalValue = historical[historical.length - 1]?.value || 0;
  const impliedGrowthRate =
    lastHistoricalValue > 0
      ? ((nextMonthProjection - lastHistoricalValue) / lastHistoricalValue) *
        100
      : 0;

  const scheduledInvoicesTotal = Array.from(scheduledByMonth.values()).reduce(
    (sum, amount) => sum + amount,
    0,
  );

  return {
    summary: {
      nextMonthProjection: Number(nextMonthProjection.toFixed(2)),
      avgMonthlyGrowthRate: Number(impliedGrowthRate.toFixed(2)),
      totalProjectedRevenue: Number(totalProjectedRevenue.toFixed(2)),
      peakMonth: {
        date: peakForecast.date,
        value: peakForecast.value,
      },
      currency,
      revenueType,
      forecastStartDate: forecast[0]?.date,
      unpaidInvoices: {
        count: outstandingInvoicesData.summary.count,
        totalAmount: outstandingInvoicesData.summary.totalAmount,
        currency: outstandingInvoicesData.summary.currency,
      },
      billableHours: {
        totalHours: billableHoursTotal,
        totalAmount: Number(billableHoursValue.toFixed(2)),
        currency: billableHoursData.currency,
      },
    },
    historical: historical.map((item) => ({
      date: item.date,
      value: item.value,
      currency: item.currency,
    })),
    forecast: forecast.map((item) => ({
      date: item.date,
      value: item.value,
      currency: item.currency,
      optimistic: item.optimistic,
      pessimistic: item.pessimistic,
      confidence: item.confidence,
      breakdown: item.breakdown,
    })),
    combined: combinedData,
    meta: {
      historicalMonths: historical.length,
      forecastMonths,
      avgGrowthRate: Number(impliedGrowthRate.toFixed(2)),
      basedOnMonths: historical.length,
      currency,
      includesUnpaidInvoices: outstandingInvoicesData.summary.count > 0,
      includesBillableHours: billableHoursTotal > 0,
      forecastMethod: "bottom_up",
      confidenceScore: avgConfidence,
      warnings,
      recurringRevenueTotal: totalRecurringRevenue,
      recurringInvoicesCount:
        recurringInvoiceData.get(format(addMonths(currentDate, 1), "yyyy-MM"))
          ?.count ?? 0,
      recurringTransactionsCount:
        recurringTransactionData.get(
          format(addMonths(currentDate, 1), "yyyy-MM"),
        )?.count ?? 0,
      expectedCollections: expectedCollections.totalExpected,
      collectionRate: Number(
        (teamCollectionMetrics.onTimeRate * 100).toFixed(1),
      ),
      scheduledInvoicesTotal: Number(scheduledInvoicesTotal.toFixed(2)),
      scheduledInvoicesCount: scheduledByMonth.size,
      newBusinessBaseline: Number(nonRecurringBaseline.toFixed(2)),
      teamCollectionMetrics: {
        onTimeRate: Number((teamCollectionMetrics.onTimeRate * 100).toFixed(1)),
        avgDaysToPay: Math.round(teamCollectionMetrics.avgDaysToPay),
        sampleSize: teamCollectionMetrics.sampleSize,
      },
    },
  };
}
