import { UTCDate } from "@date-fns/utc";
import { addMonths, endOfMonth, format, parseISO } from "date-fns";
import type { Database } from "../../../client";
import { reuseQueryResult } from "../../../utils/request-cache";
import { getBillableHours } from "../../tracker-entries";
import type { ReportsResultItem } from "../core";
import { getOutstandingInvoices } from "../metrics";
import { getReportInvoiceDateAggregateRows } from "../shared";
import { calculateExpectedCollections, getTeamCollectionMetrics } from "./collections";
import { calculateConfidenceBounds, checkForOverlap } from "./model";
import { getForecastRevenueInputs } from "./projections";
import type {
  EnhancedForecastDataPoint,
  ForecastBreakdown,
  ForecastDataPoint,
  GetRevenueForecastParams,
} from "./types";

async function getRevenueForecastImpl(db: Database, params: GetRevenueForecastParams) {
  const { teamId, from, to, forecastMonths, currency: inputCurrency, revenueType = "net" } = params;

  const currentDate = new UTCDate(parseISO(to));
  const forecastStartDate = format(
    endOfMonth(new UTCDate(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)),
    "yyyy-MM-dd",
  );
  const forecastEndDate = format(
    endOfMonth(new UTCDate(currentDate.getFullYear(), currentDate.getMonth() + forecastMonths, 1)),
    "yyyy-MM-dd",
  );

  const [
    revenueInputs,
    outstandingInvoicesData,
    billableHoursData,
    scheduledInvoiceAggregateRows,
    teamCollectionMetrics,
  ] = await Promise.all([
    getForecastRevenueInputs(db, {
      teamId,
      from,
      to,
      forecastMonths,
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
    getReportInvoiceDateAggregateRows(db, {
      teamId,
      statuses: ["scheduled"],
      dateField: "issueDate",
      inputCurrency,
      from: forecastStartDate,
      to: forecastEndDate,
    }),
    getTeamCollectionMetrics(db, teamId),
  ]);

  const { historicalData, recurringInvoiceData, recurringTransactionData, nonRecurringBaseline } =
    revenueInputs;

  const historical = historicalData.map((item: ReportsResultItem) => ({
    date: item.date,
    value: Number.parseFloat(item.value),
    currency: item.currency,
  }));

  const currency = historical[0]?.currency || inputCurrency || "USD";

  const scheduledByMonth = new Map<string, number>();

  if (scheduledInvoiceAggregateRows) {
    for (const row of scheduledInvoiceAggregateRows) {
      const monthKey = format(parseISO(row.date), "yyyy-MM");
      scheduledByMonth.set(monthKey, (scheduledByMonth.get(monthKey) || 0) + row.totalAmount);
    }
  }

  const expectedCollections = await calculateExpectedCollections(
    db,
    teamId,
    teamCollectionMetrics,
    inputCurrency,
  );

  const billableHoursTotal = Math.round(billableHoursData.totalDuration / 3600);
  const billableHoursValue = billableHoursData.totalAmount;

  const forecast: EnhancedForecastDataPoint[] = [];
  const warnings: string[] = [];

  for (let index = 1; index <= forecastMonths; index++) {
    const forecastDate = endOfMonth(
      new UTCDate(currentDate.getFullYear(), currentDate.getMonth() + index, 1),
    );
    const monthKey = format(
      new UTCDate(currentDate.getFullYear(), currentDate.getMonth() + index, 1),
      "yyyy-MM",
    );

    const recurringInvoices = recurringInvoiceData.get(monthKey)?.amount ?? 0;
    const recurringTransactions = recurringTransactionData.get(monthKey)?.amount ?? 0;
    const scheduled = scheduledByMonth.get(monthKey) ?? 0;

    const collections =
      index === 1 ? expectedCollections.month1 : index === 2 ? expectedCollections.month2 : 0;

    const billableHours = index === 1 ? billableHoursValue : 0;

    const decay = Math.max(0.5, 0.9 - index * 0.1);
    const newBusiness = nonRecurringBaseline * decay;

    const breakdown: ForecastBreakdown = {
      recurringInvoices,
      recurringTransactions,
      scheduled,
      collections,
      billableHours,
      newBusiness,
    };

    const value = Object.values(breakdown).reduce((sum, amount) => sum + amount, 0);
    const { optimistic, pessimistic, confidence } = calculateConfidenceBounds(breakdown);

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
  const totalProjectedRevenue = forecast.reduce((sum, item) => sum + item.value, 0);
  const peakForecast = forecast.reduce(
    (max, current) => (current.value > max.value ? current : max),
    forecast[0] || { date: "", value: 0 },
  );

  const avgConfidence =
    forecast.length > 0
      ? Math.round(forecast.reduce((sum, item) => sum + item.confidence, 0) / forecast.length)
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
      ? ((nextMonthProjection - lastHistoricalValue) / lastHistoricalValue) * 100
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
        recurringInvoiceData.get(format(addMonths(currentDate, 1), "yyyy-MM"))?.count ?? 0,
      recurringTransactionsCount:
        recurringTransactionData.get(format(addMonths(currentDate, 1), "yyyy-MM"))?.count ?? 0,
      expectedCollections: expectedCollections.totalExpected,
      collectionRate: Number((teamCollectionMetrics.onTimeRate * 100).toFixed(1)),
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

export const getRevenueForecast = reuseQueryResult({
  keyPrefix: "revenue-forecast",
  keyFn: (params: GetRevenueForecastParams) =>
    [
      params.teamId,
      params.from,
      params.to,
      params.forecastMonths,
      params.currency ?? "",
      params.revenueType ?? "net",
    ].join(":"),
  load: getRevenueForecastImpl,
});
