import { createDatabase, type Database } from "../client";
import {
  deleteInboxAccountFromD1,
  getInboxAccountByIdFromD1,
  getInboxAccountInfoFromD1,
  getInboxAccountsByIdsFromD1,
  getInboxAccountsD1,
  getInboxAccountsFromD1,
  updateInboxAccountInD1,
  upsertInboxAccountInD1,
} from "./inbox-accounts/d1";

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

export type InboxAccountInfoRecord = {
  id: string;
  provider: InboxAccountProvider;
  teamId: string;
  lastAccessed: string;
};

export type UpsertInboxAccountResult = {
  id: string;
  provider: InboxAccountProvider;
  external_id: string;
};

export type DeleteInboxAccountResult = {
  id: string;
  scheduleId: string | null;
};

function getDb(db?: Database) {
  return db ?? createDatabase();
}

function requireInboxAccountsD1(db: Database) {
  const d1 = getInboxAccountsD1(db);

  if (!d1) {
    throw new Error("Inbox accounts require Cloudflare D1");
  }

  return d1;
}

async function getInboxAccountsImpl(db: Database, teamId: string) {
  return getInboxAccountsFromD1(requireInboxAccountsD1(db), { teamId });
}

export async function getInboxAccounts(teamId: string, db?: Database) {
  return getInboxAccountsImpl(getDb(db), teamId);
}

export async function getInboxAccountsByIds(ids: string[], db?: Database) {
  return getInboxAccountsByIdsFromD1(requireInboxAccountsD1(getDb(db)), ids);
}

type GetInboxAccountByIdParams = {
  id: string;
  teamId: string;
};

async function getInboxAccountByIdImpl(db: Database, params: GetInboxAccountByIdParams) {
  return getInboxAccountByIdFromD1(requireInboxAccountsD1(db), params);
}

export async function getInboxAccountById(params: GetInboxAccountByIdParams, db?: Database) {
  return getInboxAccountByIdImpl(getDb(db), params);
}

type DeleteInboxAccountParams = {
  id: string;
  teamId: string;
};

export async function deleteInboxAccount(params: DeleteInboxAccountParams, db?: Database) {
  return deleteInboxAccountFromD1(requireInboxAccountsD1(getDb(db)), params);
}

export type UpdateInboxAccountParams = {
  id: string;
  refreshToken?: string;
  accessToken?: string;
  expiryDate?: string;
  scheduleId?: string;
  lastAccessed?: string;
  status?: "connected" | "disconnected";
  errorMessage?: string | null;
};

export async function updateInboxAccount(params: UpdateInboxAccountParams, db?: Database) {
  return updateInboxAccountInD1(requireInboxAccountsD1(getDb(db)), params);
}

export type UpsertInboxAccountParams = {
  teamId: string;
  provider: "gmail" | "outlook";
  accessToken: string;
  refreshToken: string;
  email: string;
  lastAccessed: string;
  externalId: string;
  expiryDate: string;
};

export async function upsertInboxAccount(params: UpsertInboxAccountParams, db?: Database) {
  return upsertInboxAccountInD1(requireInboxAccountsD1(getDb(db)), params);
}

type GetInboxAccountInfoParams = {
  id: string;
};

export async function getInboxAccountInfo(params: GetInboxAccountInfoParams, db?: Database) {
  return getInboxAccountInfoFromD1(requireInboxAccountsD1(getDb(db)), params);
}
