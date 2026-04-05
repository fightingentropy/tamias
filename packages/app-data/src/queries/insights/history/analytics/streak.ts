import type { InsightHistoryData, StreakInfo } from "../types";

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
  for (let index = 0; index < weeks.length - 1; index++) {
    if (weeks[index]!.revenue > weeks[index + 1]!.revenue) {
      growthStreak++;
    } else {
      break;
    }
  }

  let declineStreak = 0;
  for (let index = 0; index < weeks.length - 1; index++) {
    if (weeks[index]!.revenue < weeks[index + 1]!.revenue) {
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
