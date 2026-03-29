import {
  getInvitesByEmailFromConvex,
  getTeamByPublicTeamIdFromConvexIdentity,
  getTeamInvitesByPublicTeamIdFromConvex,
  getTeamMembersFromConvex,
  listTeamsForUserFromConvex,
} from "@tamias/app-services/identity";
import { getBankConnectionsForTeam } from "@tamias/app-services/bank";
import { getInboxAccountsForTeam } from "@tamias/app-services/inbox";
import { getAvailablePlans } from "@tamias/app-data/queries";
import { protectedProcedure } from "../init";

export const teamReadProcedures = {
  current: protectedProcedure.query(async ({ ctx: { teamId } }) => {
    if (!teamId) {
      return null;
    }

    return getTeamByPublicTeamIdFromConvexIdentity(teamId);
  }),

  members: protectedProcedure.query(async ({ ctx: { teamId } }) => {
    if (!teamId) {
      return [];
    }

    return getTeamMembersFromConvex(teamId);
  }),

  list: protectedProcedure.query(async ({ ctx: { session } }) => {
    return listTeamsForUserFromConvex({
      userId: session.user.convexId,
      email: session.user.email ?? null,
    });
  }),

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
        getBankConnectionsForTeam({ db, teamId }),
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
