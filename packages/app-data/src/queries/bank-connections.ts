import {
  addProviderAccountsInConvex,
  createBankConnectionInConvex,
  deleteBankConnectionInConvex,
  getBankAccountDetailsFromConvex,
  type CurrentUserIdentityRecord,
  getBankConnectionByIdFromConvex,
  getBankAccountsWithPaymentInfoFromConvex,
  getBankConnectionByEnrollmentIdFromConvex,
  getBankConnectionByReferenceIdFromConvex,
  getBankConnectionsFromConvex,
  reconnectBankConnectionInConvex,
  updateBankConnectionReconnectByIdInConvex,
  updateBankConnectionStatusInConvex,
} from "../convex";
import type { Database } from "../client";

type ConvexUserId = CurrentUserIdentityRecord["convexId"];

export type GetBankConnectionsParams = {
  teamId: string;
  enabled?: boolean;
};

export const getBankConnections = async (
  _db: Database,
  params: GetBankConnectionsParams,
) => {
  return getBankConnectionsFromConvex({
    teamId: params.teamId,
    enabled: params.enabled,
  });
};

export const getBankConnectionById = async (
  _db: Database,
  params: { id: string },
) => {
  return getBankConnectionByIdFromConvex({
    id: params.id,
  });
};

type DeleteBankConnectionParams = {
  id: string;
  teamId: string;
};

export const deleteBankConnection = async (
  _db: Database,
  params: DeleteBankConnectionParams,
) => {
  return deleteBankConnectionInConvex({
    id: params.id,
    teamId: params.teamId,
  });
};

export type CreateBankConnectionPayload = {
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
    // US bank account details (Teller, Plaid)
    routingNumber?: string | null;
    wireRoutingNumber?: string | null;
    accountNumber?: string | null; // Will be encrypted before storage
    sortCode?: string | null;
    // Credit account balances
    availableBalance?: number | null;
    creditLimit?: number | null;
  }[];
  accessToken?: string | null;
  enrollmentId?: string | null;
  referenceId?: string | null;
  teamId: string;
  userId: ConvexUserId;
  provider: "gocardless" | "teller" | "plaid";
};

export const createBankConnection = async (
  _db: Database,
  payload: CreateBankConnectionPayload,
) => {
  const {
    accounts,
    accessToken,
    enrollmentId,
    referenceId,
    teamId,
    userId,
    provider,
  } = payload;

  if (accounts.length === 0) {
    return;
  }

  return createBankConnectionInConvex({
    teamId,
    userId,
    provider,
    accessToken,
    enrollmentId,
    referenceId,
    accounts,
  });
};

export type AddProviderAccountsParams = {
  connectionId: string;
  teamId: string;
  userId: ConvexUserId;
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

export const addProviderAccounts = async (
  _db: Database,
  params: AddProviderAccountsParams,
) => {
  if (params.accounts.length === 0) {
    return [];
  }

  return addProviderAccountsInConvex({
    connectionId: params.connectionId,
    teamId: params.teamId,
    userId: params.userId,
    accounts: params.accounts,
  });
};

export type ReconnectBankConnectionParams = {
  referenceId: string;
  newReferenceId: string;
  expiresAt: string;
  teamId: string;
};

export const reconnectBankConnection = async (
  _db: Database,
  params: ReconnectBankConnectionParams,
) => {
  return reconnectBankConnectionInConvex({
    teamId: params.teamId,
    referenceId: params.referenceId,
    newReferenceId: params.newReferenceId,
    expiresAt: params.expiresAt,
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
export const getBankAccountDetails = async (
  _db: Database,
  params: GetBankAccountDetailsParams,
) => {
  return getBankAccountDetailsFromConvex({
    accountId: params.accountId,
    teamId: params.teamId,
  });
};

export const getBankConnectionByEnrollmentId = async (
  _db: Database,
  params: { enrollmentId: string },
) => {
  return getBankConnectionByEnrollmentIdFromConvex({
    enrollmentId: params.enrollmentId,
  });
};

export const getBankConnectionByReferenceId = async (
  _db: Database,
  params: { referenceId: string },
) => {
  return getBankConnectionByReferenceIdFromConvex({
    referenceId: params.referenceId,
  });
};

export const updateBankConnectionStatus = async (
  _db: Database,
  params: { id: string; status: "connected" | "disconnected" | "unknown" },
) => {
  return updateBankConnectionStatusInConvex(params);
};

export type UpdateBankConnectionReconnectByIdParams = {
  id: string;
  teamId: string;
  referenceId?: string;
  accessValidForDays: number;
};

export const updateBankConnectionReconnectById = async (
  _db: Database,
  params: UpdateBankConnectionReconnectByIdParams,
) => {
  return updateBankConnectionReconnectByIdInConvex(params);
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
  _db: Database,
  params: GetBankAccountsWithPaymentInfoParams,
): Promise<BankAccountWithPaymentInfo[]> => {
  return getBankAccountsWithPaymentInfoFromConvex({
    teamId: params.teamId,
  });
};
