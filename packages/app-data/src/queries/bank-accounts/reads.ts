import type { Database } from "../../client";
import {
  getBankAccountByIdFromD1,
  getBankAccountsBalancesFromD1,
  getBankAccountsCurrenciesFromD1,
  getBankAccountsFromD1,
  getBankAccountTeamIdFromD1,
  requireBankAccountsD1,
} from "./d1";
import type { GetBankAccountsParams, GetBankAccountTeamIdParams } from "./types";

type GetBankAccountByIdParams = {
  id: string;
  teamId: string;
};

type GetBankAccountBalanceResponse = {
  id: string;
  currency: string;
  balance: number;
  name: string;
  logo_url: string;
};

type GetBankAccountsCurrenciesResponse = {
  currency: string;
};

export async function getBankAccounts(db: Database, params: GetBankAccountsParams) {
  return getBankAccountsFromD1(requireBankAccountsD1(db), params);
}

export async function getBankAccountById(db: Database, params: GetBankAccountByIdParams) {
  return getBankAccountByIdFromD1(requireBankAccountsD1(db), params);
}

/**
 * Get teamId for a bank account by ID
 * Used by worker processors that don't have teamId in payload
 */
export async function getBankAccountTeamId(
  db: Database,
  params: GetBankAccountTeamIdParams,
): Promise<string | null> {
  return getBankAccountTeamIdFromD1(requireBankAccountsD1(db), params);
}

export async function getBankAccountsBalances(
  db: Database,
  teamId: string,
): Promise<GetBankAccountBalanceResponse[]> {
  return getBankAccountsBalancesFromD1(requireBankAccountsD1(db), teamId);
}

export async function getBankAccountsCurrencies(
  db: Database,
  teamId: string,
): Promise<GetBankAccountsCurrenciesResponse[]> {
  return getBankAccountsCurrenciesFromD1(requireBankAccountsD1(db), teamId);
}
