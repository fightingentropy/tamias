import type { InsightPredictions } from "../../../../types/insights";
import type { InsightHistoryData } from "../types";

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
