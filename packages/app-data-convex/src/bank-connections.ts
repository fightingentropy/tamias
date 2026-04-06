import type { BankAccountRecord, BankAccountType } from "./bank-accounts";
import type { InstitutionProvider } from "./banking-reference";
import type { ConvexUserId } from "./base";
import { api, createClient, serviceArgs } from "./base";

export type BankConnectionProvider = InstitutionProvider;
export type BankConnectionStatus = "connected" | "disconnected" | "unknown";

export type BankConnectionRecord = {
  id: string;
  createdAt: string;
  institutionId: string;
  expiresAt: string | null;
  teamId: string;
  name: string;
  logoUrl: string | null;
  accessToken: string | null;
  enrollmentId: string | null;
  provider: BankConnectionProvider;
  lastAccessed: string | null;
  referenceId: string | null;
  status: BankConnectionStatus | null;
  errorDetails: string | null;
  errorRetries: number | null;
  bankAccounts: BankAccountRecord[];
};

export type BankConnectionLookupRecord = {
  id: string;
  createdAt: string;
  team: {
    id: string;
    plan: "trial" | "starter" | "pro";
    createdAt: string;
  };
};

export type BankProviderAccountInput = {
  id?: string;
  accountId: string;
  institutionId?: string;
  logoUrl?: string | null;
  name: string;
  bankName?: string;
  currency: string;
  enabled?: boolean;
  balance?: number;
  type: BankAccountType;
  accountReference?: string | null;
  expiresAt?: string | null;
  iban?: string | null;
  subtype?: string | null;
  bic?: string | null;
  routingNumber?: string | null;
  wireRoutingNumber?: string | null;
  accountNumber?: string | null;
  sortCode?: string | null;
  availableBalance?: number | null;
  creditLimit?: number | null;
};

export type CreateBankConnectionInConvexInput = {
  id?: string;
  teamId: string;
  userId: ConvexUserId;
  provider: BankConnectionProvider;
  accounts: BankProviderAccountInput[];
  accessToken?: string | null;
  enrollmentId?: string | null;
  referenceId?: string | null;
};

export type AddProviderAccountsInConvexInput = {
  connectionId: string;
  teamId: string;
  userId: ConvexUserId;
  accounts: BankProviderAccountInput[];
};

export type PatchBankConnectionInConvexInput = {
  id: string;
  teamId?: string;
  institutionId?: string;
  expiresAt?: string | null;
  name?: string;
  logoUrl?: string | null;
  accessToken?: string | null;
  enrollmentId?: string | null;
  provider?: BankConnectionProvider;
  lastAccessed?: string | null;
  referenceId?: string | null;
  status?: BankConnectionStatus;
  errorDetails?: string | null;
  errorRetries?: number | null;
};

export async function getBankConnectionsFromConvex(args: { teamId: string; enabled?: boolean }) {
  return createClient().query(
    api.bankConnections.serviceGetBankConnections,
    serviceArgs({
      publicTeamId: args.teamId,
      enabled: args.enabled,
    }),
  ) as Promise<BankConnectionRecord[]>;
}

export async function getBankConnectionByIdFromConvex(args: { id: string }) {
  return createClient().query(
    api.bankConnections.serviceGetBankConnectionById,
    serviceArgs({
      id: args.id,
    }),
  ) as Promise<BankConnectionRecord | null>;
}

export async function createBankConnectionInConvex(args: CreateBankConnectionInConvexInput) {
  return createClient().mutation(
    api.bankConnections.serviceCreateBankConnection,
    serviceArgs({
      id: args.id,
      publicTeamId: args.teamId,
      userId: args.userId,
      provider: args.provider,
      accounts: args.accounts,
      accessToken: args.accessToken,
      enrollmentId: args.enrollmentId,
      referenceId: args.referenceId,
    }),
  ) as Promise<BankConnectionRecord | null>;
}

export async function addProviderAccountsInConvex(args: AddProviderAccountsInConvexInput) {
  return createClient().mutation(
    api.bankConnections.serviceAddProviderAccounts,
    serviceArgs({
      bankConnectionId: args.connectionId,
      publicTeamId: args.teamId,
      userId: args.userId,
      accounts: args.accounts,
    }),
  ) as Promise<BankAccountRecord[]>;
}

export async function deleteBankConnectionInConvex(args: { id: string; teamId: string }) {
  return createClient().mutation(
    api.bankConnections.serviceDeleteBankConnection,
    serviceArgs({
      bankConnectionId: args.id,
      publicTeamId: args.teamId,
    }),
  ) as Promise<{
    referenceId: string | null;
    provider: BankConnectionProvider | null;
    accessToken: string | null;
  } | null>;
}

export async function reconnectBankConnectionInConvex(args: {
  teamId: string;
  referenceId: string;
  newReferenceId: string;
  expiresAt: string;
}) {
  return createClient().mutation(
    api.bankConnections.serviceReconnectBankConnection,
    serviceArgs({
      publicTeamId: args.teamId,
      referenceId: args.referenceId,
      newReferenceId: args.newReferenceId,
      expiresAt: args.expiresAt,
    }),
  ) as Promise<{ id: string } | null>;
}

export async function getBankConnectionByEnrollmentIdFromConvex(args: { enrollmentId: string }) {
  return createClient().query(
    api.bankConnections.serviceGetBankConnectionByEnrollmentId,
    serviceArgs({
      enrollmentId: args.enrollmentId,
    }),
  ) as Promise<BankConnectionLookupRecord | null>;
}

export async function getBankConnectionByReferenceIdFromConvex(args: { referenceId: string }) {
  return createClient().query(
    api.bankConnections.serviceGetBankConnectionByReferenceId,
    serviceArgs({
      referenceId: args.referenceId,
    }),
  ) as Promise<BankConnectionLookupRecord | null>;
}

export async function updateBankConnectionStatusInConvex(args: {
  id: string;
  status: BankConnectionStatus;
}) {
  return createClient().mutation(
    api.bankConnections.serviceUpdateBankConnectionStatus,
    serviceArgs({
      bankConnectionId: args.id,
      status: args.status,
    }),
  ) as Promise<{ id: string } | null>;
}

export async function updateBankConnectionReconnectByIdInConvex(args: {
  id: string;
  teamId: string;
  referenceId?: string;
  accessValidForDays: number;
}) {
  return createClient().mutation(
    api.bankConnections.serviceUpdateBankConnectionReconnectById,
    serviceArgs({
      bankConnectionId: args.id,
      publicTeamId: args.teamId,
      referenceId: args.referenceId,
      accessValidForDays: args.accessValidForDays,
    }),
  ) as Promise<{ id: string } | null>;
}

export async function patchBankConnectionInConvex(args: PatchBankConnectionInConvexInput) {
  return createClient().mutation(
    api.bankConnections.servicePatchBankConnection,
    serviceArgs({
      bankConnectionId: args.id,
      publicTeamId: args.teamId,
      ...args,
      id: undefined,
      teamId: undefined,
    }),
  ) as Promise<BankConnectionRecord | null>;
}
