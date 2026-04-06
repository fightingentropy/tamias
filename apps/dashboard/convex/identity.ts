import { v } from "convex/values";
import {
  buildTeamDefaults,
  normalizeEmail,
  normalizeOptionalString,
  nowIso,
} from "../../../packages/domain/src/identity";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { rebuildDerivedComplianceJournalEntriesForTeam } from "./complianceLedger";
import {
  createConvexTeamForUser,
  ensureCurrentAppUserRecord,
  getTeamByInboxId,
  getTeamByPublicTeamId,
  getTeamInviteByPublicInviteId,
  getTeamMembershipsByTeamId,
  getTeamByStripeAccountId,
  listTeamsForUser,
  publicTeamId,
  publicUserId,
  requireCurrentAppUser,
  requireMembership,
  resolveAppUserByIdOrEmail,
  serializeCurrentUser,
  serializeTeam,
  resolveCurrentTeam,
} from "./lib/identity";
import { requireServiceKey } from "./lib/service";

const TRIAL_PERIOD_DAYS = 14;
const aiProviderValidator = v.union(
  v.literal("openai"),
  v.literal("kimi"),
  v.literal("openrouter"),
);
type IdentityCtx = Parameters<typeof serializeCurrentUser>[0];
type InsightEligibleTeamCandidate = {
  publicId: string;
  team: Doc<"teams">;
};

function getTrialActive(team: {
  plan?: string;
  canceledAt?: string;
  createdAt: string;
}) {
  if (team.plan === "starter" || team.plan === "pro") {
    return true;
  }

  if (team.plan !== "trial" || team.canceledAt) {
    return false;
  }

  return (
    Date.parse(team.createdAt) + TRIAL_PERIOD_DAYS * 24 * 60 * 60 * 1000 >
    Date.now()
  );
}

function buildInviteCode() {
  return crypto.randomUUID().replaceAll("-", "");
}

async function serializeTeamMember(
  ctx: IdentityCtx,
  membership: Doc<"teamMembers">,
) {
  const [team, appUser] = await Promise.all([
    ctx.db.get(membership.teamId),
    ctx.db.get(membership.appUserId),
  ]);

  const teamId = publicTeamId(team);
  const userId = publicUserId(appUser);

  if (!teamId || !appUser || !userId) {
    return null;
  }

  return {
    id: membership._id,
    role: membership.role,
    teamId,
    createdAt: membership.createdAt,
    user: {
      id: userId,
      convexId: appUser._id,
      fullName: appUser.fullName ?? null,
      avatarUrl: appUser.avatarUrl ?? null,
      email: appUser.email ?? null,
      timezone: appUser.timezone ?? null,
      locale: appUser.locale ?? null,
    },
  };
}

async function serializeTeamInvite(
  ctx: IdentityCtx,
  invite: Doc<"teamInvites">,
) {
  const [team, invitedByUser] = await Promise.all([
    ctx.db.get(invite.teamId),
    invite.invitedByAppUserId ? ctx.db.get(invite.invitedByAppUserId) : null,
  ]);

  const teamId = publicTeamId(team);
  const invitedByUserId = publicUserId(invitedByUser);

  return {
    id: invite.publicInviteId ?? invite._id,
    email: invite.email ?? null,
    code: invite.code ?? null,
    role: invite.role,
    user:
      invitedByUser && invitedByUserId
        ? {
            id: invitedByUserId,
            fullName: invitedByUser.fullName ?? null,
            email: invitedByUser.email ?? null,
          }
        : null,
    team:
      team && teamId
        ? {
            id: teamId,
            name: team.name ?? null,
            logoUrl: team.logoUrl ?? null,
          }
        : null,
  };
}

async function pickFallbackTeamId(
  ctx: IdentityCtx,
  appUserId: Id<"appUsers">,
  excludedTeamId: Id<"teams">,
): Promise<Id<"teams"> | null> {
  const memberships = await ctx.db
    .query("teamMembers")
    .withIndex("by_app_user_id", (q) => q.eq("appUserId", appUserId))
    .collect();

  const nextMembership = memberships.find(
    (membership) => membership.teamId !== excludedTeamId,
  );

  return nextMembership?.teamId ?? null;
}

export const currentUser = query({
  args: {},
  async handler(ctx) {
    const appUser = await requireCurrentAppUser(ctx).catch(() => null);

    if (!appUser) {
      return null;
    }

    return serializeCurrentUser(ctx, appUser);
  },
});

export const currentTeam = query({
  args: {},
  async handler(ctx) {
    const appUser = await requireCurrentAppUser(ctx).catch(() => null);

    if (!appUser) {
      return null;
    }

    const team = await resolveCurrentTeam(ctx, appUser);

    return serializeTeam(team);
  },
});

