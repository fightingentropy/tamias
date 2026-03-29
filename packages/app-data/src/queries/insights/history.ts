import {
  differenceInDays,
  endOfQuarter,
  format,
  getQuarter,
  startOfQuarter,
} from "date-fns";
import type { Database } from "../../client";
import type { InsightPredictions } from "../../types/insights";
import { listCompletedWeeklyInsights } from "./shared";

export type StreakType =
  | "revenue_growth"
  | "revenue_decline"
  | "profitable"
  | "invoices_paid_on_time"
  | null;

export type StreakInfo = {
  type: StreakType;
  count: number;
  description: string | null;
};

export type MomentumType = "accelerating" | "steady" | "decelerating";

export type RecoveryInfo = {
  isRecovery: boolean;
  downWeeksBefore: number;
  strength?: "strong" | "moderate" | "mild";
  description?: string;
};

export type HistoricalContext = {
  revenueRank: number | null;
  revenueHighestSince?: string;
  profitRank: number | null;
  profitHighestSince?: string;
  isAllTimeRevenueHigh: boolean;
  isAllTimeProfitHigh: boolean;
  isRecentRevenueHigh: boolean;
  isRecentProfitHigh: boolean;
  weeksOfHistory: number;
  yearOverYear?: {
    lastYearRevenue: number;
    lastYearProfit: number;
    revenueChangePercent: number;
    profitChangePercent: number;
    hasComparison: boolean;
  };
  quarterPace?: {
    currentQuarter: number;
    qtdRevenue: number;
    projectedRevenue: number;
    lastYearQuarterRevenue: number;
    vsLastYearPercent: number;
    hasComparison: boolean;
  };
};

export type InsightHistoryWeek = {
  periodYear: number;
  periodNumber: number;
  periodStart: Date;
  revenue: number;
  expenses: number;
  profit: number;
  hasOverdue: boolean;
  invoicesPaid: number;
  predictions?: InsightPredictions;
};

export type InsightHistoryData = {
  weeks: InsightHistoryWeek[];
  weeksOfHistory: number;
};

export async function getInsightHistory(
  db: Database,
  params: {
    teamId: string;
    weeksBack?: number;
    excludeCurrentPeriod?: { year: number; number: number };
  },
): Promise<InsightHistoryData> {
  const { teamId, weeksBack = 52, excludeCurrentPeriod } = params;

  const pastInsights = await listCompletedWeeklyInsights(db, {
    teamId,
    excludeCurrentPeriod,
    limit: weeksBack,
  });

  const weeks: InsightHistoryWeek[] = pastInsights
    .map((insight): InsightHistoryWeek | null => {
      const metrics = insight.allMetrics as Record<
        string,
        { value: number }
      > | null;
      const activity = insight.activity as {
        invoicesOverdue?: number;
        invoicesPaid?: number;
      } | null;

      if (!metrics) return null;

      const week: InsightHistoryWeek = {
        periodYear: insight.periodYear,
        periodNumber: insight.periodNumber,
        periodStart: insight.periodStart,
        revenue: metrics.revenue?.value ?? 0,
        expenses: metrics.expenses?.value ?? 0,
        profit: metrics.netProfit?.value ?? metrics.profit?.value ?? 0,
        hasOverdue: (activity?.invoicesOverdue ?? 0) > 0,
        invoicesPaid: activity?.invoicesPaid ?? 0,
      };

      if (insight.predictions) {
        week.predictions = insight.predictions;
      }

      return week;
    })
    .filter((w): w is InsightHistoryWeek => w !== null);

  return {
    weeks,
    weeksOfHistory: weeks.length,
  };
}

export type RollingAverages = {
  avgRevenue: number;
  avgExpenses: number;
  avgProfit: number;
  weeksIncluded: number;
};

export function computeRollingAverages(
  history: InsightHistoryData,
  weeksBack = 4,
): RollingAverages {
  const weeksToUse = history.weeks.slice(0, weeksBack);

  if (weeksToUse.length === 0) {
    return { avgRevenue: 0, avgExpenses: 0, avgProfit: 0, weeksIncluded: 0 };
  }

  let totalRevenue = 0;
  let totalExpenses = 0;
  let totalProfit = 0;

  for (const week of weeksToUse) {
    totalRevenue += week.revenue;
    totalExpenses += week.expenses;
    totalProfit += week.profit;
  }

  const count = weeksToUse.length;
  return {
    avgRevenue: Math.round((totalRevenue / count) * 100) / 100,
    avgExpenses: Math.round((totalExpenses / count) * 100) / 100,
    avgProfit: Math.round((totalProfit / count) * 100) / 100,
    weeksIncluded: count,
  };
}

