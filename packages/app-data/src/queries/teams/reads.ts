import type { Database, QueryClient } from "../../client";
import { reuseQueryResult } from "../../utils/request-cache";
import { getBankConnections } from "../bank-connections";
import {
  getTeamByIdFromD1,
  getTeamByInboxIdFromD1,
  getTeamByStripeAccountIdFromD1,
  getTeamMembersFromD1,
  requireIdentityD1,
} from "../identity/d1";
import { getPublicInvoicesByTeam } from "../public-invoices";
import { countTransactionsFromD1, requireTransactionsD1 } from "../transactions/d1";
import type { TeamOwnerInfo } from "./shared";

export async function getTeamByIdImpl(db: Database | QueryClient, id: string) {
  return getTeamByIdFromD1(requireIdentityD1(db), id);
}

const getTeamByIdReused = reuseQueryResult({
  keyPrefix: "team-by-id",
  keyFn: (id: string) => id,
  load: async (_db: Database, id: string) => getTeamByIdImpl(_db as Database | QueryClient, id),
});

export async function getTeamById(_db: Database | QueryClient, id: string) {
  return getTeamByIdReused(_db as Database, id);
}

export const getTeamByInboxId = async (db: Database | QueryClient, inboxId: string) => {
  return getTeamByInboxIdFromD1(requireIdentityD1(db), inboxId);
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
  db: Database | QueryClient,
  stripeAccountId: string,
) => {
  return getTeamByStripeAccountIdFromD1(requireIdentityD1(db), stripeAccountId);
};

async function getTeamMembersImpl(db: Database, teamId: string) {
  const members = await getTeamMembersFromD1(requireIdentityD1(db), teamId);

  return members.map((member) => ({
    id: member.user.id,
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

export async function getTeamOwnerInfo(_db: Database, teamId: string): Promise<TeamOwnerInfo> {
  const [owner] = await getTeamMembers(_db, teamId);

  return {
    timezone: owner?.timezone || "UTC",
    locale: owner?.locale || "en",
  };
}

export async function getTeamOwnerTimezone(db: Database, teamId: string): Promise<string> {
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
  const [transactionCount, bankConnections, invoices] = await Promise.all([
    countTransactionsFromD1(requireTransactionsD1(db), {
      teamId,
    }),
    getBankConnections(db, { teamId }),
    getPublicInvoicesByTeam(db, {
      teamId,
    }),
  ]);

  return transactionCount > 0 || bankConnections.length > 0 || invoices.length > 0;
}
