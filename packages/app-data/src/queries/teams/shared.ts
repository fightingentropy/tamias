import type { AIProvider } from "@tamias/domain/identity";

export type TeamRole = "owner" | "member";
export type SerializableJson =
  | string
  | number
  | boolean
  | null
  | SerializableJson[]
  | { [key: string]: SerializableJson };
export type SerializableJsonObject = { [key: string]: SerializableJson };

export type TeamListIdentityRecord = {
  id: string;
  name: string | null;
  logoUrl: string | null;
  email: string | null;
  inboxId: string | null;
  plan: string | null;
  exportSettings?: SerializableJsonObject;
  stripeAccountId?: string | null;
  stripeConnectStatus?: string | null;
  createdAt: string;
  canceledAt: string | null;
  countryCode: string | null;
  baseCurrency: string | null;
  fiscalYearStartMonth: number | null;
  companyType: string | null;
  heardAbout: string | null;
  role: TeamRole;
};

export type TeamIdentityRecord = Omit<TeamListIdentityRecord, "role">;
export type TeamRecord = TeamIdentityRecord;
export type UserId = string;

export type TeamMemberIdentityRecord = {
  id: string;
  role: TeamRole;
  teamId: string;
  createdAt: string;
  user: {
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
    email: string | null;
    timezone: string | null;
    locale: string | null;
  };
};

export type CurrentUserIdentityRecord = {
  id: string;
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  locale: string;
  weekStartsOnMonday: boolean;
  timezone: string | null;
  timezoneAutoSync: boolean;
  timeFormat: number;
  dateFormat: string | null;
  aiProvider?: AIProvider | null;
  teamId: string | null;
  team: TeamIdentityRecord | null;
};

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
  ownerTimezone: string;
};
