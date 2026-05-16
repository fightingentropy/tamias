import type { Database } from "../client";
import {
  addProviderAccountsInD1,
  createBankConnectionInD1,
  deleteBankConnectionFromD1,
  getBankAccountDetailsFromD1,
  getBankAccountsWithPaymentInfoFromD1,
  getBankConnectionByIdFromD1,
  getBankConnectionByReferenceIdFromD1,
  getBankConnectionsFromD1,
  patchBankConnectionInD1,
  requireBankConnectionsD1,
  type PatchBankConnectionInD1Params,
} from "./bank-connections/d1";

type AppUserId = string;

export type GetBankConnectionsParams = {
  teamId: string;
  enabled?: boolean;
};

export const getBankConnections = async (db: Database, params: GetBankConnectionsParams) => {
  return getBankConnectionsFromD1(requireBankConnectionsD1(db), params);
};

export const getBankConnectionById = async (db: Database, params: { id: string }) => {
  return getBankConnectionByIdFromD1(requireBankConnectionsD1(db), params);
};

type DeleteBankConnectionParams = {
  id: string;
  teamId: string;
};

export const deleteBankConnection = async (db: Database, params: DeleteBankConnectionParams) => {
  const result = await getBankConnectionById(db, { id: params.id });

  if (result?.teamId === params.teamId) {
    await deleteBankConnectionFromD1(db, params);
    return result;
  }

  return null;
};

export type CreateBankConnectionPayload = {
  id?: string;
  accounts: {
    accountId: string;
    institutionId: string;
    logoUrl?: string | null;
    name: string;
    bankName: string;
    currency: string;
    enabled: boolean;
    balance?: number;
    type: "depository" | "credit" | "other_asset" | "loan" | "other_liability";
    accountReference?: string | null;
    expiresAt?: string | null;
    // Additional account data for reconnect matching and user display
    iban?: string | null;
    subtype?: string | null;
    bic?: string | null;
    routingNumber?: string | null;
    wireRoutingNumber?: string | null;
    accountNumber?: string | null;
    sortCode?: string | null;
    // Credit account balances
    availableBalance?: number | null;
    creditLimit?: number | null;
  }[];
  accessToken?: string | null;
  referenceId?: string | null;
  teamId: string;
  userId: AppUserId;
  provider: "truelayer";
};

export const createBankConnection = async (db: Database, payload: CreateBankConnectionPayload) => {
  const { accounts, accessToken, id, referenceId, teamId, userId, provider } = payload;

  if (accounts.length === 0) {
    return;
  }

  return createBankConnectionInD1(requireBankConnectionsD1(db), {
    id,
    teamId,
    userId,
    provider,
    accessToken,
    referenceId,
    accounts,
  });
};

export type AddProviderAccountsParams = {
  connectionId: string;
  teamId: string;
  userId: AppUserId;
  accounts: {
    accountId: string;
    name: string;
    currency: string;
    type: "depository" | "credit" | "other_asset" | "loan" | "other_liability";
    accountReference?: string | null;
    balance?: number;
    iban?: string | null;
    subtype?: string | null;
    bic?: string | null;
    routingNumber?: string | null;
    wireRoutingNumber?: string | null;
    accountNumber?: string | null;
    sortCode?: string | null;
    availableBalance?: number | null;
    creditLimit?: number | null;
  }[];
};

export const addProviderAccounts = async (db: Database, params: AddProviderAccountsParams) => {
  if (params.accounts.length === 0) {
    return [];
  }

  return addProviderAccountsInD1(requireBankConnectionsD1(db), {
    connectionId: params.connectionId,
    teamId: params.teamId,
    userId: params.userId,
    accounts: params.accounts,
  });
};

export type GetBankAccountDetailsParams = {
  accountId: string;
  teamId: string;
};

/**
 * Get bank account details including decrypted sensitive fields.
 * Only call this when user explicitly requests to reveal account details.
 */
export const getBankAccountDetails = async (db: Database, params: GetBankAccountDetailsParams) => {
  return getBankAccountDetailsFromD1(requireBankConnectionsD1(db), params);
};

export const getBankConnectionByReferenceId = async (
  db: Database,
  params: { referenceId: string },
) => {
  return getBankConnectionByReferenceIdFromD1(requireBankConnectionsD1(db), params);
};

export const updateBankConnectionStatus = async (
  db: Database,
  params: { id: string; status: "connected" | "disconnected" | "unknown" },
) => {
  return patchBankConnectionInD1(requireBankConnectionsD1(db), params);
};

export type PatchBankConnectionParams = PatchBankConnectionInD1Params;

export const patchBankConnection = async (db: Database, params: PatchBankConnectionParams) => {
  return patchBankConnectionInD1(requireBankConnectionsD1(db), params);
};

export type GetBankAccountsWithPaymentInfoParams = {
  teamId: string;
};

export type BankAccountWithPaymentInfo = {
  id: string;
  name: string;
  bankName: string | null;
  currency: string | null;
  // Decrypted payment info
  iban: string | null;
  accountNumber: string | null;
  // Non-encrypted payment info
  routingNumber: string | null;
  wireRoutingNumber: string | null;
  bic: string | null;
  sortCode: string | null;
};

/**
 * Get bank accounts that have payment information (IBAN, routing numbers, etc.)
 * Returns decrypted sensitive fields for use in invoice payment details.
 * Only returns accounts that have at least one payment field populated.
 */
export const getBankAccountsWithPaymentInfo = async (
  db: Database,
  params: GetBankAccountsWithPaymentInfoParams,
): Promise<BankAccountWithPaymentInfo[]> => {
  return getBankAccountsWithPaymentInfoFromD1(requireBankConnectionsD1(db), params);
};