export const ensureCurrentAppUser = mutation({
  args: {},
  async handler(ctx) {
    const appUser = await ensureCurrentAppUserRecord(ctx);

    return serializeCurrentUser(ctx, appUser);
  },
});

export const currentSession = query({
  args: {},
  async handler(ctx) {
    const appUser = await requireCurrentAppUser(ctx).catch(() => null);

    if (!appUser) {
      return null;
    }

    const [team, memberships] = await Promise.all([
      resolveCurrentTeam(ctx, appUser),
      ctx.db
        .query("teamMembers")
        .withIndex("by_app_user_id", (q) => q.eq("appUserId", appUser._id))
        .collect(),
    ]);

    const membershipTeams = await Promise.all(
      memberships.map((membership) => ctx.db.get(membership.teamId)),
    );

    return {
      user: {
        id: appUser._id,
        convexId: appUser._id,
        email: appUser.email ?? undefined,
        full_name: appUser.fullName ?? undefined,
      },
      teamId: team?.publicTeamId ?? undefined,
      convexTeamId: team?._id ?? undefined,
      teamMembershipIds: membershipTeams
        .map((membershipTeam) => membershipTeam?.publicTeamId)
        .filter((publicTeamId): publicTeamId is string => !!publicTeamId),
      convexTeamMembershipIds: membershipTeams
        .map((membershipTeam) => membershipTeam?._id)
        .filter(
          (membershipTeamId): membershipTeamId is Id<"teams"> =>
            !!membershipTeamId,
        ),
    };
  },
});

export const teamList = query({
  args: {},
  async handler(ctx) {
    const appUser = await requireCurrentAppUser(ctx).catch(() => null);

    if (!appUser) {
      return [];
    }

    return listTeamsForUser(ctx, appUser);
  },
});

export const updateCurrentUser = mutation({
  args: {
    fullName: v.optional(v.union(v.string(), v.null())),
    email: v.optional(v.union(v.string(), v.null())),
    avatarUrl: v.optional(v.union(v.string(), v.null())),
    locale: v.optional(v.union(v.string(), v.null())),
    weekStartsOnMonday: v.optional(v.boolean()),
    timezone: v.optional(v.union(v.string(), v.null())),
    timezoneAutoSync: v.optional(v.boolean()),
    timeFormat: v.optional(v.union(v.literal(12), v.literal(24))),
    dateFormat: v.optional(v.union(v.string(), v.null())),
    aiProvider: v.optional(aiProviderValidator),
  },
  async handler(ctx, args) {
    const appUser = await requireCurrentAppUser(ctx);
    const patch: Record<string, unknown> = {
      updatedAt: nowIso(),
    };

    if (args.fullName !== undefined) {
      patch.fullName = normalizeOptionalString(args.fullName) ?? undefined;
    }

    if (args.email !== undefined) {
      patch.email = normalizeEmail(args.email) ?? undefined;
    }

    if (args.avatarUrl !== undefined) {
      patch.avatarUrl = normalizeOptionalString(args.avatarUrl) ?? undefined;
    }

    if (args.locale !== undefined) {
      patch.locale = normalizeOptionalString(args.locale) ?? undefined;
    }

    if (args.weekStartsOnMonday !== undefined) {
      patch.weekStartsOnMonday = args.weekStartsOnMonday;
    }

    if (args.timezone !== undefined) {
      patch.timezone = normalizeOptionalString(args.timezone) ?? undefined;
    }

    if (args.timezoneAutoSync !== undefined) {
      patch.timezoneAutoSync = args.timezoneAutoSync;
    }

    if (args.timeFormat !== undefined) {
      patch.timeFormat = args.timeFormat;
    }

    if (args.dateFormat !== undefined) {
      patch.dateFormat = normalizeOptionalString(args.dateFormat) ?? undefined;
    }

    if (args.aiProvider !== undefined) {
      patch.aiProvider = args.aiProvider;
    }

    await ctx.db.patch(appUser._id, patch);

    if (appUser.authUserId) {
      const authPatch: Record<string, unknown> = {};

      if (args.fullName !== undefined) {
        authPatch.name = normalizeOptionalString(args.fullName) ?? undefined;
      }

      if (args.email !== undefined) {
        authPatch.email = normalizeEmail(args.email) ?? undefined;
      }

      if (Object.keys(authPatch).length > 0) {
        await ctx.db.patch(appUser.authUserId, authPatch);
      }
    }

    const updatedAppUser = await ctx.db.get(appUser._id);

    if (!updatedAppUser) {
      throw new Error("Failed to update Convex app user");
    }

    return serializeCurrentUser(ctx, updatedAppUser);
  },
});

