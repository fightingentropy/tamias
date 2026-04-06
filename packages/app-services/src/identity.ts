import { api } from "@tamias/app-data/convex/api";
import type { Id } from "@tamias/app-data/convex/data-model";
import type { AIProvider } from "@tamias/domain/identity";
import {
  createConvexClient,
  getConvexServiceKey,
  getSharedConvexClient,
} from "./convex-client";

type ConvexUserId = Id<"appUsers">;
type ConvexTeamId = Id<"teams">;

export type ConvexSession = {
  user: {
    id: ConvexUserId;
    convexId?: ConvexUserId;
    email?: string;
    full_name?: string;
  };
  teamId?: string;
  convexTeamId?: ConvexTeamId;
  teamMembershipIds?: string[];
  convexTeamMembershipIds?: ConvexTeamId[];
};

function serviceArgs<T extends Record<string, unknown>>(args: T) {
  return {
    serviceKey: getConvexServiceKey(),
    ...args,
  };
}

export async function getSessionFromConvex(
  accessToken?: string,
): Promise<ConvexSession | null> {
  if (!accessToken) {
    return null;
  }

  const client = createConvexClient();

  try {
    client.setAuth(accessToken);
    return (await client.query(api.identity.currentSession, {})) ?? null;
  } catch {
    return null;
  } finally {
    client.clearAuth();
  }
}

/**
 * Same data as {@link getCurrentUserFromConvex} / `serviceGetUserById`, but uses the caller's
 * Convex JWT (no deploy key). Use for dashboard `user.me` so local `wrangler dev` works without
 * `CONVEX_SERVICE_KEY` for hosted deployments.
 */
export async function getCurrentUserFromConvexAsAuthUser(accessToken?: string) {
  if (!accessToken) {
    return null;
  }

  const client = createConvexClient();

  try {
    client.setAuth(accessToken);
    return (await client.query(api.identity.currentUser, {})) ?? null;
  } catch {
    return null;
  } finally {
    client.clearAuth();
  }
}

/**
 * Current team for the JWT identity (no deploy key). Matches Convex `currentTeam`.
 */
export async function getCurrentTeamFromConvexAsAuthUser(accessToken?: string) {
  if (!accessToken) {
    return null;
  }

  const client = createConvexClient();

  try {
    client.setAuth(accessToken);
    return (await client.query(api.identity.currentTeam, {})) ?? null;
  } catch {
    return null;
  } finally {
    client.clearAuth();
  }
}

/**
 * Team memberships for the JWT identity (no deploy key). Matches Convex `teamList`.
 */
export async function listTeamsForUserFromConvexAsAuthUser(
  accessToken?: string,
) {
  if (!accessToken) {
    return null;
  }

  const client = createConvexClient();

  try {
    client.setAuth(accessToken);
    return await client.query(api.identity.teamList, {});
  } catch {
    return null;
  } finally {
    client.clearAuth();
  }
}

export async function ensureCurrentAppUserInConvex(accessToken?: string) {
  if (!accessToken) {
    return null;
  }

  const client = createConvexClient();

  try {
    client.setAuth(accessToken);
    return (
      (await client.mutation(api.identity.ensureCurrentAppUser, {})) ?? null
    );
  } catch {
    return null;
  } finally {
    client.clearAuth();
  }
}

export async function getCurrentUserFromConvex(args: {
  userId?: ConvexUserId;
  email?: string | null;
}) {
  return getSharedConvexClient().query(
    api.identity.serviceGetUserById,
    serviceArgs({
      userId: args.userId,
      email: args.email ?? undefined,
    }),
  );
}

export async function updateCurrentUserInConvex(args: {
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
  aiProvider?: AIProvider;
}) {
  return getSharedConvexClient().mutation(
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
      aiProvider: args.aiProvider,
    }),
  );
}

export async function getTeamByPublicTeamIdFromConvexIdentity(
  publicTeamId: string,
) {
  return getSharedConvexClient().query(
    api.identity.serviceGetTeamByPublicTeamId,
    serviceArgs({ publicTeamId }),
  );
}

