import type { InsightPredictions } from "../../../types/insights";

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

export type RollingAverages = {
  avgRevenue: number;
  avgExpenses: number;
  avgProfit: number;
  weeksIncluded: number;
};