export const updateCurrentTeam = mutation({
  args: {
    name: v.optional(v.union(v.string(), v.null())),
    logoUrl: v.optional(v.union(v.string(), v.null())),
    email: v.optional(v.union(v.string(), v.null())),
    baseCurrency: v.optional(v.union(v.string(), v.null())),
    countryCode: v.optional(v.union(v.string(), v.null())),
    fiscalYearStartMonth: v.optional(v.union(v.number(), v.null())),
    companyType: v.optional(v.union(v.string(), v.null())),
    heardAbout: v.optional(v.union(v.string(), v.null())),
    canceledAt: v.optional(v.union(v.string(), v.null())),
    plan: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    const appUser = await requireCurrentAppUser(ctx);

    if (!appUser.currentTeamId) {
      throw new Error("No current team selected");
    }

    await requireMembership(ctx, appUser.currentTeamId, appUser._id);

    const patch: Record<string, unknown> = {
      updatedAt: nowIso(),
    };

    if (args.name !== undefined) {
      patch.name = normalizeOptionalString(args.name) ?? undefined;
    }

    if (args.logoUrl !== undefined) {
      patch.logoUrl = normalizeOptionalString(args.logoUrl) ?? undefined;
    }

    if (args.email !== undefined) {
      patch.email = normalizeEmail(args.email) ?? undefined;
    }

    if (args.baseCurrency !== undefined) {
      patch.baseCurrency =
        normalizeOptionalString(args.baseCurrency) ?? undefined;
    }

    if (args.countryCode !== undefined) {
      patch.countryCode =
        normalizeOptionalString(args.countryCode) ?? undefined;
    }

    if (args.fiscalYearStartMonth !== undefined) {
      patch.fiscalYearStartMonth = args.fiscalYearStartMonth;
    }

    if (args.companyType !== undefined) {
      patch.companyType =
        normalizeOptionalString(args.companyType) ?? undefined;
    }

    if (args.heardAbout !== undefined) {
      patch.heardAbout = normalizeOptionalString(args.heardAbout) ?? undefined;
    }

    if (args.canceledAt !== undefined) {
      patch.canceledAt = normalizeOptionalString(args.canceledAt) ?? undefined;
    }

    if (args.plan !== undefined) {
      patch.plan = normalizeOptionalString(args.plan) ?? undefined;
    }

    await ctx.db.patch(appUser.currentTeamId, patch);

    const updatedTeam = await ctx.db.get(appUser.currentTeamId);

    if (!updatedTeam) {
      throw new Error("Failed to update Convex team");
    }

    if (args.baseCurrency !== undefined || args.countryCode !== undefined) {
      await rebuildDerivedComplianceJournalEntriesForTeam(ctx, updatedTeam);
    }

    return serializeTeam(updatedTeam);
  },
});

export const switchCurrentTeam = mutation({
  args: {
    teamId: v.id("teams"),
  },
  async handler(ctx, args) {
    const appUser = await requireCurrentAppUser(ctx);

    await requireMembership(ctx, args.teamId, appUser._id);

    await ctx.db.patch(appUser._id, {
      currentTeamId: args.teamId,
      updatedAt: nowIso(),
    });

    const updatedAppUser = await ctx.db.get(appUser._id);

    if (!updatedAppUser) {
      throw new Error("Failed to switch Convex team");
    }

    return serializeCurrentUser(ctx, updatedAppUser);
  },
});

export const createTeam = mutation({
  args: {
    name: v.string(),
    email: v.optional(v.union(v.string(), v.null())),
    logoUrl: v.optional(v.union(v.string(), v.null())),
    baseCurrency: v.optional(v.union(v.string(), v.null())),
    countryCode: v.optional(v.union(v.string(), v.null())),
    fiscalYearStartMonth: v.optional(v.union(v.number(), v.null())),
    companyType: v.optional(v.union(v.string(), v.null())),
    heardAbout: v.optional(v.union(v.string(), v.null())),
    switchTeam: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    const appUser = await requireCurrentAppUser(ctx);

    return createConvexTeamForUser(ctx, appUser, args);
  },
});

export const serviceGetUserById = query({
  args: {
    serviceKey: v.string(),
    userId: v.optional(v.id("appUsers")),
    email: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const appUser = await resolveAppUserByIdOrEmail(ctx, {
      userId: args.userId,
      email: args.email ?? undefined,
    });

    if (!appUser) {
      return null;
    }

    return serializeCurrentUser(ctx, appUser);
  },
});

