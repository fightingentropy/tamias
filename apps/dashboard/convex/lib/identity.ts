import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import {
  type AIProvider,
  buildAppUserDefaults,
  buildTeamDefaults,
  DEFAULT_USER_PREFERENCES,
  normalizeEmail,
  normalizeOptionalString,
  nowIso,
  type TeamRole,
} from "../../../../packages/domain/src/identity";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type IdentityCtx = QueryCtx | MutationCtx;

/**
 * Plain JSON shape for fields embedded in TanStack Start server-fn responses.
 * Convex stores `exportSettings` as `v.any()`; this type satisfies seroval serialization checks.
 */
export type SerializedJson =
  | string
  | number
  | boolean
  | null
  | SerializedJson[]
  | SerializedJsonObject;

export type SerializedJsonObject = {
  readonly [key: string]: SerializedJson;
};

export type SerializedTeam = {
  id: string;
  convexId: Id<"teams">;
  name: string | null;
  logoUrl: string | null;
  email: string | null;
  inboxId: string | null;
  plan: string | null;
  exportSettings?: SerializedJsonObject;
  stripeAccountId?: string | null;
  stripeConnectStatus?: string | null;
  createdAt: string;
  canceledAt: string | null;
  countryCode: string | null;
  baseCurrency: string | null;
  fiscalYearStartMonth: number | null;
  companyType: string | null;
  heardAbout: string | null;
};

export type SerializedTeamListItem = SerializedTeam & {
  role: TeamRole;
};

export type SerializedTeamMember = {
  id: string;
  role: TeamRole;
  teamId: string;
  createdAt: string;
  user: {
    id: string;
    convexId: Id<"appUsers">;
    fullName: string | null;
    avatarUrl: string | null;
    email: string | null;
    timezone: string | null;
    locale: string | null;
  };
};

export type SerializedCurrentUser = {
  id: string;
  convexId: Id<"appUsers">;
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  locale: string;
  weekStartsOnMonday: boolean;
  timezone: string | null;
  timezoneAutoSync: boolean;
  timeFormat: number;
  dateFormat: string | null;
  aiProvider: AIProvider;
  teamId: string | null;
  convexTeamId: Id<"teams"> | null;
  team: SerializedTeam | null;
};

export async function getAppUserByAuthUserId(
  ctx: IdentityCtx,
  authUserId: Id<"users">,
) {
  return ctx.db
    .query("appUsers")
    .withIndex("by_auth_user_id", (q) => q.eq("authUserId", authUserId))
    .unique();
}

export async function getAppUserById(
  ctx: IdentityCtx,
  appUserId: Id<"appUsers">,
) {
  return ctx.db.get(appUserId);
}

export async function getAppUserByEmail(
  ctx: IdentityCtx,
  email: string | null | undefined,
) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  const users = await ctx.db
    .query("appUsers")
    .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
    .take(2);

  return users.length === 1 ? users[0] : null;
}

export async function resolveAppUserByIdOrEmail(
  ctx: IdentityCtx,
  args: {
    userId?: Id<"appUsers"> | null;
    email?: string | null;
  },
) {
  if (args.userId) {
    const byId = await getAppUserById(ctx, args.userId);

    if (byId) {
      return byId;
    }
  }

  if (args.email) {
    return getAppUserByEmail(ctx, args.email);
  }

  return null;
}

export async function getAppUsersByEmail(
  ctx: IdentityCtx,
  email: string | null | undefined,
) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return [];
  }

  return ctx.db
    .query("appUsers")
    .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
    .collect();
}

export async function getTeamByPublicTeamId(
  ctx: IdentityCtx,
  publicTeamId: string,
) {
  return ctx.db
    .query("teams")
    .withIndex("by_public_team_id", (q) => q.eq("publicTeamId", publicTeamId))
    .unique();
}

export async function getTeamByInboxId(
  ctx: IdentityCtx,
  inboxId: string,
) {
  return ctx.db
    .query("teams")
    .withIndex("by_inbox_id", (q) => q.eq("inboxId", inboxId))
    .unique();
}

export async function getTeamByStripeAccountId(
  ctx: IdentityCtx,
  stripeAccountId: string,
) {
  return ctx.db
    .query("teams")
    .withIndex("by_stripe_account_id", (q) =>
      q.eq("stripeAccountId", stripeAccountId),
    )
    .unique();
}

export async function getTeamMembershipsByTeamId(
  ctx: IdentityCtx,
  teamId: Id<"teams">,
) {
  const memberships = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_id", (q) => q.eq("teamId", teamId))
    .collect();

  return memberships.sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
}

export async function getTeamInviteByPublicInviteId(
  ctx: IdentityCtx,
  publicInviteId: string,
) {
  return ctx.db
    .query("teamInvites")
    .withIndex("by_public_invite_id", (q) => q.eq("publicInviteId", publicInviteId))
    .unique();
}