export function computeStreakInfo(
  history: InsightHistoryData,
  currentWeek: {
    revenue: number;
    profit: number;
    hasOverdue: boolean;
    invoicesPaid: number;
  },
): StreakInfo {
  if (history.weeks.length === 0) {
    return { type: null, count: 0, description: null };
  }

  const weeks = [currentWeek, ...history.weeks.slice(0, 8)];

  let growthStreak = 0;
  for (let i = 0; i < weeks.length - 1; i++) {
    if (weeks[i]!.revenue > weeks[i + 1]!.revenue) {
      growthStreak++;
    } else {
      break;
    }
  }

  let declineStreak = 0;
  for (let i = 0; i < weeks.length - 1; i++) {
    if (weeks[i]!.revenue < weeks[i + 1]!.revenue) {
      declineStreak++;
    } else {
      break;
    }
  }

  let profitableStreak = 0;
  for (const week of weeks) {
    if (week.profit > 0) {
      profitableStreak++;
    } else {
      break;
    }
  }

  let paidOnTimeStreak = 0;
  for (const week of weeks) {
    if (week.invoicesPaid > 0 && !week.hasOverdue) {
      paidOnTimeStreak++;
    } else if (week.invoicesPaid === 0) {
      continue;
    } else {
      break;
    }
  }

  if (growthStreak >= 2) {
    return {
      type: "revenue_growth",
      count: growthStreak,
      description: `${growthStreak} consecutive growth weeks`,
    };
  }
  if (profitableStreak >= 3) {
    return {
      type: "profitable",
      count: profitableStreak,
      description: `${profitableStreak} profitable weeks in a row`,
    };
  }
  if (paidOnTimeStreak >= 3) {
    return {
      type: "invoices_paid_on_time",
      count: paidOnTimeStreak,
      description: `${paidOnTimeStreak} weeks with all invoices paid on time`,
    };
  }
  if (declineStreak >= 2) {
    return {
      type: "revenue_decline",
      count: declineStreak,
      description: `Revenue down ${declineStreak} weeks in a row`,
    };
  }

  return { type: null, count: 0, description: null };
}

