import { createDatabase, type Database } from "@tamias/app-data/client";
import {
  acceptTeamInviteInD1,
  createTeamInvitesInD1,
  declineTeamInviteInD1,
  deleteTeamInviteInD1,
  deleteTeamMemberFromD1,
  ensureUserInD1,
  getInvitesByEmailFromD1,
  getTeamByIdFromD1,
  getTeamInvitesByTeamIdFromD1,
  getTeamMembersFromD1,
  getTeamMembershipIdsFromD1,
  getUserByEmailFromD1,
  getUserByIdFromD1,
  hasTeamAccessInD1,
  leaveTeamInD1,
  listTeamsForUserFromD1,
  requireIdentityD1,
  switchCurrentTeamInD1,
  updateTeamMemberInD1,
  updateUserInD1,
  type CreateTeamInvitesD1Input,
  type UpdateUserD1Input,
} from "@tamias/app-data/queries";
import { verifyAccessToken, type AuthIdentity, type SessionUserRecord } from "@tamias/auth-session";

function identityD1(db: Database = createDatabase()) {
  return requireIdentityD1(db);
}

function toSessionUserRecord(
  record: Awaited<ReturnType<typeof getUserByIdFromD1>>,
): SessionUserRecord | null {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    email: record.email,
    fullName: record.fullName,
    avatarUrl: record.avatarUrl,
    teamId: record.teamId,
  };
}

export async function ensureCurrentUser(
  _accessToken?: string,
  identity?: AuthIdentity | null,
  db?: Database,
) {
  const user = await ensureUserInD1(identityD1(db), {
    authUserId: identity?.subject ?? null,
    email: identity?.email ?? null,
    fullName: identity?.full_name ?? null,
    avatarUrl: identity?.avatar_url ?? null,
  });

  return toSessionUserRecord(user);
}

export async function getCurrentUser(args: {
  userId?: string | null;
  email?: string | null;
  db?: Database;
}) {
  const d1 = identityD1(args.db);

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

export async function getCurrentSessionUser(args: {
  userId?: string | null;
  email?: string | null;
  db?: Database;
}) {
  return toSessionUserRecord(await getCurrentUser(args));
}

export async function getCurrentUserAsAuthUser(accessToken?: string | null, db?: Database) {
  const identity = await verifyAccessToken(accessToken ?? undefined);

  if (!identity) {
    return null;
  }

  return ensureCurrentUser(accessToken ?? undefined, identity, db);
}

export async function updateCurrentUser(
  input: UpdateUserD1Input & {
    currentEmail?: string | null;
    db?: Database;
  },
) {
  return updateUserInD1(identityD1(input.db), input);
}

export async function getTeamMembershipIds(args: {
  userId?: string | null;
  email?: string | null;
  db?: Database;
}) {
  return getTeamMembershipIdsFromD1(identityD1(args.db), args);
}

export async function getTeamById(teamId: string, db?: Database) {
  return getTeamByIdFromD1(identityD1(db), teamId);
}

export async function listTeamsForUser(args: {
  userId?: string | null;
  email?: string | null;
  db?: Database;
}) {
  return listTeamsForUserFromD1(identityD1(args.db), args);
}

export async function listTeamsForAccessToken(accessToken?: string | null, db?: Database) {
  const user = await getCurrentUserAsAuthUser(accessToken, db);

  if (!user) {
    return null;
  }

  return listTeamsForUser({
    userId: user.id,
    email: user.email ?? null,
    db,
  });
}

export async function getCurrentTeamForAccessToken(accessToken?: string | null, db?: Database) {
  const user = await getCurrentUserAsAuthUser(accessToken, db);

  if (!user?.teamId) {
    return null;
  }

  return getTeamById(user.teamId, db);
}

export async function getTeamMembers(teamId: string, db?: Database) {
  return getTeamMembersFromD1(identityD1(db), teamId);
}

export async function updateTeamMember(args: {
  teamId: string;
  userId: string;
  role: "owner" | "member";
  db?: Database;
}) {
  return updateTeamMemberInD1(identityD1(args.db), args);
}

export async function deleteTeamMember(args: { teamId: string; userId: string; db?: Database }) {
  return deleteTeamMemberFromD1(identityD1(args.db), args);
}

export async function hasTeamAccess(args: {
  userId?: string | null;
  email?: string | null;
  teamId: string;
  db?: Database;
}) {
  return hasTeamAccessInD1(identityD1(args.db), args);
}

export async function leaveTeam(args: {
  teamId: string;
  userId?: string | null;
  email?: string | null;
  db?: Database;
}) {
  return leaveTeamInD1(identityD1(args.db), args);
}

export async function switchCurrentTeam(args: {
  userId?: string | null;
  email?: string | null;
  teamId: string;
  db?: Database;
}) {
  return switchCurrentTeamInD1(identityD1(args.db), args);
}

export async function getInvitesByEmail(email: string, db?: Database) {
  return getInvitesByEmailFromD1(identityD1(db), email);
}

export async function getTeamInvitesByTeamId(teamId: string, db?: Database) {
  return getTeamInvitesByTeamIdFromD1(identityD1(db), teamId);
}

export async function createTeamInvites(input: CreateTeamInvitesD1Input & { db?: Database }) {
  return createTeamInvitesInD1(identityD1(input.db), input);
}

export async function acceptTeamInvite(args: {
  inviteId: string;
  userId?: string | null;
  email?: string | null;
  db?: Database;
}) {
  return acceptTeamInviteInD1(identityD1(args.db), args);
}

export async function declineTeamInvite(args: {
  inviteId: string;
  email?: string | null;
  db?: Database;
}) {
  return declineTeamInviteInD1(identityD1(args.db), args);
}

export async function deleteTeamInvite(args: { inviteId: string; teamId: string; db?: Database }) {
  return deleteTeamInviteInD1(identityD1(args.db), args);
}