export const serviceUpdateUserById = mutation({
  args: {
    serviceKey: v.string(),
    userId: v.optional(v.id("appUsers")),
    currentEmail: v.optional(v.union(v.string(), v.null())),
    fullName: v.optional(v.union(v.string(), v.null())),
    email: v.optional(v.union(v.string(), v.null())),
    avatarUrl: v.optional(v.union(v.string(), v.null())),
    locale: v.optional(v.union(v.string(), v.null())),
    weekStartsOnMonday: v.optional(v.boolean()),
    timezone: v.optional(v.union(v.string(), v.null())),
    timezoneAutoSync: v.optional(v.boolean()),
    timeFormat: v.optional(v.union(v.literal(12), v.literal(24))),
    dateFormat: v.optional(v.union(v.string(), v.null())),
    aiProvider: v.optional(aiProviderValidator),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const appUser = await resolveAppUserByIdOrEmail(ctx, {
      userId: args.userId,
      email: args.currentEmail ?? undefined,
    });

    if (!appUser) {
      throw new Error("Convex app user not found");
    }

    const patch: Record<string, unknown> = {
      updatedAt: nowIso(),
    };

    if (args.fullName !== undefined) {
      patch.fullName = normalizeOptionalString(args.fullName) ?? undefined;
    }

    if (args.email !== undefined) {
      patch.email = normalizeEmail(args.email) ?? undefined;
    }

    if (args.avatarUrl !== undefined) {
      patch.avatarUrl = normalizeOptionalString(args.avatarUrl) ?? undefined;
    }

    if (args.locale !== undefined) {
      patch.locale = normalizeOptionalString(args.locale) ?? undefined;
    }

    if (args.weekStartsOnMonday !== undefined) {
      patch.weekStartsOnMonday = args.weekStartsOnMonday;
    }

    if (args.timezone !== undefined) {
      patch.timezone = normalizeOptionalString(args.timezone) ?? undefined;
    }

    if (args.timezoneAutoSync !== undefined) {
      patch.timezoneAutoSync = args.timezoneAutoSync;
    }

    if (args.timeFormat !== undefined) {
      patch.timeFormat = args.timeFormat;
    }

    if (args.dateFormat !== undefined) {
      patch.dateFormat = normalizeOptionalString(args.dateFormat) ?? undefined;
    }

    if (args.aiProvider !== undefined) {
      patch.aiProvider = args.aiProvider;
    }

    await ctx.db.patch(appUser._id, patch);

    if (appUser.authUserId) {
      const authPatch: Record<string, unknown> = {};

      if (args.fullName !== undefined) {
        authPatch.name = normalizeOptionalString(args.fullName) ?? undefined;
      }

      if (args.email !== undefined) {
        authPatch.email = normalizeEmail(args.email) ?? undefined;
      }

      if (Object.keys(authPatch).length > 0) {
        await ctx.db.patch(appUser.authUserId, authPatch);
      }
    }

    const updatedAppUser = await ctx.db.get(appUser._id);

    if (!updatedAppUser) {
      throw new Error("Failed to update Convex app user");
    }

    return serializeCurrentUser(ctx, updatedAppUser);
  },
});

export const serviceGetTeamByPublicTeamId = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    return serializeTeam(team);
  },
});

export const serviceGetTeamByInboxId = query({
  args: {
    serviceKey: v.string(),
    inboxId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByInboxId(ctx, args.inboxId);

    return serializeTeam(team);
  },
});

export const serviceGetTeamByStripeAccountId = query({
  args: {
    serviceKey: v.string(),
    stripeAccountId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByStripeAccountId(ctx, args.stripeAccountId);

    return serializeTeam(team);
  },
});

