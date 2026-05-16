import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
  type QueryClient,
} from "../../client";
import type {
  CurrentUserIdentityRecord,
  InsightEligibleTeam,
  TeamIdentityRecord,
  TeamListIdentityRecord,
  TeamMemberIdentityRecord,
  TeamRole,
  SerializableJsonObject,
} from "../teams/shared";

type UserRow = {
  id: string;
  auth_user_id: string | null;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  locale: string;
  week_starts_on_monday: number;
  timezone: string | null;
  timezone_auto_sync: number;
  time_format: number;
  date_format: string | null;
  ai_provider: "openai" | "kimi" | "openrouter";
  current_team_id: string | null;
  created_at: string;
  updated_at: string;
};

type TeamRow = {
  id: string;
  name: string | null;
  logo_url: string | null;
  inbox_id: string | null;
  email: string | null;
  base_currency: string | null;
  country_code: string | null;
  fiscal_year_start_month: number | null;
  export_settings_json: string | null;
  created_at: string;
  canceled_at: string | null;
  plan: string | null;
  subscription_status: string | null;
  stripe_account_id: string | null;
  stripe_connect_status: string | null;
  company_type: string | null;
  heard_about: string | null;
  next_invoice_sequence: number | null;
  updated_at: string;
};

type TeamMemberRow = {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  created_at: string;
  updated_at: string;
  user_email: string | null;
  user_full_name: string | null;
  user_avatar_url: string | null;
  user_timezone: string | null;
  user_locale: string | null;
};

type TeamListRow = TeamRow & {
  membership_role: TeamRole;
};

type TeamMembershipRow = {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  created_at: string;
  updated_at: string;
};

type TeamInviteRow = {
  id: string;
  team_id: string;
  email: string | null;
  role: TeamRole;
  invited_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  team_name: string | null;
  team_logo_url: string | null;
  invited_by_full_name: string | null;
  invited_by_email: string | null;
};

type InsightEligibleTeamRow = {
  id: string;
  base_currency: string | null;
  owner_locale: string | null;
  owner_timezone: string | null;
};

export type UpdateUserD1Input = {
  userId?: string;
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
  aiProvider?: "openai" | "kimi" | "openrouter";
};

export type EnsureUserD1Input = {
  authUserId?: string | null;
  email?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
};

export type UpdateTeamD1Input = {
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

export type CreateTeamD1Input = {
  userId?: string;
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

export type CreateTeamInvitesD1Input = {
  teamId: string;
  invitedByUserId?: string | null;
  invites: {
    email: string;
    role: TeamRole;
  }[];
};

export type TeamInviteIdentityRecord = {
  id: string;
  email: string | null;
  code: string | null;
  role: TeamRole;
  user: {
    id: string;
    fullName: string | null;
    email: string | null;
  } | null;
  team: {
    id: string;
    name: string | null;
    logoUrl?: string | null;
  } | null;
};

export type CreateTeamInvitesD1Result = {
  results: {
    email: string | null;
    code: string | null;
    role: TeamRole;
    team: {
      id: string;
      name: string | null;
    } | null;
  }[];
  skippedInvites: {
    email: string;
    reason: "already_member" | "already_invited" | "duplicate";
  }[];
};

export function getIdentityD1(db: Database | QueryClient) {
  return requireCloudflareD1Database(db as Database);
}

export function requireIdentityD1(db: Database | QueryClient) {
  const d1 = getIdentityD1(db);

  if (!d1) {
    throw new Error("Identity requires Cloudflare D1");
  }

  return d1;
}

function normalizeEmail(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

function parseJson(value: string | null): SerializableJsonObject | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as SerializableJsonObject)
      : undefined;
  } catch {
    return undefined;
  }
}

function toTeam(row: TeamRow): TeamIdentityRecord {
  return {
    id: row.id,
    name: row.name,
    logoUrl: row.logo_url,
    email: row.email,
    inboxId: row.inbox_id,
    plan: row.plan,
    exportSettings: parseJson(row.export_settings_json),
    stripeAccountId: row.stripe_account_id,
    stripeConnectStatus: row.stripe_connect_status,
    createdAt: row.created_at,
    canceledAt: row.canceled_at,
    countryCode: row.country_code,
    baseCurrency: row.base_currency,
    fiscalYearStartMonth: row.fiscal_year_start_month,
    companyType: row.company_type,
    heardAbout: row.heard_about,
  };
}