export async function listTeamsForUserFromConvex(args: {
  userId?: ConvexUserId;
  email?: string | null;
}) {
  return getSharedConvexClient().query(
    api.identity.serviceListTeamsByUserId,
    serviceArgs({
      userId: args.userId,
      email: args.email ?? undefined,
    }),
  );
}

export async function getTeamMembershipIdsFromConvex(args: {
  userId?: ConvexUserId;
  email?: string | null;
}) {
  const teams = await listTeamsForUserFromConvex(args);
  return teams.map((team) => team.id);
}

export async function hasTeamAccessInConvex(args: {
  userId?: ConvexUserId;
  email?: string | null;
  publicTeamId: string;
}) {
  const teamMembershipIds = await getTeamMembershipIdsFromConvex({
    userId: args.userId,
    email: args.email ?? undefined,
  });

  return teamMembershipIds.includes(args.publicTeamId);
}

export async function switchCurrentTeamInConvex(args: {
  userId?: ConvexUserId;
  email?: string | null;
  publicTeamId: string;
}) {
  return getSharedConvexClient().mutation(
    api.identity.serviceSwitchCurrentTeam,
    serviceArgs({
      userId: args.userId,
      email: args.email ?? undefined,
      publicTeamId: args.publicTeamId,
    }),
  );
}

export async function getTeamMembersFromConvex(publicTeamId: string) {
  return getSharedConvexClient().query(
    api.identity.serviceGetTeamMembersByPublicTeamId,
    serviceArgs({ publicTeamId }),
  );
}

export async function updateTeamMemberInConvex(args: {
  publicTeamId: string;
  userId: ConvexUserId;
  role: "owner" | "member";
}) {
  return getSharedConvexClient().mutation(
    api.identity.serviceUpdateTeamMember,
    serviceArgs(args),
  );
}

export async function deleteTeamMemberInConvex(args: {
  publicTeamId: string;
  userId: ConvexUserId;
}) {
  return getSharedConvexClient().mutation(
    api.identity.serviceDeleteTeamMember,
    serviceArgs(args),
  );
}

export async function leaveTeamInConvex(args: {
  publicTeamId: string;
  userId?: ConvexUserId;
  email?: string | null;
}) {
  return getSharedConvexClient().mutation(
    api.identity.serviceLeaveTeam,
    serviceArgs({
      publicTeamId: args.publicTeamId,
      userId: args.userId,
      email: args.email ?? undefined,
    }),
  );
}

export async function getInvitesByEmailFromConvex(email: string) {
  return getSharedConvexClient().query(
    api.identity.serviceGetInvitesByEmail,
    serviceArgs({ email }),
  );
}

export async function getTeamInvitesByPublicTeamIdFromConvex(
  publicTeamId: string,
) {
  return getSharedConvexClient().query(
    api.identity.serviceGetTeamInvitesByPublicTeamId,
    serviceArgs({ publicTeamId }),
  );
}

export async function createTeamInvitesInConvex(args: {
  publicTeamId: string;
  invitedByUserId?: ConvexUserId;
  invites: {
    email: string;
    role: "owner" | "member";
  }[];
}) {
  return getSharedConvexClient().mutation(
    api.identity.serviceCreateTeamInvites,
    serviceArgs(args),
  );
}

export async function acceptTeamInviteInConvex(args: {
  publicInviteId: string;
  userId?: ConvexUserId;
  email: string;
}) {
  return getSharedConvexClient().mutation(
    api.identity.serviceAcceptTeamInvite,
    serviceArgs(args),
  );
}

export async function declineTeamInviteInConvex(args: {
  publicInviteId: string;
  email: string;
}) {
  return getSharedConvexClient().mutation(
    api.identity.serviceDeclineTeamInvite,
    serviceArgs(args),
  );
}

export async function deleteTeamInviteInConvex(args: {
  publicInviteId: string;
  publicTeamId: string;
}) {
  return getSharedConvexClient().mutation(
    api.identity.serviceDeleteTeamInvite,
    serviceArgs(args),
  );
}