export const serviceUpdateTeamByPublicTeamId = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    name: v.optional(v.union(v.string(), v.null())),
    logoUrl: v.optional(v.union(v.string(), v.null())),
    email: v.optional(v.union(v.string(), v.null())),
    baseCurrency: v.optional(v.union(v.string(), v.null())),
    countryCode: v.optional(v.union(v.string(), v.null())),
    fiscalYearStartMonth: v.optional(v.union(v.number(), v.null())),
    exportSettings: v.optional(v.any()),
    subscriptionStatus: v.optional(v.union(v.string(), v.null())),
    stripeAccountId: v.optional(v.union(v.string(), v.null())),
    stripeConnectStatus: v.optional(v.union(v.string(), v.null())),
    companyType: v.optional(v.union(v.string(), v.null())),
    heardAbout: v.optional(v.union(v.string(), v.null())),
    canceledAt: v.optional(v.union(v.string(), v.null())),
    plan: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      throw new Error("Convex team not found");
    }

    const patch: Record<string, unknown> = {
      updatedAt: nowIso(),
    };

    if (args.name !== undefined) {
      patch.name = normalizeOptionalString(args.name) ?? undefined;
    }

    if (args.logoUrl !== undefined) {
      patch.logoUrl = normalizeOptionalString(args.logoUrl) ?? undefined;
    }

    if (args.email !== undefined) {
      patch.email = normalizeEmail(args.email) ?? undefined;
    }

    if (args.baseCurrency !== undefined) {
      patch.baseCurrency =
        normalizeOptionalString(args.baseCurrency) ?? undefined;
    }

    if (args.countryCode !== undefined) {
      patch.countryCode =
        normalizeOptionalString(args.countryCode) ?? undefined;
    }

    if (args.fiscalYearStartMonth !== undefined) {
      patch.fiscalYearStartMonth = args.fiscalYearStartMonth;
    }

    if (args.exportSettings !== undefined) {
      patch.exportSettings = args.exportSettings ?? undefined;
    }

    if (args.subscriptionStatus !== undefined) {
      patch.subscriptionStatus =
        normalizeOptionalString(args.subscriptionStatus) ?? undefined;
    }

    if (args.stripeAccountId !== undefined) {
      patch.stripeAccountId =
        normalizeOptionalString(args.stripeAccountId) ?? undefined;
    }

    if (args.stripeConnectStatus !== undefined) {
      patch.stripeConnectStatus =
        normalizeOptionalString(args.stripeConnectStatus) ?? undefined;
    }

    if (args.companyType !== undefined) {
      patch.companyType =
        normalizeOptionalString(args.companyType) ?? undefined;
    }

    if (args.heardAbout !== undefined) {
      patch.heardAbout = normalizeOptionalString(args.heardAbout) ?? undefined;
    }

    if (args.canceledAt !== undefined) {
      patch.canceledAt = normalizeOptionalString(args.canceledAt) ?? undefined;
    }

    if (args.plan !== undefined) {
      patch.plan = normalizeOptionalString(args.plan) ?? undefined;
    }

    await ctx.db.patch(team._id, patch);

    const updatedTeam = await ctx.db.get(team._id);

    if (!updatedTeam) {
      throw new Error("Failed to update Convex team");
    }

    return serializeTeam(updatedTeam);
  },
});

export const serviceListTeamsByUserId = query({
  args: {
    serviceKey: v.string(),
    userId: v.optional(v.id("appUsers")),
    email: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const appUser = await resolveAppUserByIdOrEmail(ctx, {
      userId: args.userId,
      email: args.email ?? undefined,
    });

    if (!appUser) {
      return [];
    }

    return listTeamsForUser(ctx, appUser);
  },
});

export const serviceListAllTeams = query({
  args: {
    serviceKey: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    return (await ctx.db.query("teams").collect())
      .map((team) => serializeTeam(team))
      .filter(
        (team): team is Exclude<ReturnType<typeof serializeTeam>, null> =>
          team !== null,
      )
      .sort((left, right) => left.id.localeCompare(right.id));
  },
});

