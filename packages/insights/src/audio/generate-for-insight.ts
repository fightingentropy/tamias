import type {
  InsightActivity,
  InsightContent,
  InsightMetric,
} from "@tamias/app-data/types/insights";
/**
 * Reusable audio generation for insights
 *
 * Used by:
 * - API endpoints for lazy generation (on-demand when user clicks "Listen")
 * - Can be called from worker if eager generation is needed
 */
import { generateAudio, isAudioEnabled } from "./generator";
import { buildAudioScript } from "./script";
import { uploadInsightAudio } from "./storage";

/**
 * Minimal insight data needed for audio generation
 */
export type InsightForAudio = {
  id: string;
  teamId: string;
  content: InsightContent | null;
  selectedMetrics: InsightMetric[] | null;
  activity: InsightActivity | null;
  currency: string | null;
  periodType: string;
  periodYear: number;
  periodNumber: number;
};

/**
 * Result of audio generation
 */
export type AudioGenerationResult = {
  audioPath: string;
  scriptLength: number;
};

/**
 * Get period label from insight data
 */
function getPeriodLabel(periodType: string, periodYear: number, periodNumber: number): string {
  switch (periodType) {
    case "weekly":
      return `Week ${periodNumber}, ${periodYear}`;
    case "monthly": {
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      return `${monthNames[periodNumber - 1]} ${periodYear}`;
    }
    case "quarterly":
      return `Q${periodNumber} ${periodYear}`;
    case "yearly":
      return `${periodYear} Year in Review`;
    default:
      return `${periodType} ${periodNumber}, ${periodYear}`;
  }
}

/**
 * Generate audio for an insight and upload to storage
 *
 * @param insight - Insight data (must have content)
 * @returns Audio path in storage
 * @throws Error if audio generation is not enabled or content is missing
 */
export async function generateInsightAudio(
  insight: InsightForAudio,
): Promise<AudioGenerationResult> {
  if (!isAudioEnabled()) {
    throw new Error("Audio generation is not available (provider removed).");
  }

  if (!insight.content) {
    throw new Error("Insight content is required for audio generation");
  }

  const periodLabel = getPeriodLabel(insight.periodType, insight.periodYear, insight.periodNumber);

  // Build audio script from insight content
  const script = buildAudioScript(
    insight.content,
    periodLabel,
    insight.selectedMetrics ?? [],
    insight.activity ?? undefined,
    insight.currency ?? undefined,
  );

  // Generate audio via ElevenLabs
  const audioBuffer = await generateAudio(script);

  // Upload to Convex storage
  const audioPath = await uploadInsightAudio(insight.teamId, insight.id, audioBuffer);

  return {
    audioPath,
    scriptLength: script.length,
  };
}

/**
 * Check if audio can be generated for an insight
 */
export function canGenerateAudio(insight: InsightForAudio): boolean {
  return isAudioEnabled() && insight.content !== null;
}
