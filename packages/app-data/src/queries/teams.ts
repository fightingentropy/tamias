import {
  countTransactionsFromConvex,
  createTeamForUserInConvexIdentity,
  type CurrentUserIdentityRecord,
  deleteTeamByIdInConvexIdentity,
  getBankConnectionsFromConvex,
  getPublicInvoicesByTeamFromConvex,
  getTeamByIdFromConvexIdentity,
  getTeamByInboxIdFromConvexIdentity,
  getTeamByStripeAccountIdFromConvexIdentity,
  getTeamMembersFromConvexIdentity,
  listInsightEligibleTeamsFromConvexIdentity,
  type TeamIdentityRecord,
  type UpdateTeamInConvexIdentityInput,
  updateTeamByIdInConvexIdentity,
} from "@tamias/app-data-convex";
import type { Database, QueryClient } from "../client";
import { cacheAcrossRequests } from "../utils/short-lived-cache";

export type TeamRecord = TeamIdentityRecord;
type ConvexUserId = CurrentUserIdentityRecord["convexId"];

async function getTeamByIdImpl(
  _db: Database | QueryClient,
  id: string,
) {
  return getTeamByIdFromConvexIdentity({ teamId: id });
}

const getTeamByIdCached = cacheAcrossRequests({
  keyPrefix: "team-by-id",
  keyFn: (id: string) => id,
  load: async (_db: Database, id: string) =>
    getTeamByIdImpl(_db as Database | QueryClient, id),
});

export async function getTeamById(_db: Database | QueryClient, id: string) {
  return getTeamByIdCached(_db as Database, id);
}

export const getTeamByInboxId = async (
  _db: Database | QueryClient,
  inboxId: string,
) => {
  return getTeamByInboxIdFromConvexIdentity({ inboxId });
};

/**
 * Get a team by their Stripe Connect account ID.
 * Used by webhooks to find which team a connected account belongs to.
 *
 * @param db - Database instance
 * @param stripeAccountId - The Stripe connected account ID (acct_xxx)
 * @returns The team if found, undefined otherwise
 */
export const getTeamByStripeAccountId = async (
  _db: Database | QueryClient,
  stripeAccountId: string,
) => {
  return getTeamByStripeAccountIdFromConvexIdentity({ stripeAccountId });
};

type UpdateTeamParams = {
  id: string;
  data: Omit<UpdateTeamInConvexIdentityInput, "teamId">;
};

export const updateTeamById = async (
  _db: Database,
  params: UpdateTeamParams,
) => {
  const { id, data } = params;

  return updateTeamByIdInConvexIdentity({
    teamId: id,
    ...data,
  });
};

type CreateTeamParams = {
  id?: string;
  name: string;
  userId: ConvexUserId;
  email: string;
  baseCurrency?: string;
  countryCode?: string;
  fiscalYearStartMonth?: number | null;
  logoUrl?: string;
  companyType?: string;
  heardAbout?: string;
  switchTeam?: boolean;
};

export const createTeam = async (_db: Database, params: CreateTeamParams) => {
  const team = await createTeamForUserInConvexIdentity({
    userId: params.userId,
    email: params.email,
    teamId: params.id,
    name: params.name,
    baseCurrency: params.baseCurrency,
    countryCode: params.countryCode,
    fiscalYearStartMonth: params.fiscalYearStartMonth,
    logoUrl: params.logoUrl,
    companyType: params.companyType,
    heardAbout: params.heardAbout,
    switchTeam: params.switchTeam,
  });

  if (!team) {
    throw new Error("Failed to create team.");
  }

  return team;
};

async function getTeamMembersImpl(_db: Database, teamId: string) {
  const members = await getTeamMembersFromConvexIdentity({ teamId });

  return members.map((member) => ({
    id: member.user.id,
    convexId: member.user.convexId,
    role: member.role,
    fullName: member.user.fullName,
    avatarUrl: member.user.avatarUrl,
    email: member.user.email,
    timezone: member.user.timezone,
    locale: member.user.locale,
  }));
}

export const getTeamMembers = cacheAcrossRequests({
  keyPrefix: "team-members",
  keyFn: (teamId: string) => teamId,
  load: getTeamMembersImpl,
});

type DeleteTeamParams = {
  teamId: string;
};

export async function deleteTeam(_db: Database, params: DeleteTeamParams) {
  const teamMembers = await getTeamMembersFromConvexIdentity({
    teamId: params.teamId,
  });

  const result = await deleteTeamByIdInConvexIdentity({
    teamId: params.teamId,
  });

  if (!result) {
    return null;
  }

  return {
    ...result,
    memberUserIds: teamMembers.map((member) => member.user.id),
  };
}

type GetAvailablePlansResult = {
  starter: boolean;
};

export async function getAvailablePlans(
  _db: Database,
  _teamId: string,
): Promise<GetAvailablePlansResult> {
  return {
    starter: true,
  };
}

/**
 * Owner info returned from getTeamOwnerInfo
 */
export type TeamOwnerInfo = {
  timezone: string;
  locale: string;
};

/**
 * Get the team owner's timezone and locale.
 * Owner is defined as the earliest team membership in Convex.
 * Falls back to UTC and "en" if not set.
 *
 * @param db - Database instance
 * @param teamId - Team ID to get owner info for
 * @returns Owner's timezone (IANA format) and locale
 */
export async function getTeamOwnerInfo(
  _db: Database,
  teamId: string,
): Promise<TeamOwnerInfo> {
  const [owner] = await getTeamMembers(_db, teamId);

  return {
    timezone: owner?.timezone || "UTC",
    locale: owner?.locale || "en",
  };
}

/**
 * Get the team owner's timezone.
 * Owner is defined as the earliest team membership in Convex.
 * Falls back to UTC if no timezone is set.
 *
 * @param db - Database instance
 * @param teamId - Team ID to get owner timezone for
 * @returns Owner's timezone (IANA format) or "UTC" as fallback
 */
export async function getTeamOwnerTimezone(
  db: Database,
  teamId: string,
): Promise<string> {
  const info = await getTeamOwnerInfo(db, teamId);
  return info.timezone;
}

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

  // Enrich results with owner locale (and filter by timezone if needed)
  const now = new Date();
  const enrichedTeams: InsightEligibleTeam[] = [];

  for (const team of result) {
    // If targeting a specific hour, filter by timezone
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

/**
 * Get the current hour (0-23) in a given IANA timezone
 */
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
    // Invalid timezone, fall back to UTC
    return date.getUTCHours();
  }
}

export async function getTeamOwnerContact(_db: Database, teamId: string) {
  const members = await getTeamMembers(_db, teamId);
  const owner = members.find((member) => member.role === "owner");

  if (!owner) {
    return null;
  }

  return {
    email: owner.email,
    fullName: owner.fullName,
  };
}

export async function isTeamStillCanceled(db: Database, teamId: string) {
  const team = await getTeamById(db, teamId);

  return !!team?.canceledAt;
}

export async function hasTeamData(db: Database, teamId: string) {
  void db;

  const [transactionCount, bankConnections, invoices] = await Promise.all([
    countTransactionsFromConvex({
      teamId,
    }),
    getBankConnectionsFromConvex({
      teamId,
    }),
    getPublicInvoicesByTeamFromConvex({
      teamId,
    }),
  ]);

  return (
    transactionCount > 0 || bankConnections.length > 0 || invoices.length > 0
  );
}
