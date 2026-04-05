import type {
  CurrentUserIdentityRecord,
  TeamIdentityRecord,
} from "@tamias/app-data-convex";

export type TeamRecord = TeamIdentityRecord;
export type ConvexUserId = CurrentUserIdentityRecord["convexId"];

/**
 * Owner info returned from getTeamOwnerInfo
 */
export type TeamOwnerInfo = {
  timezone: string;
  locale: string;
};

/**
 * Parameters for getting teams eligible for insights generation
 */
export type GetTeamsForInsightsParams = {
  /** Optional list of specific team IDs to filter by */
  enabledTeamIds?: string[];
  /** Cursor for pagination (team ID to start after) */
  cursor?: string | null;
  /** Number of teams to fetch per batch */
  limit?: number;
  /** Number of days a trial team can be eligible (default: 30) */
  trialEligibilityDays?: number;
  /** Only return teams where it's currently this hour (0-23) in their local time */
  targetLocalHour?: number;
};

/**
 * Result type for teams eligible for insights
 */
export type InsightEligibleTeam = {
  id: string;
  baseCurrency: string | null;
  ownerLocale: string;
};