export function publicUserId(
  appUser: Pick<Doc<"appUsers">, "_id"> | null | undefined,
) {
  return appUser?._id ?? null;
}

export function publicTeamId(
  team: Pick<Doc<"teams">, "_id" | "publicTeamId"> | null | undefined,
) {
  return team?.publicTeamId ?? team?._id ?? null;
}

export async function getOAuthApplicationByPublicApplicationId(
  ctx: IdentityCtx,
  publicApplicationId: string,
) {
  return ctx.db
    .query("oauthApplications")
    .withIndex("by_public_application_id", (q) =>
      q.eq("publicApplicationId", publicApplicationId),
    )
    .unique();
}

export async function getCurrentAppUser(ctx: IdentityCtx) {
  const authUserId = await getAuthUserId(ctx);

  if (!authUserId) {
    return null;
  }

  return getAppUserByAuthUserId(ctx, authUserId);
}

export async function requireCurrentAppUser(ctx: IdentityCtx) {
  const appUser = await getCurrentAppUser(ctx);

  if (!appUser) {
    throw new ConvexError("Unauthorized");
  }

  return appUser;
}

export async function ensureCurrentAppUserRecord(ctx: MutationCtx) {
  const authUserId = await getAuthUserId(ctx);

  if (!authUserId) {
    throw new ConvexError("Unauthorized");
  }

  return ensureAppUserForAuthUser(ctx, authUserId);
}

export async function ensureAppUserForAuthUser(
  ctx: MutationCtx,
  authUserId: Id<"users">,
) {
  const existing = await getAppUserByAuthUserId(ctx, authUserId);
  const timestamp = nowIso();

  if (existing) {
    return existing;
  }

  const authUser = await ctx.db.get(authUserId);

  if (!authUser) {
    throw new Error(`Auth user ${authUserId} not found`);
  }

  const linkedByEmail = await getAppUserByEmail(
    ctx,
    typeof authUser.email === "string" ? authUser.email : null,
  );

  if (linkedByEmail) {
    await ctx.db.patch(linkedByEmail._id, {
      authUserId,
      email:
        normalizeEmail(
          typeof authUser.email === "string" ? authUser.email : null,
        ) ??
        linkedByEmail.email,
      fullName:
        linkedByEmail.fullName ??
        (normalizeOptionalString(
          typeof authUser.name === "string" ? authUser.name : null,
        ) ??
          undefined),
      avatarUrl:
        linkedByEmail.avatarUrl ??
        (normalizeOptionalString(
          typeof authUser.image === "string" ? authUser.image : null,
        ) ??
          undefined),
      updatedAt: timestamp,
    });

    return {
      ...linkedByEmail,
      authUserId,
      updatedAt: timestamp,
    };
  }

  const appUserId = await ctx.db.insert("appUsers", {
    authUserId,
    ...buildAppUserDefaults({
      email: typeof authUser.email === "string" ? authUser.email : null,
      fullName: typeof authUser.name === "string" ? authUser.name : null,
      avatarUrl: typeof authUser.image === "string" ? authUser.image : null,
    }),
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const appUser = await ctx.db.get(appUserId);

  if (!appUser) {
    throw new Error("Failed to create Convex app user");
  }

  return appUser;
}

export async function getMembership(
  ctx: IdentityCtx,
  teamId: Id<"teams">,
  appUserId: Id<"appUsers">,
) {
  return ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("teamId", teamId).eq("appUserId", appUserId),
    )
    .unique();
}

export async function requireMembership(
  ctx: IdentityCtx,
  teamId: Id<"teams">,
  appUserId: Id<"appUsers">,
) {
  const membership = await getMembership(ctx, teamId, appUserId);

  if (!membership) {
    throw new ConvexError("Forbidden");
  }

  return membership;
}

export async function resolveCurrentTeam(
  ctx: IdentityCtx,
  appUser: Doc<"appUsers">,
) {
  if (!appUser.currentTeamId) {
    return null;
  }

  const membership = await getMembership(ctx, appUser.currentTeamId, appUser._id);

  if (!membership) {
    return null;
  }

  return ctx.db.get(appUser.currentTeamId);
}

function serializeExportSettings(
  value: Doc<"teams">["exportSettings"],
): SerializedJsonObject | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as SerializedJsonObject;
  }

  return undefined;
}

