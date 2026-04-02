
import {
  getCurrentUserFromConvex,
  getInvitesByEmailFromConvex,
  getTeamByPublicTeamIdFromConvexIdentity,
  getTeamInvitesByPublicTeamIdFromConvex,
  getTeamMembersFromConvex,
  listTeamsForUserFromConvex,
} from "@tamias/app-services/identity";
import { generateOptionalFileKey } from "@tamias/encryption";
import { cache } from "react";
import { measureServerRead } from "@/server/perf";
import { getCurrentSession } from "./context";
import type {
  LocalCurrentTeam,
  LocalCurrentUser,
  LocalCurrentUserInvites,
  LocalTeamInvites,
  LocalTeamInvitesByEmail,
  LocalTeamList,
  LocalTeamMembers,
} from "./types";

export const getCurrentUserLocally = cache(
  async (): Promise<LocalCurrentUser> => {
    return measureServerRead("getCurrentUserLocally", async () => {
      const session = await getCurrentSession();

      if (!session) {
        return undefined;
      }

      const result = await getCurrentUserFromConvex({
        userId: session.user.convexId,
        email: session.user.email ?? null,
      });

      if (!result) {
        return undefined;
      }

      return {
        ...result,
        fileKey: await generateOptionalFileKey(result.teamId),
      };
    });
  },
);

export const getCurrentTeamLocally = cache(
  async (): Promise<LocalCurrentTeam> => {
    return measureServerRead("getCurrentTeamLocally", async () => {
      const session = await getCurrentSession();

      if (!session?.teamId) {
        return null;
      }

      return getTeamByPublicTeamIdFromConvexIdentity(session.teamId);
    });
  },
);

export const getCurrentUserTeamsLocally = cache(
  async (): Promise<LocalTeamList> => {
    const session = await getCurrentSession();

    if (!session) {
      return [];
    }

    return listTeamsForUserFromConvex({
      userId: session.user.convexId,
      email: session.user.email ?? null,
    });
  },
);

export const getCurrentTeamMembersLocally = cache(
  async (): Promise<LocalTeamMembers> => {
    const session = await getCurrentSession();

    if (!session?.teamId) {
      return [];
    }

    return getTeamMembersFromConvex(session.teamId);
  },
);

export const getCurrentTeamInvitesLocally = cache(
  async (): Promise<LocalTeamInvites> => {
    const session = await getCurrentSession();

    if (!session?.teamId) {
      return [];
    }

    return getTeamInvitesByPublicTeamIdFromConvex(session.teamId);
  },
);

const getInvitesByCurrentEmailLocally = cache(
  async (): Promise<LocalCurrentUserInvites> => {
    const session = await getCurrentSession();

    if (!session?.user.email) {
      return [];
    }

    return getInvitesByEmailFromConvex(session.user.email);
  },
);

export const getCurrentUserInvitesLocally = cache(
  async (): Promise<LocalCurrentUserInvites> => {
    return getInvitesByCurrentEmailLocally();
  },
);

export const getTeamInvitesByEmailLocally = cache(
  async (): Promise<LocalTeamInvitesByEmail> => {
    return getInvitesByCurrentEmailLocally();
  },
);