function toUser(row: UserRow, team: TeamIdentityRecord | null): CurrentUserIdentityRecord {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    avatarUrl: row.avatar_url,
    locale: row.locale,
    weekStartsOnMonday: row.week_starts_on_monday === 1,
    timezone: row.timezone,
    timezoneAutoSync: row.timezone_auto_sync === 1,
    timeFormat: row.time_format,
    dateFormat: row.date_format,
    aiProvider: row.ai_provider,
    teamId: row.current_team_id,
    team,
  };
}

function toTeamInvite(row: TeamInviteRow): TeamInviteIdentityRecord {
  return {
    id: row.id,
    email: row.email,
    code: null,
    role: row.role,
    user: row.invited_by_user_id
      ? {
          id: row.invited_by_user_id,
          fullName: row.invited_by_full_name,
          email: row.invited_by_email,
        }
      : null,
    team: {
      id: row.team_id,
      name: row.team_name,
      logoUrl: row.team_logo_url,
    },
  };
}

async function userByWhere(d1: CloudflareD1DatabaseBinding, where: string, value: string) {
  const row = await d1
    .prepare(`select * from users where ${where} = ? limit 1`)
    .bind(value)
    .first<UserRow>();

  if (!row) {
    return null;
  }

  const team = row.current_team_id ? await getTeamByIdFromD1(d1, row.current_team_id) : null;
  return toUser(row, team);
}

export async function getUserByIdFromD1(d1: CloudflareD1DatabaseBinding, userId: string) {
  return userByWhere(d1, "id", userId);
}

export async function getUserByEmailFromD1(d1: CloudflareD1DatabaseBinding, email: string) {
  return userByWhere(d1, "email", email.trim().toLowerCase());
}

async function getUserByAuthUserIdFromD1(d1: CloudflareD1DatabaseBinding, authUserId: string) {
  return userByWhere(d1, "auth_user_id", authUserId);
}

async function resolveUserFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    userId?: string | null;
    email?: string | null;
  },
) {
  if (args.userId) {
    const byId = await getUserByIdFromD1(d1, args.userId);

    if (byId) {
      return byId;
    }
  }

  if (args.email) {
    return getUserByEmailFromD1(d1, args.email);
  }

  return null;
}

