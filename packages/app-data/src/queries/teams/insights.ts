import { listInsightEligibleTeamsFromConvexIdentity } from "../../convex";
import type { Database } from "../../client";
import type {
  GetTeamsForInsightsParams,
  InsightEligibleTeam,
} from "./shared";

/**
 * Get teams eligible for insights generation.
 *
 * Eligible teams are:
 * - Paying customers (starter/pro plans)
 * - Active trial users (created within past N days, not canceled)
 * - Must have baseCurrency set (indicates they have financial data)
 * - If targetLocalHour is set, only teams where it's that hour locally
 *
 * Uses cursor-based pagination for efficient batch processing.
 *
 * @param db - Database instance
 * @param params - Query parameters
 * @returns Array of eligible teams with their base currency
 */
export async function getTeamsForInsights(
  _db: Database,
  params: GetTeamsForInsightsParams = {},
): Promise<InsightEligibleTeam[]> {
  const {
    enabledTeamIds,
    cursor,
    limit = 100,
    trialEligibilityDays = 30,
    targetLocalHour,
  } = params;

  const result = await listInsightEligibleTeamsFromConvexIdentity({
    enabledTeamIds,
    cursor,
    limit,
    trialEligibilityDays,
  });

  const now = new Date();
  const enrichedTeams: InsightEligibleTeam[] = [];

  for (const team of result) {
    if (targetLocalHour !== undefined) {
      const localHour = getHourInTimezone(now, team.ownerTimezone);
      if (localHour !== targetLocalHour) {
        continue;
      }
    }

    enrichedTeams.push({
      id: team.id,
      baseCurrency: team.baseCurrency,
      ownerLocale: team.ownerLocale,
    });
  }

  return enrichedTeams;
}

function getHourInTimezone(date: Date, timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const hourPart = parts.find((p) => p.type === "hour");
    return hourPart ? Number.parseInt(hourPart.value, 10) : date.getUTCHours();
  } catch {
    return date.getUTCHours();
  }
}
