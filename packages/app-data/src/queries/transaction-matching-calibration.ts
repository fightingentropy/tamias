import {
  getTransactionMatchSuggestionsPageFromConvex,
  type MatchSuggestionStatus,
} from "../convex";
import type { Database } from "../client";
import { reuseQueryResult } from "../utils/request-cache";
import { CALIBRATION_LIMITS } from "../utils/transaction-matching";
import type { TeamCalibrationData } from "./transaction-matching-types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export async function getTeamSuggestions(
  teamId: string,
  statuses: MatchSuggestionStatus[],
  params?: {
    createdAtFrom?: string;
    limit?: number;
  },
) {
  const rows = (
    await Promise.all(
      [...new Set(statuses)].map(async (status) => {
        const collected = [];
        let cursor: string | null = null;

        while (true) {
          const page = await getTransactionMatchSuggestionsPageFromConvex({
            teamId,
            status,
            cursor,
            pageSize: Math.min(params?.limit ?? 250, 250),
            order: "desc",
            createdAtFrom: params?.createdAtFrom,
          });

          collected.push(...page.page);

          if (page.isDone || collected.length >= (params?.limit ?? Infinity)) {
            return params?.limit ? collected.slice(0, params.limit) : collected;
          }

          cursor = page.continueCursor;
        }
      }),
    )
  )
    .flat()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return params?.limit ? rows.slice(0, params.limit) : rows;
}