export function serializeTeam(team: Doc<"teams"> | null): SerializedTeam | null {
  if (!team) {
    return null;
  }

  return {
    id: publicTeamId(team)!,
    convexId: team._id,
    name: team.name ?? null,
    logoUrl: team.logoUrl ?? null,
    email: team.email ?? null,
    inboxId: team.inboxId ?? null,
    plan: team.plan ?? null,
    exportSettings: serializeExportSettings(team.exportSettings),
    stripeAccountId: team.stripeAccountId ?? null,
    stripeConnectStatus: team.stripeConnectStatus ?? null,
    createdAt: team.createdAt,
    canceledAt: team.canceledAt ?? null,
    countryCode: team.countryCode ?? null,
    baseCurrency: team.baseCurrency ?? null,
    fiscalYearStartMonth: team.fiscalYearStartMonth ?? null,
    companyType: team.companyType ?? null,
    heardAbout: team.heardAbout ?? null,
  };
}

export async function serializeCurrentUser(
  ctx: IdentityCtx,
  appUser: Doc<"appUsers">,
): Promise<SerializedCurrentUser> {
  const team = await resolveCurrentTeam(ctx, appUser);

  return {
    id: publicUserId(appUser)!,
    convexId: appUser._id,
    fullName: appUser.fullName ?? null,
    email: appUser.email ?? null,
    avatarUrl: appUser.avatarUrl ?? null,
    locale: appUser.locale ?? DEFAULT_USER_PREFERENCES.locale,
    weekStartsOnMonday:
      appUser.weekStartsOnMonday ?? DEFAULT_USER_PREFERENCES.weekStartsOnMonday,
    timezone: appUser.timezone ?? DEFAULT_USER_PREFERENCES.timezone,
    timezoneAutoSync:
      appUser.timezoneAutoSync ?? DEFAULT_USER_PREFERENCES.timezoneAutoSync,
    timeFormat: appUser.timeFormat ?? DEFAULT_USER_PREFERENCES.timeFormat,
    dateFormat: appUser.dateFormat ?? DEFAULT_USER_PREFERENCES.dateFormat,
    aiProvider: appUser.aiProvider ?? DEFAULT_USER_PREFERENCES.aiProvider,
    teamId: publicTeamId(team),
    convexTeamId: team?._id ?? null,
    team: serializeTeam(team),
  };
}

export async function listTeamsForUser(
  ctx: IdentityCtx,
  appUser: Doc<"appUsers">,
): Promise<SerializedTeamListItem[]> {
  type TeamListCandidate = SerializedTeamListItem & {
    isCurrent: boolean;
  };

  const memberships = await ctx.db
    .query("teamMembers")
    .withIndex("by_app_user_id", (q) => q.eq("appUserId", appUser._id))
    .collect();

  const teams = await Promise.all(
    memberships.map(async (membership) => {
      const team = await ctx.db.get(membership.teamId);

      if (!team) {
        return null;
      }

      const serialized = serializeTeam(team);

      if (!serialized) {
        return null;
      }

      return {
        ...serialized,
        role: membership.role,
        isCurrent: membership.teamId === appUser.currentTeamId,
      } satisfies TeamListCandidate;
    }),
  );

  return teams
    .filter((team): team is TeamListCandidate => team !== null)
    .sort((left, right) => {
      if (left.isCurrent) {
        return -1;
      }

      if (right.isCurrent) {
        return 1;
      }

      return left.createdAt.localeCompare(right.createdAt);
    })
    .map(({ isCurrent: _isCurrent, ...team }) => team);
}

export async function createConvexTeamForUser(
  ctx: MutationCtx,
  appUser: Doc<"appUsers">,
  input: {
    publicTeamId?: string | null;
    name: string;
    inboxId?: string | null;
    email?: string | null;
    logoUrl?: string | null;
    baseCurrency?: string | null;
    countryCode?: string | null;
    fiscalYearStartMonth?: number | null;
    companyType?: string | null;
    heardAbout?: string | null;
    switchTeam?: boolean;
  },
) {
  const timestamp = nowIso();
  const teamId = await ctx.db.insert("teams", {
    publicTeamId: input.publicTeamId ?? crypto.randomUUID(),
    ...buildTeamDefaults({
      name: input.name,
      inboxId: input.inboxId,
      email: input.email,
      logoUrl: input.logoUrl,
      baseCurrency: input.baseCurrency,
      countryCode: input.countryCode,
      fiscalYearStartMonth: input.fiscalYearStartMonth,
      companyType: input.companyType,
      heardAbout: input.heardAbout,
      createdAt: timestamp,
      plan: "trial",
    }),
    updatedAt: timestamp,
  });

  await ctx.db.insert("teamMembers", {
    teamId,
    appUserId: appUser._id,
    role: "owner",
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  if (input.switchTeam !== false) {
    await ctx.db.patch(appUser._id, {
      currentTeamId: teamId,
      updatedAt: timestamp,
    });
  }

  const team = await ctx.db.get(teamId);

  if (!team) {
    throw new Error("Failed to create Convex team");
  }

  return serializeTeam(team);
}