export function computeHistoricalContext(
  history: InsightHistoryData,
  currentWeek: {
    revenue: number;
    profit: number;
    periodYear: number;
    periodNumber: number;
  },
): HistoricalContext {
  const { revenue: currentRevenue, profit: currentProfit } = currentWeek;

  const validWeeks = history.weeks.filter((w) => w.revenue > 0);

  if (validWeeks.length < 4) {
    return {
      revenueRank: null,
      profitRank: null,
      isAllTimeRevenueHigh: false,
      isAllTimeProfitHigh: false,
      isRecentRevenueHigh: false,
      isRecentProfitHigh: false,
      weeksOfHistory: validWeeks.length,
    };
  }

  const revenueRank =
    validWeeks.filter((w) => w.revenue > currentRevenue).length + 1;
  const isAllTimeRevenueHigh = revenueRank === 1;

  let revenueHighestSince: string | undefined;
  if (revenueRank <= 3 && revenueRank > 1) {
    const higherWeek = validWeeks.find((w) => w.revenue > currentRevenue);
    if (higherWeek) {
      revenueHighestSince = format(higherWeek.periodStart, "MMMM yyyy");
    }
  }

  const profitRank =
    validWeeks.filter((w) => w.profit > currentProfit).length + 1;
  const isAllTimeProfitHigh = profitRank === 1 && currentProfit > 0;

  let profitHighestSince: string | undefined;
  if (profitRank <= 3 && profitRank > 1 && currentProfit > 0) {
    const higherWeek = validWeeks.find((w) => w.profit > currentProfit);
    if (higherWeek) {
      profitHighestSince = format(higherWeek.periodStart, "MMMM yyyy");
    }
  }

  const isRecentRevenueHigh = revenueRank <= 3 && validWeeks.length >= 8;
  const isRecentProfitHigh =
    profitRank <= 3 && validWeeks.length >= 8 && currentProfit > 0;

  let yearOverYear: HistoricalContext["yearOverYear"];
  const lastYearInsight = history.weeks.find(
    (w) =>
      w.periodYear === currentWeek.periodYear - 1 &&
      w.periodNumber === currentWeek.periodNumber,
  );

  if (lastYearInsight && lastYearInsight.revenue > 0) {
    const revenueChangePercent = Math.round(
      ((currentRevenue - lastYearInsight.revenue) / lastYearInsight.revenue) *
        100,
    );
    const profitChangePercent =
      lastYearInsight.profit !== 0
        ? Math.round(
            ((currentProfit - lastYearInsight.profit) /
              Math.abs(lastYearInsight.profit)) *
              100,
          )
        : 0;

    yearOverYear = {
      lastYearRevenue: lastYearInsight.revenue,
      lastYearProfit: lastYearInsight.profit,
      revenueChangePercent,
      profitChangePercent,
      hasComparison: true,
    };
  }

  let quarterPace: HistoricalContext["quarterPace"];
  const now = new Date();
  const currentQuarter = getQuarter(now);
  const quarterStart = startOfQuarter(now);
  const quarterEnd = endOfQuarter(now);
  const daysElapsed = differenceInDays(now, quarterStart) + 1;
  const totalQuarterDays = differenceInDays(quarterEnd, quarterStart) + 1;

  const quarterWeeks = history.weeks.filter((w) => {
    return (
      w.periodStart >= quarterStart &&
      w.periodStart <= now &&
      w.periodYear === currentWeek.periodYear
    );
  });

  const qtdRevenue =
    quarterWeeks.reduce((sum, w) => sum + w.revenue, 0) + currentRevenue;

  if (qtdRevenue > 0 && daysElapsed > 7) {
    const projectedRevenue = Math.round(
      (qtdRevenue / daysElapsed) * totalQuarterDays,
    );

    const lastYearQuarterWeeks = history.weeks.filter((w) => {
      const weekQuarter = getQuarter(w.periodStart);
      return (
        weekQuarter === currentQuarter &&
        w.periodYear === currentWeek.periodYear - 1
      );
    });

    const lastYearQuarterRevenue = lastYearQuarterWeeks.reduce(
      (sum, w) => sum + w.revenue,
      0,
    );

    const vsLastYearPercent =
      lastYearQuarterRevenue > 0
        ? Math.round(
            ((projectedRevenue - lastYearQuarterRevenue) /
              lastYearQuarterRevenue) *
              100,
          )
        : 0;

    quarterPace = {
      currentQuarter,
      qtdRevenue,
      projectedRevenue,
      lastYearQuarterRevenue,
      vsLastYearPercent,
      hasComparison: lastYearQuarterRevenue > 0,
    };
  }

  return {
    revenueRank,
    revenueHighestSince,
    profitRank,
    profitHighestSince,
    isAllTimeRevenueHigh,
    isAllTimeProfitHigh,
    isRecentRevenueHigh,
    isRecentProfitHigh,
    weeksOfHistory: validWeeks.length,
    yearOverYear,
    quarterPace,
  };
}

export function detectMomentum(
  currentGrowthRate: number,
  previousGrowthRate: number,
): MomentumType {
  const difference = currentGrowthRate - previousGrowthRate;

  if (difference > 5) {
    return "accelerating";
  }
  if (difference < -5) {
    return "decelerating";
  }
  return "steady";
}

export function computeMomentum(
  history: InsightHistoryData,
  currentRevenue: number,
): {
  momentum: MomentumType;
  currentGrowthRate: number;
  previousGrowthRate: number;
} | null {
  if (history.weeks.length < 2) {
    return null;
  }

  const prevRevenue = history.weeks[0]!.revenue;
  const weekBeforeRevenue = history.weeks[1]!.revenue;

  if (prevRevenue === 0 || weekBeforeRevenue === 0) {
    return null;
  }

  const currentGrowthRate =
    ((currentRevenue - prevRevenue) / prevRevenue) * 100;
  const previousGrowthRate =
    ((prevRevenue - weekBeforeRevenue) / weekBeforeRevenue) * 100;

  return {
    momentum: detectMomentum(currentGrowthRate, previousGrowthRate),
    currentGrowthRate: Math.round(currentGrowthRate * 10) / 10,
    previousGrowthRate: Math.round(previousGrowthRate * 10) / 10,
  };
}

