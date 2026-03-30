import { api, createClient, serviceArgs } from "./base";

export type InboxAccountProvider = "gmail" | "outlook";
export type InboxAccountStatus = "connected" | "disconnected";

export type InboxAccountListRecord = {
  id: string;
  email: string;
  provider: InboxAccountProvider;
  lastAccessed: string;
  status: InboxAccountStatus;
  errorMessage: string | null;
};

export type InboxAccountRecord = {
  id: string;
  teamId: string;
  email: string;
  provider: InboxAccountProvider;
  accessToken: string;
  refreshToken: string;
  expiryDate: string;
  lastAccessed: string;
};

export type UpsertInboxAccountInput = {
  teamId: string;
  provider: InboxAccountProvider;
  accessToken: string;
  refreshToken: string;
  email: string;
  lastAccessed: string;
  externalId: string;
  expiryDate: string;
};

export type UpdateInboxAccountInput = {
  id: string;
  refreshToken?: string;
  accessToken?: string;
  expiryDate?: string;
  scheduleId?: string;
  lastAccessed?: string;
  status?: InboxAccountStatus;
  errorMessage?: string | null;
};

export type InboxAccountInfoRecord = {
  id: string;
  provider: InboxAccountProvider;
  teamId: string;
  lastAccessed: string;
};

export async function getInboxAccountsFromConvex(args: { teamId: string }) {
  return createClient().query(
    api.inboxAccounts.serviceGetInboxAccounts,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<InboxAccountListRecord[]>;
}

export async function getInboxAccountsByIdsFromConvex(args: { ids: string[] }) {
  return createClient().query(
    api.inboxAccounts.serviceGetInboxAccountsByIds,
    serviceArgs({
      ids: args.ids,
    }),
  ) as Promise<InboxAccountListRecord[]>;
}

export async function getInboxAccountByIdFromConvex(args: {
  id: string;
  teamId: string;
}) {
  return createClient().query(
    api.inboxAccounts.serviceGetInboxAccountById,
    serviceArgs({
      inboxAccountId: args.id,
      publicTeamId: args.teamId,
    }),
  ) as Promise<InboxAccountRecord | null>;
}

export async function deleteInboxAccountInConvex(args: {
  id: string;
  teamId: string;
}) {
  return createClient().mutation(
    api.inboxAccounts.serviceDeleteInboxAccount,
    serviceArgs({
      inboxAccountId: args.id,
      publicTeamId: args.teamId,
    }),
  ) as Promise<{ id: string; scheduleId: string | null } | null>;
}

export async function updateInboxAccountInConvex(
  args: UpdateInboxAccountInput,
) {
  return createClient().mutation(
    api.inboxAccounts.serviceUpdateInboxAccount,
    serviceArgs(args),
  ) as Promise<{ id: string } | null>;
}

export async function upsertInboxAccountInConvex(
  args: UpsertInboxAccountInput,
) {
  return createClient().mutation(
    api.inboxAccounts.serviceUpsertInboxAccount,
    serviceArgs({
      publicTeamId: args.teamId,
      provider: args.provider,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      email: args.email,
      lastAccessed: args.lastAccessed,
      externalId: args.externalId,
      expiryDate: args.expiryDate,
    }),
  ) as Promise<{
    id: string;
    provider: InboxAccountProvider;
    external_id: string;
  }>;
}

export async function getInboxAccountInfoFromConvex(args: { id: string }) {
  return createClient().query(
    api.inboxAccounts.serviceGetInboxAccountInfo,
    serviceArgs({
      id: args.id,
    }),
  ) as Promise<InboxAccountInfoRecord | null>;
}
