import type { ConvexTeamId, ConvexUserId } from "./base";
import { api, createClient, serviceArgs } from "./base";

export type TeamRole = "owner" | "member";

export type TeamListIdentityRecord = {
  id: string;
  convexId: ConvexTeamId;
  name: string | null;
  logoUrl: string | null;
  email: string | null;
  inboxId: string | null;
  plan: string | null;
  exportSettings?: unknown;
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

export type InsightEligibleTeamRecord = {
  id: string;
  baseCurrency: string | null;
  ownerLocale: string;
  ownerTimezone: string;
};

export type TeamMemberIdentityRecord = {
  id: string;
  role: TeamRole;
  teamId: string;
  createdAt: string;
  user: {
    id: string;
    convexId: ConvexUserId;
    fullName: string | null;
    avatarUrl: string | null;
    email: string | null;
    timezone: string | null;
    locale: string | null;
  };
};

export type CurrentUserIdentityRecord = {
  id: string;
  convexId: ConvexUserId;
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  locale: string;
  weekStartsOnMonday: boolean;
  timezone: string | null;
  timezoneAutoSync: boolean;
  timeFormat: number;
  dateFormat: string | null;
  teamId: string | null;
  convexTeamId: ConvexTeamId | null;
  team: TeamIdentityRecord | null;
};

export type UpdateUserInConvexIdentityInput = {
  userId?: ConvexUserId;
  currentEmail?: string | null;
  fullName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  locale?: string | null;
  weekStartsOnMonday?: boolean;
  timezone?: string | null;
  timezoneAutoSync?: boolean;
  timeFormat?: 12 | 24;
  dateFormat?: string | null;
};

export type UpdateTeamInConvexIdentityInput = {
  teamId: string;
  name?: string | null;
  logoUrl?: string | null;
  email?: string | null;
  baseCurrency?: string | null;
  countryCode?: string | null;
  fiscalYearStartMonth?: number | null;
  exportSettings?: unknown;
  subscriptionStatus?: string | null;
  stripeAccountId?: string | null;
  stripeConnectStatus?: string | null;
  companyType?: string | null;
  heardAbout?: string | null;
  canceledAt?: string | null;
  plan?: string | null;
};

export type CreateTeamForUserInConvexIdentityInput = {
  userId?: ConvexUserId;
  email?: string | null;
  teamId?: string | null;
  name: string;
  inboxId?: string | null;
  baseCurrency?: string | null;
  countryCode?: string | null;
  fiscalYearStartMonth?: number | null;
  logoUrl?: string | null;
  companyType?: string | null;
  heardAbout?: string | null;
  switchTeam?: boolean;
};

export async function listTeamsForUserFromConvexIdentity(args: {
  userId?: ConvexUserId;
  email?: string | null;
}) {
  return createClient().query(
    api.identity.serviceListTeamsByUserId,
    serviceArgs({
      userId: args.userId,
      email: args.email ?? undefined,
    }),
  ) as Promise<TeamListIdentityRecord[]>;
}

export async function listAllTeamsFromConvexIdentity() {
  return createClient().query(
    api.identity.serviceListAllTeams,
    serviceArgs({}),
  ) as Promise<TeamIdentityRecord[]>;
}

export async function getUserByIdFromConvexIdentity(args: {
  userId: ConvexUserId;
}) {
  return createClient().query(
    api.identity.serviceGetUserById,
    serviceArgs({
      userId: args.userId,
    }),
  ) as Promise<CurrentUserIdentityRecord | null>;
}

export async function getUserByEmailFromConvexIdentity(args: {
  email: string;
}) {
  return createClient().query(
    api.identity.serviceGetUserById,
    serviceArgs({
      email: args.email,
    }),
  ) as Promise<CurrentUserIdentityRecord | null>;
}

export async function updateUserInConvexIdentity(
  args: UpdateUserInConvexIdentityInput,
) {
  return createClient().mutation(
    api.identity.serviceUpdateUserById,
    serviceArgs({
      userId: args.userId,
      currentEmail: args.currentEmail ?? undefined,
      fullName: args.fullName,
      email: args.email,
      avatarUrl: args.avatarUrl,
      locale: args.locale,
      weekStartsOnMonday: args.weekStartsOnMonday,
      timezone: args.timezone,
      timezoneAutoSync: args.timezoneAutoSync,
      timeFormat: args.timeFormat,
      dateFormat: args.dateFormat,
    }),
  ) as Promise<CurrentUserIdentityRecord | null>;
}

export async function getTeamByIdFromConvexIdentity(args: { teamId: string }) {
  return createClient().query(
    api.identity.serviceGetTeamByPublicTeamId,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<TeamIdentityRecord | null>;
}

export async function updateTeamByIdInConvexIdentity(
  args: UpdateTeamInConvexIdentityInput,
) {
  return createClient().mutation(
    api.identity.serviceUpdateTeamByPublicTeamId,
    serviceArgs({
      publicTeamId: args.teamId,
      name: args.name,
      logoUrl: args.logoUrl,
      email: args.email,
      baseCurrency: args.baseCurrency,
      countryCode: args.countryCode,
      fiscalYearStartMonth: args.fiscalYearStartMonth,
      exportSettings: args.exportSettings,
      subscriptionStatus: args.subscriptionStatus,
      stripeAccountId: args.stripeAccountId,
      stripeConnectStatus: args.stripeConnectStatus,
      companyType: args.companyType,
      heardAbout: args.heardAbout,
      canceledAt: args.canceledAt,
      plan: args.plan,
    }),
  ) as Promise<TeamIdentityRecord | null>;
}

export async function getTeamByInboxIdFromConvexIdentity(args: {
  inboxId: string;
}) {
  return createClient().query(
    api.identity.serviceGetTeamByInboxId,
    serviceArgs({
      inboxId: args.inboxId,
    }),
  ) as Promise<TeamIdentityRecord | null>;
}

export async function getTeamByStripeAccountIdFromConvexIdentity(args: {
  stripeAccountId: string;
}) {
  return createClient().query(
    api.identity.serviceGetTeamByStripeAccountId,
    serviceArgs({
      stripeAccountId: args.stripeAccountId,
    }),
  ) as Promise<TeamIdentityRecord | null>;
}

export async function listInsightEligibleTeamsFromConvexIdentity(args?: {
  enabledTeamIds?: string[];
  cursor?: string | null;
  limit?: number;
  trialEligibilityDays?: number;
}) {
  return createClient().query(
    api.identity.serviceListInsightEligibleTeams,
    serviceArgs({
      enabledTeamIds: args?.enabledTeamIds,
      cursor: args?.cursor,
      limit: args?.limit,
      trialEligibilityDays: args?.trialEligibilityDays,
    }),
  ) as Promise<InsightEligibleTeamRecord[]>;
}

export async function getTeamMembersFromConvexIdentity(args: {
  teamId: string;
}) {
  return createClient().query(
    api.identity.serviceGetTeamMembersByPublicTeamId,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<TeamMemberIdentityRecord[]>;
}

export async function createTeamForUserInConvexIdentity(
  args: CreateTeamForUserInConvexIdentityInput,
) {
  const teamId = (await createClient().mutation(
    api.identity.serviceCreateTeamForUserId,
    serviceArgs({
      userId: args.userId,
      email: args.email ?? undefined,
      publicTeamId: args.teamId ?? undefined,
      name: args.name,
      inboxId: args.inboxId ?? undefined,
      baseCurrency: args.baseCurrency,
      countryCode: args.countryCode,
      fiscalYearStartMonth: args.fiscalYearStartMonth,
      logoUrl: args.logoUrl,
      companyType: args.companyType,
      heardAbout: args.heardAbout,
      switchTeam: args.switchTeam,
    }),
  )) as string | null;

  if (!teamId) {
    return null;
  }

  return getTeamByIdFromConvexIdentity({ teamId });
}

export async function deleteTeamByIdInConvexIdentity(args: { teamId: string }) {
  return createClient().mutation(
    api.identity.serviceDeleteTeamByPublicTeamId,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<{ id: string } | null>;
}

export async function deleteUserInConvexIdentity(args: {
  userId?: ConvexUserId;
  email?: string | null;
}) {
  return createClient().mutation(
    api.identity.serviceDeleteUserById,
    serviceArgs({
      userId: args.userId,
      email: args.email ?? undefined,
    }),
  ) as Promise<{ id: string } | null>;
}
