import {
  countTransactionsFromConvex,
  getBankConnectionsFromConvex,
  getPublicInvoicesByTeamFromConvex,
  getTeamByIdFromConvexIdentity,
  getTeamByInboxIdFromConvexIdentity,
  getTeamByStripeAccountIdFromConvexIdentity,
  getTeamMembersFromConvexIdentity,
} from "../../convex";
import type { Database, QueryClient } from "../../client";
import { reuseQueryResult } from "../../utils/request-cache";
import type { TeamOwnerInfo } from "./shared";

export async function getTeamByIdImpl(
  _db: Database | QueryClient,
  id: string,
) {
  return getTeamByIdFromConvexIdentity({ teamId: id });
}

const getTeamByIdReused = reuseQueryResult({
  keyPrefix: "team-by-id",
  keyFn: (id: string) => id,
  load: async (_db: Database, id: string) =>
    getTeamByIdImpl(_db as Database | QueryClient, id),
});

export async function getTeamById(_db: Database | QueryClient, id: string) {
  return getTeamByIdReused(_db as Database, id);
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

export const getTeamMembers = reuseQueryResult({
  keyPrefix: "team-members",
  keyFn: (teamId: string) => teamId,
  load: getTeamMembersImpl,
});

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

export async function getTeamOwnerTimezone(
  db: Database,
  teamId: string,
): Promise<string> {
  const info = await getTeamOwnerInfo(db, teamId);
  return info.timezone;
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

  return transactionCount > 0 || bankConnections.length > 0 || invoices.length > 0;
}
