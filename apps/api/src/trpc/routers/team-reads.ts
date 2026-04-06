import { getAvailablePlans } from "@tamias/app-data/queries";
import { getBankConnections } from "@tamias/app-data/queries/bank-connections";
import { isHostedConvexMissingServiceKey } from "@tamias/app-services/convex-client";
import {
  getCurrentTeamFromConvexAsAuthUser,
  getInvitesByEmailFromConvex,
  getTeamByPublicTeamIdFromConvexIdentity,
  getTeamInvitesByPublicTeamIdFromConvex,
  getTeamMembersFromConvex,
  listTeamsForUserFromConvex,
  listTeamsForUserFromConvexAsAuthUser,
} from "@tamias/app-services/identity";
import { getInboxAccountsForTeam } from "@tamias/app-services/inbox";
import { protectedProcedure } from "../init";

export const teamReadProcedures = {
  current: protectedProcedure.query(
    async ({ ctx: { teamId, accessToken } }) => {
      if (!teamId) {
        return null;
      }

      const fromAuthUser =
        accessToken && !accessToken.startsWith("mid_")
          ? await getCurrentTeamFromConvexAsAuthUser(accessToken)
          : null;

      if (fromAuthUser && fromAuthUser.id === teamId) {
        return fromAuthUser;
      }

      if (isHostedConvexMissingServiceKey()) {
        return null;
      }

      return getTeamByPublicTeamIdFromConvexIdentity(teamId);
    },
  ),

  members: protectedProcedure.query(async ({ ctx: { teamId } }) => {
    if (!teamId) {
      return [];
    }

    return getTeamMembersFromConvex(teamId);
  }),

  list: protectedProcedure.query(
    async ({ ctx: { session, accessToken } }) => {
      const fromAuthUser =
        accessToken && !accessToken.startsWith("mid_")
          ? await listTeamsForUserFromConvexAsAuthUser(accessToken)
          : null;

      if (fromAuthUser !== null) {
        return fromAuthUser;
      }

      if (isHostedConvexMissingServiceKey()) {
        return [];
      }

      return listTeamsForUserFromConvex({
        userId: session.user.convexId,
        email: session.user.email ?? null,
      });
    },
  ),

  teamInvites: protectedProcedure.query(async ({ ctx: { teamId } }) => {
    if (!teamId) {
      return [];
    }

    return getTeamInvitesByPublicTeamIdFromConvex(teamId);
  }),

  invitesByEmail: protectedProcedure.query(async ({ ctx: { session } }) => {
    if (!session.user.email) {
      return [];
    }

    return getInvitesByEmailFromConvex(session.user.email);
  }),

  availablePlans: protectedProcedure.query(async ({ ctx: { db, teamId } }) => {
    return getAvailablePlans(db, teamId!);
  }),

  connectionStatus: protectedProcedure.query(
    async ({ ctx: { db, teamId } }) => {
      if (!teamId) {
        return { bankConnections: [], inboxAccounts: [] };
      }

      const [bankConnections, inboxAccounts] = await Promise.all([
        getBankConnections(db, { teamId }),
        getInboxAccountsForTeam(teamId),
      ]);

      return {
        bankConnections: bankConnections.map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          expiresAt: c.expiresAt,
          logoUrl: c.logoUrl,
        })),
        inboxAccounts: inboxAccounts.map((a) => ({
          id: a.id,
          email: a.email,
          status: a.status,
          provider: a.provider,
        })),
      };
    },
  ),
};