export function computeRecovery(
  history: InsightHistoryData,
  currentRevenue: number,
): RecoveryInfo {
  if (history.weeks.length < 2) {
    return { isRecovery: false, downWeeksBefore: 0 };
  }

  const revenues = history.weeks
    .filter((w) => w.revenue > 0)
    .map((w) => w.revenue);
  if (revenues.length < 2) {
    return { isRecovery: false, downWeeksBefore: 0 };
  }

  const previousRevenue = revenues[0]!;

  if (currentRevenue <= previousRevenue) {
    return { isRecovery: false, downWeeksBefore: 0 };
  }

  let downWeeksBefore = 0;
  for (let i = 0; i < revenues.length - 1; i++) {
    if (revenues[i]! < revenues[i + 1]!) {
      downWeeksBefore++;
    } else {
      break;
    }
  }

  if (downWeeksBefore === 0) {
    return { isRecovery: false, downWeeksBefore: 0 };
  }

  const recoveryPercent =
    ((currentRevenue - previousRevenue) / previousRevenue) * 100;
  let strength: "strong" | "moderate" | "mild";
  if (recoveryPercent >= 20) {
    strength = "strong";
  } else if (recoveryPercent >= 10) {
    strength = "moderate";
  } else {
    strength = "mild";
  }

  const description =
    downWeeksBefore >= 3
      ? `Bounced back after ${downWeeksBefore} down weeks`
      : downWeeksBefore === 2
        ? "Bounced back after 2 down weeks"
        : "Bounced back from last week's dip";

  return {
    isRecovery: true,
    downWeeksBefore,
    strength,
    description,
  };
}

export function getPredictionsFromHistory(history: InsightHistoryData): {
  predictions: InsightPredictions | null;
  periodStart: Date | null;
} | null {
  if (history.weeks.length === 0) {
    return null;
  }

  const previousWeek = history.weeks[0];
  return {
    predictions: previousWeek?.predictions ?? null,
    periodStart: previousWeek?.periodStart ?? null,
  };
}

export async function getRollingAverages(
  db: Database,
  params: {
    teamId: string;
    weeksBack?: number;
    currentPeriodYear?: number;
    currentPeriodNumber?: number;
  },
): Promise<RollingAverages> {
  const {
    teamId,
    weeksBack = 4,
    currentPeriodYear,
    currentPeriodNumber,
  } = params;

  const pastInsights = await listCompletedWeeklyInsights(db, {
    teamId,
    excludeCurrentPeriod:
      currentPeriodYear && currentPeriodNumber
        ? { year: currentPeriodYear, number: currentPeriodNumber }
        : undefined,
    limit: weeksBack,
  });

  if (pastInsights.length === 0) {
    return {
      avgRevenue: 0,
      avgExpenses: 0,
      avgProfit: 0,
      weeksIncluded: 0,
    };
  }

  let totalRevenue = 0;
  let totalExpenses = 0;
  let totalProfit = 0;
  let validWeeks = 0;

  for (const insight of pastInsights) {
    const metrics = insight.allMetrics as Record<
      string,
      { value: number }
    > | null;
    if (!metrics) continue;

    const revenue = metrics.revenue?.value ?? 0;
    const expenses = metrics.expenses?.value ?? 0;
    const profit = metrics.netProfit?.value ?? metrics.profit?.value ?? 0;

    totalRevenue += revenue;
    totalExpenses += expenses;
    totalProfit += profit;
    validWeeks++;
  }

  if (validWeeks === 0) {
    return {
      avgRevenue: 0,
      avgExpenses: 0,
      avgProfit: 0,
      weeksIncluded: 0,
    };
  }

  return {
    avgRevenue: Math.round((totalRevenue / validWeeks) * 100) / 100,
    avgExpenses: Math.round((totalExpenses / validWeeks) * 100) / 100,
    avgProfit: Math.round((totalProfit / validWeeks) * 100) / 100,
    weeksIncluded: validWeeks,
  };
}

