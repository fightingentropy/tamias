import type { BankConnectionRecord } from "./bank-connections";
import type { ConvexUserId } from "./base";
import { api, createClient, serviceArgs } from "./base";

export type BankAccountType =
  | "credit"
  | "depository"
  | "other_asset"
  | "loan"
  | "other_liability";

export type BankAccountRecord = {
  id: string;
  createdAt: string;
  createdBy: ConvexUserId | null;
  teamId: string;
  name: string | null;
  currency: string | null;
  bankConnectionId: string | null;
  enabled: boolean;
  accountId: string;
  balance: number | null;
  manual: boolean;
  type: BankAccountType | null;
  baseCurrency: string | null;
  baseBalance: number | null;
  errorDetails: string | null;
  errorRetries: number | null;
  accountReference: string | null;
  iban: string | null;
  subtype: string | null;
  bic: string | null;
  routingNumber: string | null;
  wireRoutingNumber: string | null;
  accountNumber: string | null;
  sortCode: string | null;
  availableBalance: number | null;
  creditLimit: number | null;
  bankConnection?: BankConnectionRecord | null;
};

export type BankAccountBalanceRecord = {
  id: string;
  currency: string;
  balance: number;
  name: string;
  logo_url: string;
};

export type BankAccountCurrencyRecord = {
  currency: string;
};

export type BankAccountDetailsRecord = {
  id: string;
  iban: string | null;
  accountNumber: string | null;
  routingNumber: string | null;
  wireRoutingNumber: string | null;
  bic: string | null;
  sortCode: string | null;
};

export type BankAccountWithPaymentInfoRecord = {
  id: string;
  name: string;
  bankName: string | null;
  currency: string | null;
  iban: string | null;
  accountNumber: string | null;
  routingNumber: string | null;
  wireRoutingNumber: string | null;
  bic: string | null;
  sortCode: string | null;
};

export type CreateBankAccountInConvexInput = {
  id?: string;
  teamId: string;
  userId: ConvexUserId;
  name: string;
  currency?: string;
  manual?: boolean;
  accountId?: string;
  type?: BankAccountType;
};

export type UpdateBankAccountInConvexInput = {
  id: string;
  teamId: string;
  name?: string;
  type?: BankAccountType;
  balance?: number;
  enabled?: boolean;
  currency?: string;
  baseBalance?: number;
  baseCurrency?: string;
  errorDetails?: string | null;
  errorRetries?: number | null;
  accountReference?: string | null;
  accountId?: string;
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

export type PatchBankAccountInConvexInput = UpdateBankAccountInConvexInput;

export async function getBankAccountsFromConvex(args: {
  teamId: string;
  enabled?: boolean;
  manual?: boolean;
}) {
  return createClient().query(
    api.bankAccounts.serviceGetBankAccounts,
    serviceArgs({
      publicTeamId: args.teamId,
      enabled: args.enabled,
      manual: args.manual,
    }),
  ) as Promise<BankAccountRecord[]>;
}

export async function getBankAccountByIdFromConvex(args: {
  id: string;
  teamId: string;
}) {
  return createClient().query(
    api.bankAccounts.serviceGetBankAccountById,
    serviceArgs({
      id: args.id,
      publicTeamId: args.teamId,
    }),
  ) as Promise<BankAccountRecord | null>;
}

export async function getBankAccountTeamIdFromConvex(args: { id: string }) {
  return createClient().query(
    api.bankAccounts.serviceGetBankAccountTeamId,
    serviceArgs({
      id: args.id,
    }),
  ) as Promise<string | null>;
}

export async function getBankAccountsCurrenciesFromConvex(args: {
  teamId: string;
}) {
  return createClient().query(
    api.bankAccounts.serviceGetBankAccountsCurrencies,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<BankAccountCurrencyRecord[]>;
}

export async function getBankAccountsBalancesFromConvex(args: {
  teamId: string;
}) {
  return createClient().query(
    api.bankAccounts.serviceGetBankAccountsBalances,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<BankAccountBalanceRecord[]>;
}

export async function createBankAccountInConvex(
  args: CreateBankAccountInConvexInput,
) {
  return createClient().mutation(
    api.bankAccounts.serviceCreateBankAccount,
    serviceArgs({
      id: args.id,
      publicTeamId: args.teamId,
      userId: args.userId,
      name: args.name,
      currency: args.currency,
      manual: args.manual,
      accountId: args.accountId,
      type: args.type,
    }),
  ) as Promise<BankAccountRecord>;
}

export async function updateBankAccountInConvex(
  args: UpdateBankAccountInConvexInput,
) {
  return createClient().mutation(
    api.bankAccounts.servicePatchBankAccountByLegacyId,
    serviceArgs({
      bankAccountId: args.id,
      publicTeamId: args.teamId,
      ...args,
      id: undefined,
      teamId: undefined,
    }),
  ) as Promise<BankAccountRecord | null>;
}

export async function patchBankAccountInConvex(
  args: PatchBankAccountInConvexInput,
) {
  return updateBankAccountInConvex(args);
}

export async function deleteBankAccountInConvex(args: {
  id: string;
  teamId: string;
}) {
  return createClient().mutation(
    api.bankAccounts.serviceDeleteBankAccount,
    serviceArgs({
      bankAccountId: args.id,
      publicTeamId: args.teamId,
    }),
  ) as Promise<BankAccountRecord | null>;
}

export async function getBankAccountDetailsFromConvex(args: {
  accountId: string;
  teamId: string;
}) {
  return createClient().query(
    api.bankAccounts.serviceGetBankAccountDetails,
    serviceArgs({
      accountId: args.accountId,
      publicTeamId: args.teamId,
    }),
  ) as Promise<BankAccountDetailsRecord | null>;
}

export async function getBankAccountsWithPaymentInfoFromConvex(args: {
  teamId: string;
}) {
  return createClient().query(
    api.bankAccounts.serviceGetBankAccountsWithPaymentInfo,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<BankAccountWithPaymentInfoRecord[]>;
}
