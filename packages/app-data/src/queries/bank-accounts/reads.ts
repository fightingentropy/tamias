import {
  getBankAccountByIdFromConvex,
  getBankAccountTeamIdFromConvex,
  getBankAccountsBalancesFromConvex,
  getBankAccountsCurrenciesFromConvex,
  getBankAccountsFromConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../../client";
import type {
  GetBankAccountsParams,
  GetBankAccountTeamIdParams,
} from "./types";

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

export async function getBankAccounts(
  _db: Database,
  params: GetBankAccountsParams,
) {
  return getBankAccountsFromConvex({
    teamId: params.teamId,
    enabled: params.enabled,
    manual: params.manual,
  });
}

export async function getBankAccountById(
  _db: Database,
  params: GetBankAccountByIdParams,
) {
  return getBankAccountByIdFromConvex({
    id: params.id,
    teamId: params.teamId,
  });
}

/**
 * Get teamId for a bank account by ID
 * Used by worker processors that don't have teamId in payload
 */
export async function getBankAccountTeamId(
  _db: Database,
  params: GetBankAccountTeamIdParams,
): Promise<string | null> {
  return getBankAccountTeamIdFromConvex({
    id: params.id,
  });
}

export async function getBankAccountsBalances(
  db: Database,
  teamId: string,
): Promise<GetBankAccountBalanceResponse[]> {
  void db;
  return getBankAccountsBalancesFromConvex({ teamId });
}

export async function getBankAccountsCurrencies(
  db: Database,
  teamId: string,
): Promise<GetBankAccountsCurrenciesResponse[]> {
  void db;
  return getBankAccountsCurrenciesFromConvex({ teamId });
}