export async function getStreakInfo(
  db: Database,
  params: {
    teamId: string;
    currentPeriodYear: number;
    currentPeriodNumber: number;
    currentRevenue: number;
    currentProfit: number;
    hasOverdueInvoices: boolean;
  },
): Promise<StreakInfo> {
  const {
    teamId,
    currentPeriodYear,
    currentPeriodNumber,
    currentRevenue,
    currentProfit,
    hasOverdueInvoices,
  } = params;

  const pastInsights = await listCompletedWeeklyInsights(db, {
    teamId,
    excludeCurrentPeriod: {
      year: currentPeriodYear,
      number: currentPeriodNumber,
    },
    limit: 8,
  });

  if (pastInsights.length === 0) {
    return { type: null, count: 0, description: null };
  }

  type WeekData = {
    revenue: number;
    profit: number;
    hasOverdue: boolean;
  };

  const weeks: WeekData[] = [
    {
      revenue: currentRevenue,
      profit: currentProfit,
      hasOverdue: hasOverdueInvoices,
    },
  ];

  for (const insight of pastInsights) {
    const metrics = insight.allMetrics as Record<
      string,
      { value: number }
    > | null;
    const activity = insight.activity as { invoicesOverdue?: number } | null;

    if (!metrics) continue;

    weeks.push({
      revenue: metrics.revenue?.value ?? 0,
      profit: metrics.netProfit?.value ?? metrics.profit?.value ?? 0,
      hasOverdue: (activity?.invoicesOverdue ?? 0) > 0,
    });
  }

  let growthStreak = 0;
  for (let i = 0; i < weeks.length - 1; i++) {
    if (weeks[i]!.revenue > weeks[i + 1]!.revenue) {
      growthStreak++;
    } else {
      break;
    }
  }

  let declineStreak = 0;
  for (let i = 0; i < weeks.length - 1; i++) {
    if (weeks[i]!.revenue < weeks[i + 1]!.revenue) {
      declineStreak++;
    } else {
      break;
    }
  }

  let profitableStreak = 0;
  for (const week of weeks) {
    if (week.profit > 0) {
      profitableStreak++;
    } else {
      break;
    }
  }

  let paidOnTimeStreak = 0;
  for (const week of weeks) {
    if (!week.hasOverdue) {
      paidOnTimeStreak++;
    } else {
      break;
    }
  }

  if (growthStreak >= 2) {
    return {
      type: "revenue_growth",
      count: growthStreak,
      description: `${growthStreak} consecutive growth weeks`,
    };
  }

  if (profitableStreak >= 3) {
    return {
      type: "profitable",
      count: profitableStreak,
      description: `${profitableStreak} profitable weeks in a row`,
    };
  }

  if (paidOnTimeStreak >= 3) {
    return {
      type: "invoices_paid_on_time",
      count: paidOnTimeStreak,
      description: `${paidOnTimeStreak} weeks with all invoices paid on time`,
    };
  }

  if (declineStreak >= 2) {
    return {
      type: "revenue_decline",
      count: declineStreak,
      description: `Revenue down ${declineStreak} weeks in a row`,
    };
  }

  return { type: null, count: 0, description: null };
}