export async function ensureUserInD1(d1: CloudflareD1DatabaseBinding, input: EnsureUserD1Input) {
  const email = normalizeEmail(input.email);
  const authUserId = input.authUserId?.trim() || null;

  if (!email && !authUserId) {
    return null;
  }

  const existing =
    (authUserId ? await getUserByAuthUserIdFromD1(d1, authUserId) : null) ??
    (email ? await getUserByEmailFromD1(d1, email) : null);
  const timestamp = new Date().toISOString();

  if (existing) {
    await updateUserInD1(d1, {
      userId: existing.id,
      email: email ?? existing.email,
      fullName: input.fullName ?? existing.fullName,
      avatarUrl: input.avatarUrl ?? existing.avatarUrl,
    });

    if (authUserId) {
      await d1
        .prepare("update users set auth_user_id = ?, updated_at = ? where id = ?")
        .bind(authUserId, timestamp, existing.id)
        .run();
    }

    return getUserByIdFromD1(d1, existing.id);
  }

  const userId = crypto.randomUUID();

  await d1
    .prepare(
      `insert into users (
        id,
        auth_user_id,
        email,
        full_name,
        avatar_url,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      userId,
      authUserId,
      email,
      input.fullName ?? null,
      input.avatarUrl ?? null,
      timestamp,
      timestamp,
    )
    .run();

  return getUserByIdFromD1(d1, userId);
}

export async function updateUserInD1(d1: CloudflareD1DatabaseBinding, input: UpdateUserD1Input) {
  const existing = input.userId
    ? await getUserByIdFromD1(d1, input.userId)
    : input.currentEmail
      ? await getUserByEmailFromD1(d1, input.currentEmail)
      : null;

  if (!existing) {
    return null;
  }

  const assignments = ["updated_at = ?"];
  const values: unknown[] = [new Date().toISOString()];
  const add = (column: string, value: unknown) => {
    assignments.push(`${column} = ?`);
    values.push(value);
  };

  if (input.fullName !== undefined) add("full_name", input.fullName);
  if (input.email !== undefined) add("email", input.email?.trim().toLowerCase() || null);
  if (input.avatarUrl !== undefined) add("avatar_url", input.avatarUrl);
  if (input.locale !== undefined) add("locale", input.locale ?? "en");
  if (input.weekStartsOnMonday !== undefined) {
    add("week_starts_on_monday", input.weekStartsOnMonday ? 1 : 0);
  }
  if (input.timezone !== undefined) add("timezone", input.timezone);
  if (input.timezoneAutoSync !== undefined) {
    add("timezone_auto_sync", input.timezoneAutoSync ? 1 : 0);
  }
  if (input.timeFormat !== undefined) add("time_format", input.timeFormat);
  if (input.dateFormat !== undefined) add("date_format", input.dateFormat);
  if (input.aiProvider !== undefined) add("ai_provider", input.aiProvider);

  values.push(existing.id);
  await d1
    .prepare(`update users set ${assignments.join(", ")} where id = ?`)
    .bind(...values)
    .run();

  return getUserByIdFromD1(d1, existing.id);
}

export async function deleteUserFromD1(d1: CloudflareD1DatabaseBinding, userId: string) {
  await d1.prepare("delete from team_memberships where user_id = ?").bind(userId).run();
  await d1.prepare("delete from team_invites where invited_by_user_id = ?").bind(userId).run();
  await d1.prepare("delete from users where id = ?").bind(userId).run();

  return { id: userId };
}

export async function getTeamByIdFromD1(d1: CloudflareD1DatabaseBinding, teamId: string) {
  const row = await d1
    .prepare("select * from teams where id = ? limit 1")
    .bind(teamId)
    .first<TeamRow>();
  return row ? toTeam(row) : null;
}

export async function getTeamByInboxIdFromD1(d1: CloudflareD1DatabaseBinding, inboxId: string) {
  const row = await d1
    .prepare("select * from teams where inbox_id = ? limit 1")
    .bind(inboxId)
    .first<TeamRow>();
  return row ? toTeam(row) : null;
}

export async function getTeamByStripeAccountIdFromD1(
  d1: CloudflareD1DatabaseBinding,
  stripeAccountId: string,
) {
  const row = await d1
    .prepare("select * from teams where stripe_account_id = ? limit 1")
    .bind(stripeAccountId)
    .first<TeamRow>();
  return row ? toTeam(row) : null;
}

export async function listTeamsForUserFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    userId?: string | null;
    email?: string | null;
  },
): Promise<TeamListIdentityRecord[]> {
  const user = await resolveUserFromD1(d1, args);

  if (!user) {
    return [];
  }

  const { results = [] } = await d1
    .prepare(
      `select
        teams.*,
        team_memberships.role as membership_role
      from team_memberships
      join teams on teams.id = team_memberships.team_id
      where team_memberships.user_id = ?
      order by team_memberships.created_at asc`,
    )
    .bind(user.id)
    .all<TeamListRow>();

  return results.map((row) => toTeamListRecord(toTeam(row), row.membership_role));
}

export async function listAllTeamsFromD1(
  d1: CloudflareD1DatabaseBinding,
): Promise<TeamIdentityRecord[]> {
  const { results = [] } = await d1
    .prepare("select * from teams order by created_at asc")
    .all<TeamRow>();

  return results.map(toTeam);
}

export async function listInsightEligibleTeamsFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    enabledTeamIds?: string[];
    cursor?: string | null;
    limit?: number;
    trialEligibilityDays?: number;
  } = {},
): Promise<InsightEligibleTeam[]> {
  const limit = Math.max(1, Math.min(args.limit ?? 100, 500));
  const trialEligibilityDays = args.trialEligibilityDays ?? 30;
  const trialCutoff = new Date(
    Date.now() - trialEligibilityDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  const where = [
    "teams.base_currency is not null",
    "teams.canceled_at is null",
    "(teams.plan in ('starter', 'pro') or (teams.plan = 'trial' and teams.created_at >= ?))",
  ];
  const values: unknown[] = [trialCutoff];

  if (args.cursor) {
    where.push("teams.id > ?");
    values.push(args.cursor);
  }

  if (args.enabledTeamIds?.length) {
    where.push(`teams.id in (${args.enabledTeamIds.map(() => "?").join(", ")})`);
    values.push(...args.enabledTeamIds);
  }

  values.push(limit);

  const { results = [] } = await d1
    .prepare(
      `select
        teams.id,
        teams.base_currency,
        coalesce(owner_user.locale, 'en') as owner_locale,
        coalesce(owner_user.timezone, 'UTC') as owner_timezone
      from teams
      left join team_memberships owner_membership
        on owner_membership.team_id = teams.id
        and owner_membership.role = 'owner'
      left join users owner_user on owner_user.id = owner_membership.user_id
      where ${where.join(" and ")}
      group by teams.id
      order by teams.id asc
      limit ?`,
    )
    .bind(...values)
    .all<InsightEligibleTeamRow>();

  return results.map((row) => ({
    id: row.id,
    baseCurrency: row.base_currency,
    ownerLocale: row.owner_locale ?? "en",
    ownerTimezone: row.owner_timezone ?? "UTC",
  }));
}

export async function getTeamMembershipIdsFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    userId?: string | null;
    email?: string | null;
  },
) {
  const teams = await listTeamsForUserFromD1(d1, args);
  return teams.map((team) => team.id);
}

export async function getTeamMembersFromD1(
  d1: CloudflareD1DatabaseBinding,
  teamId: string,
): Promise<TeamMemberIdentityRecord[]> {
  const { results = [] } = await d1
    .prepare(
      `select
        tm.*,
        u.email as user_email,
        u.full_name as user_full_name,
        u.avatar_url as user_avatar_url,
        u.timezone as user_timezone,
        u.locale as user_locale
      from team_memberships tm
      join users u on u.id = tm.user_id
      where tm.team_id = ?
      order by tm.created_at asc`,
    )
    .bind(teamId)
    .all<TeamMemberRow>();

  return results.map((row) => ({
    id: row.id,
    role: row.role,
    teamId: row.team_id,
    createdAt: row.created_at,
    user: {
      id: row.user_id,
      fullName: row.user_full_name,
      avatarUrl: row.user_avatar_url,
      email: row.user_email,
      timezone: row.user_timezone,
      locale: row.user_locale,
    },
	  }));
}

async function getMembershipFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: { teamId: string; userId: string },
) {
  return d1
    .prepare("select * from team_memberships where team_id = ? and user_id = ? limit 1")
    .bind(args.teamId, args.userId)
    .first<TeamMembershipRow>();
}

async function pickFallbackTeamIdFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: { userId: string; excludedTeamId: string },
) {
  const row = await d1
    .prepare(
      `select team_id
      from team_memberships
      where user_id = ? and team_id <> ?
      order by created_at asc
      limit 1`,
    )
    .bind(args.userId, args.excludedTeamId)
    .first<{ team_id: string }>();

  return row?.team_id ?? null;
}

export async function switchCurrentTeamInD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    userId?: string | null;
    email?: string | null;
    teamId: string;
  },
) {
  const user = await resolveUserFromD1(d1, args);

  if (!user) {
    throw new Error("Team switch target not found");
  }

  const membership = await getMembershipFromD1(d1, {
    teamId: args.teamId,
    userId: user.id,
  });

  if (!membership) {
    throw new Error("Team switch target not found");
  }

  await d1
    .prepare("update users set current_team_id = ?, updated_at = ? where id = ?")
    .bind(args.teamId, new Date().toISOString(), user.id)
    .run();

  return {
    id: user.id,
    teamId: args.teamId,
  };
}

export async function hasTeamAccessInD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    userId?: string | null;
    email?: string | null;
    teamId: string;
  },
) {
  const membershipIds = await getTeamMembershipIdsFromD1(d1, args);
  return membershipIds.includes(args.teamId);
}

export async function updateTeamMemberInD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    userId: string;
    role: TeamRole;
  },
) {
  const membership = await getMembershipFromD1(d1, args);

  if (!membership) {
    throw new Error("Team member not found");
  }

  await d1
    .prepare("update team_memberships set role = ?, updated_at = ? where id = ?")
    .bind(args.role, new Date().toISOString(), membership.id)
    .run();

  const members = await getTeamMembersFromD1(d1, args.teamId);
  return members.find((member) => member.user.id === args.userId) ?? null;
}

export async function deleteTeamMemberFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    userId: string;
  },
) {
  const membership = await getMembershipFromD1(d1, args);

  if (!membership) {
    throw new Error("Team member not found");
  }

  const fallbackTeamId = await pickFallbackTeamIdFromD1(d1, {
    userId: args.userId,
    excludedTeamId: args.teamId,
  });
  const timestamp = new Date().toISOString();

  await d1.prepare("delete from team_memberships where id = ?").bind(membership.id).run();
  await d1
    .prepare(
      `update users
      set current_team_id = ?, updated_at = ?
      where id = ? and current_team_id = ?`,
    )
    .bind(fallbackTeamId, timestamp, args.userId, args.teamId)
    .run();

  return { id: membership.id };
}

export async function leaveTeamInD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    userId?: string | null;
    email?: string | null;
  },
) {
  const user = await resolveUserFromD1(d1, args);

  if (!user) {
    throw new Error("Leave team target not found");
  }

  return deleteTeamMemberFromD1(d1, {
    teamId: args.teamId,
    userId: user.id,
  });
}

export async function updateTeamInD1(d1: CloudflareD1DatabaseBinding, input: UpdateTeamD1Input) {
  const assignments = ["updated_at = ?"];
  const values: unknown[] = [new Date().toISOString()];
  const add = (column: string, value: unknown) => {
    assignments.push(`${column} = ?`);
    values.push(value);
  };

  if (input.name !== undefined) add("name", input.name);
  if (input.logoUrl !== undefined) add("logo_url", input.logoUrl);
  if (input.email !== undefined) add("email", input.email);
  if (input.baseCurrency !== undefined) add("base_currency", input.baseCurrency);
  if (input.countryCode !== undefined) add("country_code", input.countryCode);
  if (input.fiscalYearStartMonth !== undefined) {
    add("fiscal_year_start_month", input.fiscalYearStartMonth);
  }
  if (input.exportSettings !== undefined) {
    add("export_settings_json", JSON.stringify(input.exportSettings));
  }
  if (input.subscriptionStatus !== undefined) add("subscription_status", input.subscriptionStatus);
  if (input.stripeAccountId !== undefined) add("stripe_account_id", input.stripeAccountId);
  if (input.stripeConnectStatus !== undefined) {
    add("stripe_connect_status", input.stripeConnectStatus);
  }
  if (input.companyType !== undefined) add("company_type", input.companyType);
  if (input.heardAbout !== undefined) add("heard_about", input.heardAbout);
  if (input.canceledAt !== undefined) add("canceled_at", input.canceledAt);
  if (input.plan !== undefined) add("plan", input.plan);

  values.push(input.teamId);
  await d1
    .prepare(`update teams set ${assignments.join(", ")} where id = ?`)
    .bind(...values)
    .run();

  return getTeamByIdFromD1(d1, input.teamId);
}

export async function createTeamInD1(d1: CloudflareD1DatabaseBinding, input: CreateTeamD1Input) {
  const timestamp = new Date().toISOString();
  const teamId = input.teamId ?? crypto.randomUUID();
  const membershipId = crypto.randomUUID();

  await d1
    .prepare(
      `insert into teams (
        id,
        name,
        logo_url,
        inbox_id,
        email,
        base_currency,
        country_code,
        fiscal_year_start_month,
        company_type,
        heard_about,
        plan,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      teamId,
      input.name,
      input.logoUrl ?? null,
      input.inboxId ?? null,
      input.email?.trim().toLowerCase() ?? null,
      input.baseCurrency ?? null,
      input.countryCode ?? null,
      input.fiscalYearStartMonth ?? null,
      input.companyType ?? null,
      input.heardAbout ?? null,
      "trial",
      timestamp,
      timestamp,
    )
    .run();

  if (input.userId) {
    await d1
      .prepare(
        `insert into team_memberships (
          id,
          team_id,
          user_id,
          role,
          created_at,
          updated_at
        ) values (?, ?, ?, 'owner', ?, ?)`,
      )
      .bind(membershipId, teamId, input.userId, timestamp, timestamp)
      .run();

    if (input.switchTeam) {
      await d1
        .prepare("update users set current_team_id = ?, updated_at = ? where id = ?")
        .bind(teamId, timestamp, input.userId)
        .run();
    }
  }

  return getTeamByIdFromD1(d1, teamId);
}

export async function deleteTeamFromD1(d1: CloudflareD1DatabaseBinding, teamId: string) {
  const members = await getTeamMembersFromD1(d1, teamId);

  await d1.prepare("delete from team_invites where team_id = ?").bind(teamId).run();
  await d1.prepare("delete from team_memberships where team_id = ?").bind(teamId).run();
  await d1.prepare("delete from teams where id = ?").bind(teamId).run();
  await d1
    .prepare("update users set current_team_id = null, updated_at = ? where current_team_id = ?")
    .bind(new Date().toISOString(), teamId)
    .run();

  return {
    id: teamId,
    memberUserIds: members.map((member) => member.user.id),
  };
}

export function toTeamListRecord(team: TeamIdentityRecord, role: TeamRole): TeamListIdentityRecord {
  return {
    ...team,
    role,
  };
}

function teamInviteSelect(where: string) {
  return `
    select
      team_invites.id,
      team_invites.team_id,
      team_invites.email,
      team_invites.role,
      team_invites.invited_by_user_id,
      team_invites.created_at,
      team_invites.updated_at,
      teams.name as team_name,
      teams.logo_url as team_logo_url,
      invited_by.full_name as invited_by_full_name,
      invited_by.email as invited_by_email
    from team_invites
    left join teams on teams.id = team_invites.team_id
    left join users invited_by on invited_by.id = team_invites.invited_by_user_id
    ${where}
  `;
}

async function getTeamInviteByIdFromD1(d1: CloudflareD1DatabaseBinding, inviteId: string) {
  const row = await d1
    .prepare(`${teamInviteSelect("where team_invites.id = ?")} limit 1`)
    .bind(inviteId)
    .first<TeamInviteRow>();

  return row ? toTeamInvite(row) : null;
}

export async function getInvitesByEmailFromD1(
  d1: CloudflareD1DatabaseBinding,
  email: string,
): Promise<TeamInviteIdentityRecord[]> {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return [];
  }

  const { results = [] } = await d1
    .prepare(
      `${teamInviteSelect("where team_invites.email = ?")} order by team_invites.created_at asc`,
    )
    .bind(normalizedEmail)
    .all<TeamInviteRow>();

  return results.map(toTeamInvite);
}

