import type {
  InsightHistoryData,
  MomentumType,
  RecoveryInfo,
} from "../types";

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

  const previousRevenue = history.weeks[0]!.revenue;
  const weekBeforeRevenue = history.weeks[1]!.revenue;

  if (previousRevenue === 0 || weekBeforeRevenue === 0) {
    return null;
  }

  const currentGrowthRate =
    ((currentRevenue - previousRevenue) / previousRevenue) * 100;
  const previousGrowthRate =
    ((previousRevenue - weekBeforeRevenue) / weekBeforeRevenue) * 100;

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
    .filter((week) => week.revenue > 0)
    .map((week) => week.revenue);

  if (revenues.length < 2) {
    return { isRecovery: false, downWeeksBefore: 0 };
  }

  const previousRevenue = revenues[0]!;

  if (currentRevenue <= previousRevenue) {
    return { isRecovery: false, downWeeksBefore: 0 };
  }

  let downWeeksBefore = 0;
  for (let index = 0; index < revenues.length - 1; index++) {
    if (revenues[index]! < revenues[index + 1]!) {
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
  const strength =
    recoveryPercent >= 20
      ? "strong"
      : recoveryPercent >= 10
        ? "moderate"
        : "mild";

  return {
    isRecovery: true,
    downWeeksBefore,
    strength,
    description:
      downWeeksBefore >= 3
        ? `Bounced back after ${downWeeksBefore} down weeks`
        : downWeeksBefore === 2
          ? "Bounced back after 2 down weeks"
          : "Bounced back from last week's dip",
  };
}