export const serviceListInsightEligibleTeams = query({
  args: {
    serviceKey: v.string(),
    enabledTeamIds: v.optional(v.array(v.string())),
    cursor: v.optional(v.union(v.string(), v.null())),
    limit: v.optional(v.number()),
    trialEligibilityDays: v.optional(v.number()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const teamIdFilter = args.enabledTeamIds
      ? new Set(args.enabledTeamIds)
      : null;
    const cursor = args.cursor ?? null;
    const limit = args.limit ?? 100;
    const trialEligibilityDays = args.trialEligibilityDays ?? 30;
    const trialCutoff = Date.now() - trialEligibilityDays * 24 * 60 * 60 * 1000;

    const teams = (await ctx.db.query("teams").collect())
      .map((team) => ({
        publicId: publicTeamId(team),
        team,
      }))
      .filter(
        (entry): entry is InsightEligibleTeamCandidate => !!entry.publicId,
      )
      .filter(({ publicId, team }) => {
        if (!team.baseCurrency) {
          return false;
        }

        if (teamIdFilter && !teamIdFilter.has(publicId)) {
          return false;
        }

        if (cursor && publicId <= cursor) {
          return false;
        }

        if (team.plan === "starter" || team.plan === "pro") {
          return true;
        }

        return (
          team.plan === "trial" &&
          !team.canceledAt &&
          Date.parse(team.createdAt) >= trialCutoff
        );
      })
      .sort((left, right) => left.publicId.localeCompare(right.publicId))
      .slice(0, limit);

    return Promise.all(
      teams.map(async ({ publicId, team }) => {
        const memberships = await getTeamMembershipsByTeamId(ctx, team._id);
        const ownerMembership = memberships[0];
        const owner = ownerMembership
          ? await ctx.db.get(ownerMembership.appUserId)
          : null;

        return {
          id: publicId,
          baseCurrency: team.baseCurrency ?? null,
          ownerLocale: owner?.locale ?? "en",
          ownerTimezone: owner?.timezone ?? "UTC",
        };
      }),
    );
  },
});

export const serviceSwitchCurrentTeam = mutation({
  args: {
    serviceKey: v.string(),
    userId: v.optional(v.id("appUsers")),
    email: v.optional(v.union(v.string(), v.null())),
    publicTeamId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [appUser, team] = await Promise.all([
      resolveAppUserByIdOrEmail(ctx, {
        userId: args.userId,
        email: args.email ?? undefined,
      }),
      getTeamByPublicTeamId(ctx, args.publicTeamId),
    ]);

    if (!appUser || !team) {
      throw new Error("Convex team switch target not found");
    }

    await requireMembership(ctx, team._id, appUser._id);

    await ctx.db.patch(appUser._id, {
      currentTeamId: team._id,
      updatedAt: nowIso(),
    });

    return {
      id: publicUserId(appUser),
      teamId: publicTeamId(team),
    };
  },
});

export const serviceCreateTeamForUserId = mutation({
  args: {
    serviceKey: v.string(),
    userId: v.optional(v.id("appUsers")),
    email: v.optional(v.union(v.string(), v.null())),
    publicTeamId: v.optional(v.union(v.string(), v.null())),
    name: v.string(),
    inboxId: v.optional(v.union(v.string(), v.null())),
    baseCurrency: v.optional(v.union(v.string(), v.null())),
    countryCode: v.optional(v.union(v.string(), v.null())),
    fiscalYearStartMonth: v.optional(v.union(v.number(), v.null())),
    logoUrl: v.optional(v.union(v.string(), v.null())),
    companyType: v.optional(v.union(v.string(), v.null())),
    heardAbout: v.optional(v.union(v.string(), v.null())),
    switchTeam: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const appUser = await resolveAppUserByIdOrEmail(ctx, {
      userId: args.userId,
      email: args.email ?? undefined,
    });

    if (!appUser) {
      throw new Error("Convex app user not found");
    }

    const memberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_app_user_id", (q) => q.eq("appUserId", appUser._id))
      .collect();

    const teams = (
      await Promise.all(
        memberships.map((membership) => ctx.db.get(membership.teamId)),
      )
    ).filter((team): team is NonNullable<typeof team> => team !== null);

    const activeTeamCount = teams.filter(getTrialActive).length;

    if (teams.length > 0 && activeTeamCount < teams.length) {
      throw new Error("PAID_PLAN_REQUIRED");
    }

    const team = await createConvexTeamForUser(ctx, appUser, {
      publicTeamId: args.publicTeamId ?? undefined,
      name: args.name,
      inboxId: args.inboxId ?? undefined,
      email: args.email ?? appUser.email ?? undefined,
      logoUrl: args.logoUrl ?? undefined,
      baseCurrency: args.baseCurrency ?? undefined,
      countryCode: args.countryCode ?? undefined,
      fiscalYearStartMonth: args.fiscalYearStartMonth ?? undefined,
      companyType: args.companyType ?? undefined,
      heardAbout: args.heardAbout ?? undefined,
      switchTeam: args.switchTeam,
    });

    return team?.id ?? null;
  },
});

export const serviceDeleteTeamByPublicTeamId = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return null;
    }

    const [memberships, invites] = await Promise.all([
      getTeamMembershipsByTeamId(ctx, team._id),
      ctx.db
        .query("teamInvites")
        .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
        .collect(),
    ]);

    for (const membership of memberships) {
      const member = await ctx.db.get(membership.appUserId);

      if (member?.currentTeamId === team._id) {
        await ctx.db.patch(member._id, {
          currentTeamId: await pickFallbackTeamId(ctx, member._id, team._id),
          updatedAt: nowIso(),
        });
      }

      await ctx.db.delete(membership._id);
    }

    for (const invite of invites) {
      await ctx.db.delete(invite._id);
    }

    await ctx.db.delete(team._id);

    return { id: args.publicTeamId };
  },
});

export const serviceGetTeamMembersByPublicTeamId = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const memberships = await getTeamMembershipsByTeamId(ctx, team._id);

    const members = await Promise.all(
      memberships.map((membership) => serializeTeamMember(ctx, membership)),
    );

    return members.filter((member) => member !== null);
  },
});

export const serviceDeleteUserById = mutation({
  args: {
    serviceKey: v.string(),
    userId: v.optional(v.id("appUsers")),
    email: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const appUser = await resolveAppUserByIdOrEmail(ctx, {
      userId: args.userId,
      email: args.email ?? undefined,
    });

    if (!appUser) {
      return null;
    }

    const memberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_app_user_id", (q) => q.eq("appUserId", appUser._id))
      .collect();

    for (const membership of memberships) {
      const teamMemberships = await getTeamMembershipsByTeamId(
        ctx,
        membership.teamId,
      );

      if (teamMemberships.length <= 1) {
        const teamInvites = await ctx.db
          .query("teamInvites")
          .withIndex("by_team_id", (q) => q.eq("teamId", membership.teamId))
          .collect();

        for (const invite of teamInvites) {
          await ctx.db.delete(invite._id);
        }

        await ctx.db.delete(membership.teamId);
        continue;
      }

      await ctx.db.delete(membership._id);
    }

    await ctx.db.delete(appUser._id);

    return { id: publicUserId(appUser) };
  },
});