export async function getHistoricalContext(
  db: Database,
  params: {
    teamId: string;
    currentRevenue: number;
    currentProfit: number;
    currentPeriodYear: number;
    currentPeriodNumber: number;
  },
): Promise<HistoricalContext> {
  const {
    teamId,
    currentRevenue,
    currentProfit,
    currentPeriodYear,
    currentPeriodNumber,
  } = params;

  const pastInsights = (
    await listCompletedWeeklyInsights(db, {
      teamId,
      excludeCurrentPeriod: {
        year: currentPeriodYear,
        number: currentPeriodNumber,
      },
      limit: 52,
    })
  ).sort(
    (left, right) => right.periodStart.getTime() - left.periodStart.getTime(),
  );

  const weeksOfHistory = pastInsights.length;

  if (weeksOfHistory < 4) {
    return {
      revenueRank: null,
      profitRank: null,
      isAllTimeRevenueHigh: false,
      isAllTimeProfitHigh: false,
      isRecentRevenueHigh: false,
      isRecentProfitHigh: false,
      weeksOfHistory,
    };
  }

  const historicalWeeks = pastInsights
    .map((insight) => {
      const metrics = insight.allMetrics as Record<
        string,
        { value: number }
      > | null;
      if (!metrics) return null;

      return {
        revenue: metrics.revenue?.value ?? 0,
        profit: metrics.netProfit?.value ?? metrics.profit?.value ?? 0,
        periodStart: insight.periodStart,
      };
    })
    .filter(
      (w): w is { revenue: number; profit: number; periodStart: Date } =>
        w !== null && w.revenue > 0,
    );

  if (historicalWeeks.length < 4) {
    return {
      revenueRank: null,
      profitRank: null,
      isAllTimeRevenueHigh: false,
      isAllTimeProfitHigh: false,
      isRecentRevenueHigh: false,
      isRecentProfitHigh: false,
      weeksOfHistory: historicalWeeks.length,
    };
  }

  const revenueRank =
    historicalWeeks.filter((w) => w.revenue > currentRevenue).length + 1;
  const isAllTimeRevenueHigh = revenueRank === 1;

  let revenueHighestSince: string | undefined;
  if (revenueRank <= 3 && revenueRank > 1) {
    const higherWeek = historicalWeeks.find((w) => w.revenue > currentRevenue);
    if (higherWeek) {
      revenueHighestSince = format(higherWeek.periodStart, "MMMM yyyy");
    }
  }

  const profitRank =
    historicalWeeks.filter((w) => w.profit > currentProfit).length + 1;
  const isAllTimeProfitHigh = profitRank === 1 && currentProfit > 0;

  let profitHighestSince: string | undefined;
  if (profitRank <= 3 && profitRank > 1 && currentProfit > 0) {
    const higherWeek = historicalWeeks.find((w) => w.profit > currentProfit);
    if (higherWeek) {
      profitHighestSince = format(higherWeek.periodStart, "MMMM yyyy");
    }
  }

  const isRecentRevenueHigh = revenueRank <= 3 && historicalWeeks.length >= 8;
  const isRecentProfitHigh =
    profitRank <= 3 && historicalWeeks.length >= 8 && currentProfit > 0;

  let yearOverYear: HistoricalContext["yearOverYear"];
  const lastYearWeekNumber = currentPeriodNumber;
  const lastYearYear = currentPeriodYear - 1;

  const lastYearInsight = pastInsights.find(
    (insight) =>
      insight.periodYear === lastYearYear &&
      insight.periodNumber === lastYearWeekNumber,
  );

  if (lastYearInsight) {
    const lastYearMetrics = lastYearInsight.allMetrics as Record<
      string,
      { value: number }
    > | null;
    if (lastYearMetrics) {
      const lastYearRevenue = lastYearMetrics.revenue?.value ?? 0;
      const lastYearProfit =
        lastYearMetrics.netProfit?.value ?? lastYearMetrics.profit?.value ?? 0;

      const revenueChangePercent =
        lastYearRevenue > 0
          ? Math.round(
              ((currentRevenue - lastYearRevenue) / lastYearRevenue) * 100,
            )
          : 0;
      const profitChangePercent =
        lastYearProfit !== 0
          ? Math.round(
              ((currentProfit - lastYearProfit) / Math.abs(lastYearProfit)) *
                100,
            )
          : 0;

      yearOverYear = {
        lastYearRevenue,
        lastYearProfit,
        revenueChangePercent,
        profitChangePercent,
        hasComparison: lastYearRevenue > 0,
      };
    }
  }

  return {
    revenueRank,
    revenueHighestSince,
    profitRank,
    profitHighestSince,
    isAllTimeRevenueHigh,
    isAllTimeProfitHigh,
    isRecentRevenueHigh,
    isRecentProfitHigh,
    weeksOfHistory: historicalWeeks.length,
    yearOverYear,
  };
}