export async function getTeamInvitesByTeamIdFromD1(
  d1: CloudflareD1DatabaseBinding,
  teamId: string,
): Promise<TeamInviteIdentityRecord[]> {
  const { results = [] } = await d1
    .prepare(
      `${teamInviteSelect("where team_invites.team_id = ?")} order by team_invites.created_at asc`,
    )
    .bind(teamId)
    .all<TeamInviteRow>();

  return results.map(toTeamInvite);
}

export async function createTeamInvitesInD1(
  d1: CloudflareD1DatabaseBinding,
  input: CreateTeamInvitesD1Input,
): Promise<CreateTeamInvitesD1Result> {
  const team = await getTeamByIdFromD1(d1, input.teamId);

  if (!team) {
    throw new Error("Team not found");
  }

  const memberRows = await d1
    .prepare(
      `select users.email
      from team_memberships
      join users on users.id = team_memberships.user_id
      where team_memberships.team_id = ?`,
    )
    .bind(input.teamId)
    .all<{ email: string | null }>();
  const existingMemberEmails = new Set(
    (memberRows.results ?? [])
      .map((row) => normalizeEmail(row.email))
      .filter((email): email is string => Boolean(email)),
  );
  const pendingRows = await d1
    .prepare("select email from team_invites where team_id = ?")
    .bind(input.teamId)
    .all<{ email: string | null }>();
  const pendingInviteEmails = new Set(
    (pendingRows.results ?? [])
      .map((row) => normalizeEmail(row.email))
      .filter((email): email is string => Boolean(email)),
  );
  const seenEmails = new Set<string>();
  const skippedInvites: CreateTeamInvitesD1Result["skippedInvites"] = [];
  const validInvites: CreateTeamInvitesD1Input["invites"] = [];

  for (const invite of input.invites) {
    const normalizedEmail = normalizeEmail(invite.email);

    if (!normalizedEmail) {
      continue;
    }

    if (seenEmails.has(normalizedEmail)) {
      skippedInvites.push({ email: invite.email, reason: "duplicate" });
      continue;
    }

    seenEmails.add(normalizedEmail);

    if (existingMemberEmails.has(normalizedEmail)) {
      skippedInvites.push({ email: invite.email, reason: "already_member" });
      continue;
    }

    if (pendingInviteEmails.has(normalizedEmail)) {
      skippedInvites.push({ email: invite.email, reason: "already_invited" });
      continue;
    }

    validInvites.push({
      email: normalizedEmail,
      role: invite.role,
    });
  }

  const timestamp = new Date().toISOString();
  const results: CreateTeamInvitesD1Result["results"] = [];

  for (const invite of validInvites) {
    const inviteId = crypto.randomUUID();

    await d1
      .prepare(
        `insert into team_invites (
          id,
          team_id,
          email,
          role,
          invited_by_user_id,
          created_at,
          updated_at
        ) values (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        inviteId,
        input.teamId,
        invite.email,
        invite.role,
        input.invitedByUserId ?? null,
        timestamp,
        timestamp,
      )
      .run();

    results.push({
      email: invite.email,
      code: null,
      role: invite.role,
      team: {
        id: team.id,
        name: team.name,
      },
    });
  }

  return {
    results,
    skippedInvites,
  };
}

export async function acceptTeamInviteInD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    inviteId: string;
    userId?: string | null;
    email?: string | null;
  },
) {
  const [invite, user] = await Promise.all([
    getTeamInviteByIdFromD1(d1, args.inviteId),
    resolveUserFromD1(d1, args),
  ]);

  if (!invite?.team?.id || !user) {
    throw new Error("Invite not found");
  }

  const inviteEmail = normalizeEmail(invite.email);
  const userEmail = normalizeEmail(args.email ?? user.email);

  if (inviteEmail && userEmail && inviteEmail !== userEmail) {
    throw new Error("Invite was sent to a different email address");
  }

  const existingMembership = await getMembershipFromD1(d1, {
    teamId: invite.team.id,
    userId: user.id,
  });

  if (!existingMembership) {
    const timestamp = new Date().toISOString();

    await d1
      .prepare(
        `insert into team_memberships (
          id,
          team_id,
          user_id,
          role,
          created_at,
          updated_at
        ) values (?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), invite.team.id, user.id, invite.role, timestamp, timestamp)
      .run();
  }

  await d1.prepare("delete from team_invites where id = ?").bind(args.inviteId).run();

  return {
    id: invite.id,
    role: invite.role,
    email: invite.email,
    teamId: invite.team.id,
  };
}

export async function declineTeamInviteInD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    inviteId: string;
    email?: string | null;
  },
) {
  const invite = await getTeamInviteByIdFromD1(d1, args.inviteId);

  if (!invite) {
    return null;
  }

  const inviteEmail = normalizeEmail(invite.email);
  const requestEmail = normalizeEmail(args.email);

  if (inviteEmail && requestEmail && inviteEmail !== requestEmail) {
    throw new Error("Invite was sent to a different email address");
  }

  await d1.prepare("delete from team_invites where id = ?").bind(args.inviteId).run();

  return { id: invite.id };
}

export async function deleteTeamInviteInD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    inviteId: string;
    teamId: string;
  },
) {
  const invite = await getTeamInviteByIdFromD1(d1, args.inviteId);

  if (!invite?.team || invite.team.id !== args.teamId) {
    return null;
  }

  await d1.prepare("delete from team_invites where id = ?").bind(args.inviteId).run();

  return { id: invite.id };
}
