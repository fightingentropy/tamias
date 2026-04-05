import type { Database } from "../../../client";
import {
  computeHistoricalContext,
  computeMomentum,
  computeRecovery,
  computeRollingAverages,
  computeStreakInfo,
  getPredictionsFromHistory,
} from "./analytics";
import { getInsightHistory } from "./data";
import type {
  HistoricalContext,
  RecoveryInfo,
  RollingAverages,
  StreakInfo,
} from "./types";

function buildExcludedCurrentPeriod(params: {
  currentPeriodYear?: number;
  currentPeriodNumber?: number;
}) {
  return params.currentPeriodYear && params.currentPeriodNumber
    ? {
        year: params.currentPeriodYear,
        number: params.currentPeriodNumber,
      }
    : undefined;
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
  const weeksBack = params.weeksBack ?? 4;
  const history = await getInsightHistory(db, {
    teamId: params.teamId,
    weeksBack,
    excludeCurrentPeriod: buildExcludedCurrentPeriod(params),
  });

  return computeRollingAverages(history, weeksBack);
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
  const history = await getInsightHistory(db, {
    teamId: params.teamId,
    weeksBack: 8,
    excludeCurrentPeriod: {
      year: params.currentPeriodYear,
      number: params.currentPeriodNumber,
    },
  });

  return computeStreakInfo(
    {
      ...history,
      weeks: history.weeks.map((week) => ({
        ...week,
        // Preserve the legacy API behavior: weeks without overdue invoices count
        // toward the paid-on-time streak even when invoice counts are unavailable.
        invoicesPaid: 1,
      })),
    },
    {
      revenue: params.currentRevenue,
      profit: params.currentProfit,
      hasOverdue: params.hasOverdueInvoices,
      invoicesPaid: 1,
    },
  );
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
  const history = await getInsightHistory(db, {
    teamId: params.teamId,
    weeksBack: 52,
    excludeCurrentPeriod: {
      year: params.currentPeriodYear,
      number: params.currentPeriodNumber,
    },
  });
  const { quarterPace: _quarterPace, ...context } = computeHistoricalContext(
    history,
    {
      revenue: params.currentRevenue,
      profit: params.currentProfit,
      periodYear: params.currentPeriodYear,
      periodNumber: params.currentPeriodNumber,
    },
  );

  return context;
}

export async function getMomentumFromHistory(
  db: Database,
  params: {
    teamId: string;
    currentRevenue: number;
    currentPeriodYear: number;
    currentPeriodNumber: number;
  },
) {
  const history = await getInsightHistory(db, {
    teamId: params.teamId,
    weeksBack: 2,
    excludeCurrentPeriod: {
      year: params.currentPeriodYear,
      number: params.currentPeriodNumber,
    },
  });

  return computeMomentum(history, params.currentRevenue);
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
  const history = await getInsightHistory(db, {
    teamId: params.teamId,
    weeksBack: 8,
    excludeCurrentPeriod: {
      year: params.currentPeriodYear,
      number: params.currentPeriodNumber,
    },
  });

  return computeRecovery(history, params.currentRevenue);
}

export async function getPreviousInsightPredictions(
  db: Database,
  params: {
    teamId: string;
    currentPeriodYear: number;
    currentPeriodNumber: number;
  },
) {
  const history = await getInsightHistory(db, {
    teamId: params.teamId,
    weeksBack: 1,
    excludeCurrentPeriod: {
      year: params.currentPeriodYear,
      number: params.currentPeriodNumber,
    },
  });

  return getPredictionsFromHistory(history);
}