export const serviceUpdateTeamMember = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    userId: v.id("appUsers"),
    role: v.union(v.literal("owner"), v.literal("member")),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [team, appUser] = await Promise.all([
      getTeamByPublicTeamId(ctx, args.publicTeamId),
      resolveAppUserByIdOrEmail(ctx, { userId: args.userId }),
    ]);

    if (!team || !appUser) {
      throw new Error("Convex team member not found");
    }

    const membership = await requireMembership(ctx, team._id, appUser._id);

    await ctx.db.patch(membership._id, {
      role: args.role,
      updatedAt: nowIso(),
    });

    const updatedMembership = await ctx.db.get(membership._id);

    if (!updatedMembership) {
      throw new Error("Failed to update team member");
    }

    return serializeTeamMember(ctx, updatedMembership);
  },
});

export const serviceDeleteTeamMember = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    userId: v.id("appUsers"),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [team, appUser] = await Promise.all([
      getTeamByPublicTeamId(ctx, args.publicTeamId),
      resolveAppUserByIdOrEmail(ctx, { userId: args.userId }),
    ]);

    if (!team || !appUser) {
      throw new Error("Convex team member not found");
    }

    const membership = await requireMembership(ctx, team._id, appUser._id);

    await ctx.db.delete(membership._id);

    if (appUser.currentTeamId === team._id) {
      await ctx.db.patch(appUser._id, {
        currentTeamId: await pickFallbackTeamId(ctx, appUser._id, team._id),
        updatedAt: nowIso(),
      });
    }

    return { id: membership._id };
  },
});

export const serviceLeaveTeam = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    userId: v.optional(v.id("appUsers")),
    email: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [team, appUser] = await Promise.all([
      getTeamByPublicTeamId(ctx, args.publicTeamId),
      resolveAppUserByIdOrEmail(ctx, {
        userId: args.userId,
        email: args.email ?? undefined,
      }),
    ]);

    if (!team || !appUser) {
      throw new Error("Convex leave team target not found");
    }

    const membership = await requireMembership(ctx, team._id, appUser._id);

    await ctx.db.delete(membership._id);

    if (appUser.currentTeamId === team._id) {
      await ctx.db.patch(appUser._id, {
        currentTeamId: await pickFallbackTeamId(ctx, appUser._id, team._id),
        updatedAt: nowIso(),
      });
    }

    return { id: membership._id };
  },
});

export const serviceGetInvitesByEmail = query({
  args: {
    serviceKey: v.string(),
    email: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const normalizedEmail = normalizeEmail(args.email);

    if (!normalizedEmail) {
      return [];
    }

    const invites = await ctx.db
      .query("teamInvites")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .collect();

    return Promise.all(
      invites.map((invite) => serializeTeamInvite(ctx, invite)),
    );
  },
});

export const serviceGetTeamInvitesByPublicTeamId = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const invites = await ctx.db
      .query("teamInvites")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect();

    return Promise.all(
      invites.map((invite) => serializeTeamInvite(ctx, invite)),
    );
  },
});