function optimizeThresholdFromFeedback(
  performanceData: Array<{
    status: string;
    confidenceScore: number | null;
  }>,
): { threshold: number; sampleSize: number } | null {
  const labeled = performanceData.filter(
    (row) =>
      row.confidenceScore !== null &&
      (row.status === "confirmed" ||
        row.status === "declined" ||
        row.status === "unmatched"),
  );

  const positives = labeled.filter((row) => row.status === "confirmed").length;
  const negatives = labeled.length - positives;

  if (labeled.length < 20 || positives < 5 || negatives < 5) {
    return null;
  }

  let bestThreshold = 0.6;
  let bestF1 = -1;
  let bestPrecision = -1;

  for (let thresholdValue = 0.25; thresholdValue <= 0.9; thresholdValue += 0.01) {
    const threshold = Math.round(thresholdValue * 1000) / 1000;
    let tp = 0;
    let fp = 0;
    let fn = 0;

    for (const row of labeled) {
      const predictedPositive = Number(row.confidenceScore) >= threshold;
      const isPositive = row.status === "confirmed";

      if (predictedPositive && isPositive) tp++;
      else if (predictedPositive && !isPositive) fp++;
      else if (!predictedPositive && isPositive) fn++;
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 =
      precision + recall > 0
        ? (2 * precision * recall) / (precision + recall)
        : 0;

    if (
      f1 > bestF1 ||
      (Math.abs(f1 - bestF1) < 1e-9 && precision > bestPrecision)
    ) {
      bestF1 = f1;
      bestPrecision = precision;
      bestThreshold = threshold;
    }
  }

  return { threshold: bestThreshold, sampleSize: labeled.length };
}

async function loadTeamCalibration(
  _db: Database,
  teamId: string,
): Promise<TeamCalibrationData> {
  const defaultSuggestedThreshold = 0.6;
  const defaultAutoThreshold = 0.9;
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const performanceData = (
    await getTeamSuggestions(teamId, ["confirmed", "declined", "unmatched"], {
      createdAtFrom: cutoff,
    })
  ).map((suggestion) => ({
    status: suggestion.status,
    confidenceScore: suggestion.confidenceScore,
  }));

  if (performanceData.length < 5) {
    return {
      teamId,
      totalSuggestions: performanceData.length,
      confirmedSuggestions: 0,
      declinedSuggestions: 0,
      unmatchedSuggestions: 0,
      avgConfidenceConfirmed: 0,
      avgConfidenceDeclined: 0,
      avgConfidenceUnmatched: 0,
      suggestedMatchAccuracy: 0,
      calibratedSuggestedThreshold: defaultSuggestedThreshold,
      calibratedAutoThreshold: defaultAutoThreshold,
      thresholdOptimizationSampleSize: 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  const confirmed = performanceData.filter((row) => row.status === "confirmed");
  const declined = performanceData.filter((row) => row.status === "declined");
  const unmatched = performanceData.filter((row) => row.status === "unmatched");
  const negativeOutcomes = [...declined, ...unmatched];

  const avgConfidenceConfirmed =
    confirmed.length > 0
      ? confirmed.reduce((sum, row) => sum + Number(row.confidenceScore), 0) /
        confirmed.length
      : 0;
  const avgConfidenceDeclined =
    declined.length > 0
      ? declined.reduce((sum, row) => sum + Number(row.confidenceScore), 0) /
        declined.length
      : 0;
  const avgConfidenceUnmatched =
    unmatched.length > 0
      ? unmatched.reduce((sum, row) => sum + Number(row.confidenceScore), 0) /
        unmatched.length
      : 0;
  const avgConfidenceNegative =
    negativeOutcomes.length > 0
      ? negativeOutcomes.reduce(
          (sum, row) => sum + Number(row.confidenceScore),
          0,
        ) / negativeOutcomes.length
      : avgConfidenceDeclined;
  const suggestedMatchAccuracy = confirmed.length / performanceData.length;

  let calibratedSuggestedThreshold = defaultSuggestedThreshold;

  if (
    suggestedMatchAccuracy > 0.9 &&
    confirmed.length >= CALIBRATION_LIMITS.MIN_SAMPLES_CONSERVATIVE
  ) {
    calibratedSuggestedThreshold = Math.max(
      0.65,
      defaultSuggestedThreshold -
        Math.min(CALIBRATION_LIMITS.MAX_ADJUSTMENT, 0.03),
    );
  } else if (
    suggestedMatchAccuracy > 0.8 &&
    confirmed.length >= CALIBRATION_LIMITS.MIN_SAMPLES_SUGGESTED
  ) {
    calibratedSuggestedThreshold = Math.max(
      0.67,
      defaultSuggestedThreshold -
        Math.min(CALIBRATION_LIMITS.MAX_ADJUSTMENT, 0.02),
    );
  } else if (
    suggestedMatchAccuracy < 0.3 &&
    declined.length >= CALIBRATION_LIMITS.MIN_SAMPLES_SUGGESTED
  ) {
    calibratedSuggestedThreshold = Math.min(
      0.85,
      defaultSuggestedThreshold +
        Math.min(CALIBRATION_LIMITS.MAX_ADJUSTMENT, 0.03),
    );
  }

  if (
    avgConfidenceConfirmed > 0 &&
    avgConfidenceNegative > 0 &&
    confirmed.length >= CALIBRATION_LIMITS.MIN_SAMPLES_SUGGESTED
  ) {
    const confidenceGap = avgConfidenceConfirmed - avgConfidenceNegative;

    if (confidenceGap > 0.2) {
      calibratedSuggestedThreshold = Math.max(
        0.65,
        calibratedSuggestedThreshold -
          Math.min(CALIBRATION_LIMITS.MAX_ADJUSTMENT, 0.025),
      );
    } else if (confidenceGap < 0.08) {
      calibratedSuggestedThreshold = Math.min(
        0.82,
        calibratedSuggestedThreshold +
          Math.min(CALIBRATION_LIMITS.MAX_ADJUSTMENT, 0.02),
      );
    }
  }

  const optimizedThreshold = optimizeThresholdFromFeedback(performanceData);

  if (optimizedThreshold) {
    const optimized = clamp(optimizedThreshold.threshold, 0.55, 0.85);
    calibratedSuggestedThreshold = clamp(
      calibratedSuggestedThreshold * 0.35 + optimized * 0.65,
      0.55,
      0.85,
    );
  }

  return {
    teamId,
    totalSuggestions: performanceData.length,
    confirmedSuggestions: confirmed.length,
    declinedSuggestions: declined.length,
    unmatchedSuggestions: unmatched.length,
    avgConfidenceConfirmed,
    avgConfidenceDeclined,
    avgConfidenceUnmatched,
    suggestedMatchAccuracy,
    calibratedSuggestedThreshold,
    calibratedAutoThreshold: clamp(
      calibratedSuggestedThreshold + 0.24,
      0.88,
      0.95,
    ),
    thresholdOptimizationSampleSize: optimizedThreshold?.sampleSize ?? 0,
    lastUpdated: new Date().toISOString(),
  };
}

const getTeamCalibrationReused = reuseQueryResult({
  keyPrefix: "transaction-matching-calibration",
  keyFn: (teamId: string) => teamId,
  load: loadTeamCalibration,
});

export async function getTeamCalibration(
  db: Database,
  teamId: string,
): Promise<TeamCalibrationData> {
  return getTeamCalibrationReused(db, teamId);
}