export async function getMomentumFromHistory(
  db: Database,
  params: {
    teamId: string;
    currentRevenue: number;
    currentPeriodYear: number;
    currentPeriodNumber: number;
  },
): Promise<{
  momentum: MomentumType;
  currentGrowthRate: number;
  previousGrowthRate: number;
} | null> {
  const { teamId, currentRevenue, currentPeriodYear, currentPeriodNumber } =
    params;

  const pastInsights = await listCompletedWeeklyInsights(db, {
    teamId,
    excludeCurrentPeriod: {
      year: currentPeriodYear,
      number: currentPeriodNumber,
    },
    limit: 2,
  });

  if (pastInsights.length < 2) {
    return null;
  }

  const previousWeek = pastInsights[0]!.allMetrics as Record<
    string,
    { value: number }
  > | null;
  const weekBefore = pastInsights[1]!.allMetrics as Record<
    string,
    { value: number }
  > | null;

  const prevRevenue = previousWeek?.revenue?.value ?? 0;
  const weekBeforeRevenue = weekBefore?.revenue?.value ?? 0;

  if (prevRevenue === 0 || weekBeforeRevenue === 0) {
    return null;
  }

  const currentGrowthRate =
    ((currentRevenue - prevRevenue) / prevRevenue) * 100;
  const previousGrowthRate =
    ((prevRevenue - weekBeforeRevenue) / weekBeforeRevenue) * 100;

  return {
    momentum: detectMomentum(currentGrowthRate, previousGrowthRate),
    currentGrowthRate: Math.round(currentGrowthRate * 10) / 10,
    previousGrowthRate: Math.round(previousGrowthRate * 10) / 10,
  };
}

export async function detectRecovery(
  db: Database,
  params: {
    teamId: string;
    currentRevenue: number;
    currentPeriodYear: number;
    currentPeriodNumber: number;
  },
): Promise<RecoveryInfo> {
  const { teamId, currentRevenue, currentPeriodYear, currentPeriodNumber } =
    params;

  const pastInsights = await listCompletedWeeklyInsights(db, {
    teamId,
    excludeCurrentPeriod: {
      year: currentPeriodYear,
      number: currentPeriodNumber,
    },
    limit: 8,
  });

  if (pastInsights.length < 2) {
    return { isRecovery: false, downWeeksBefore: 0 };
  }

  const revenues = pastInsights
    .map((i) => {
      const metrics = i.allMetrics as Record<string, { value: number }> | null;
      return metrics?.revenue?.value ?? 0;
    })
    .filter((r) => r > 0);

  if (revenues.length < 2) {
    return { isRecovery: false, downWeeksBefore: 0 };
  }

  const previousRevenue = revenues[0]!;

  if (currentRevenue <= previousRevenue) {
    return { isRecovery: false, downWeeksBefore: 0 };
  }

  let downWeeksBefore = 0;
  for (let i = 0; i < revenues.length - 1; i++) {
    if (revenues[i]! < revenues[i + 1]!) {
      downWeeksBefore++;
    } else {
      break;
    }
  }

  if (downWeeksBefore === 0) {
    return { isRecovery: false, downWeeksBefore: 0 };
  }

  const recoveryPercent =
    ((currentRevenue - previousRevenue) / previousRevenue) * 100;
  let strength: "strong" | "moderate" | "mild";
  if (recoveryPercent >= 20) {
    strength = "strong";
  } else if (recoveryPercent >= 10) {
    strength = "moderate";
  } else {
    strength = "mild";
  }

  let description: string;
  if (downWeeksBefore >= 3) {
    description = `Bounced back after ${downWeeksBefore} down weeks`;
  } else if (downWeeksBefore === 2) {
    description = "Bounced back after 2 down weeks";
  } else {
    description = "Bounced back from last week's dip";
  }

  return {
    isRecovery: true,
    downWeeksBefore,
    strength,
    description,
  };
}

export async function getPreviousInsightPredictions(
  db: Database,
  params: {
    teamId: string;
    currentPeriodYear: number;
    currentPeriodNumber: number;
  },
): Promise<{
  predictions: InsightPredictions | null;
  periodStart: Date | null;
} | null> {
  const { teamId, currentPeriodYear, currentPeriodNumber } = params;

  const [previousInsight] = await listCompletedWeeklyInsights(db, {
    teamId,
    excludeCurrentPeriod: {
      year: currentPeriodYear,
      number: currentPeriodNumber,
    },
    limit: 1,
  });

  if (!previousInsight) {
    return null;
  }

  return {
    predictions: previousInsight.predictions,
    periodStart: previousInsight.periodStart,
  };
}