export const serviceCreateTeamInvites = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    invitedByUserId: v.optional(v.id("appUsers")),
    invites: v.array(
      v.object({
        email: v.string(),
        role: v.union(v.literal("owner"), v.literal("member")),
      }),
    ),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [team, invitedByUser] = await Promise.all([
      getTeamByPublicTeamId(ctx, args.publicTeamId),
      args.invitedByUserId
        ? resolveAppUserByIdOrEmail(ctx, { userId: args.invitedByUserId })
        : null,
    ]);

    if (!team) {
      throw new Error("Convex team not found");
    }

    const uniqueInvites = args.invites.filter((invite, index, self) => {
      const normalizedEmail = normalizeEmail(invite.email);

      return (
        !!normalizedEmail &&
        index ===
          self.findIndex(
            (candidate) => normalizeEmail(candidate.email) === normalizedEmail,
          )
      );
    });

    const memberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect();

    const memberUsers = await Promise.all(
      memberships.map((membership) => ctx.db.get(membership.appUserId)),
    );

    const existingMemberEmails = new Set(
      memberUsers.map((user) => normalizeEmail(user?.email)).filter(Boolean),
    );

    const pendingInvites = await ctx.db
      .query("teamInvites")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect();

    const pendingInviteEmails = new Set(
      pendingInvites
        .map((invite) => normalizeEmail(invite.email))
        .filter(Boolean),
    );

    const skippedInvites: {
      email: string;
      reason: "already_member" | "already_invited" | "duplicate";
    }[] = [];
    const validInvites: typeof uniqueInvites = [];

    for (const invite of args.invites) {
      const normalizedEmail = normalizeEmail(invite.email);

      if (!normalizedEmail) {
        continue;
      }

      if (
        !uniqueInvites.some(
          (candidate) => normalizeEmail(candidate.email) === normalizedEmail,
        )
      ) {
        skippedInvites.push({
          email: invite.email,
          reason: "duplicate",
        });
        continue;
      }

      if (existingMemberEmails.has(normalizedEmail)) {
        skippedInvites.push({
          email: invite.email,
          reason: "already_member",
        });
        continue;
      }

      if (pendingInviteEmails.has(normalizedEmail)) {
        skippedInvites.push({
          email: invite.email,
          reason: "already_invited",
        });
        continue;
      }

      if (
        !validInvites.some(
          (candidate) => normalizeEmail(candidate.email) === normalizedEmail,
        )
      ) {
        validInvites.push({
          ...invite,
          email: normalizedEmail,
        });
      }
    }

    const timestamp = nowIso();
    const results = [];

    for (const invite of validInvites) {
      const inviteId = await ctx.db.insert("teamInvites", {
        publicInviteId: crypto.randomUUID(),
        teamId: team._id,
        email: normalizeEmail(invite.email) ?? undefined,
        role: invite.role,
        code: buildInviteCode(),
        invitedByAppUserId: invitedByUser?._id,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      const insertedInvite = await ctx.db.get(inviteId);

      if (!insertedInvite) {
        continue;
      }

      results.push({
        email: insertedInvite.email ?? null,
        code: insertedInvite.code ?? null,
        role: insertedInvite.role,
        team: {
          id: publicTeamId(team),
          name: team.name ?? null,
        },
      });
    }

    return {
      results,
      skippedInvites,
    };
  },
});

export const serviceAcceptTeamInvite = mutation({
  args: {
    serviceKey: v.string(),
    publicInviteId: v.string(),
    userId: v.optional(v.id("appUsers")),
    email: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [invite, appUser] = await Promise.all([
      getTeamInviteByPublicInviteId(ctx, args.publicInviteId),
      resolveAppUserByIdOrEmail(ctx, {
        userId: args.userId,
        email: args.email ?? undefined,
      }),
    ]);

    if (!invite || !appUser) {
      throw new Error("Invite not found");
    }

    const inviteEmail = normalizeEmail(invite.email);
    const appUserEmail = normalizeEmail(args.email ?? appUser.email);

    if (inviteEmail && appUserEmail && inviteEmail !== appUserEmail) {
      throw new Error("Invite was sent to a different email address");
    }

    const existingMembership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", invite.teamId).eq("appUserId", appUser._id),
      )
      .unique();

    if (!existingMembership) {
      await ctx.db.insert("teamMembers", {
        teamId: invite.teamId,
        appUserId: appUser._id,
        role: invite.role,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }

    await ctx.db.delete(invite._id);

    const team = await ctx.db.get(invite.teamId);

    return {
      id: invite.publicInviteId ?? invite._id,
      role: invite.role,
      email: invite.email ?? null,
      teamId: publicTeamId(team),
    };
  },
});

export const serviceDeclineTeamInvite = mutation({
  args: {
    serviceKey: v.string(),
    publicInviteId: v.string(),
    email: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const invite = await getTeamInviteByPublicInviteId(
      ctx,
      args.publicInviteId,
    );

    if (!invite) {
      return null;
    }

    const inviteEmail = normalizeEmail(invite.email);
    const requestEmail = normalizeEmail(args.email);

    if (inviteEmail && requestEmail && inviteEmail !== requestEmail) {
      throw new Error("Invite was sent to a different email address");
    }

    await ctx.db.delete(invite._id);

    return { id: invite.publicInviteId ?? invite._id };
  },
});

export const serviceDeleteTeamInvite = mutation({
  args: {
    serviceKey: v.string(),
    publicInviteId: v.string(),
    publicTeamId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [invite, team] = await Promise.all([
      getTeamInviteByPublicInviteId(ctx, args.publicInviteId),
      getTeamByPublicTeamId(ctx, args.publicTeamId),
    ]);

    if (!invite || !team || invite.teamId !== team._id) {
      return null;
    }

    await ctx.db.delete(invite._id);

    return { id: invite.publicInviteId ?? invite._id };
  },
});
