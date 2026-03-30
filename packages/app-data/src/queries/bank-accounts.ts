import {
  CASH_ACCOUNT_TYPES,
  CREDIT_ACCOUNT_TYPE,
} from "@tamias/banking/account";
import {
  createBankAccountInConvex,
  deleteBankAccountInConvex,
  getBankAccountByIdFromConvex,
  getBankAccountTeamIdFromConvex,
  getBankAccountsBalancesFromConvex,
  getBankAccountsCurrenciesFromConvex,
  getBankAccountsFromConvex,
  type CurrentUserIdentityRecord,
  updateBankAccountInConvex,
} from "@tamias/app-data-convex";
import { nanoid } from "nanoid";
import type { Database } from "../client";
import {
  createQueryCacheKey,
  getOrSetQueryCacheValue,
} from "../client";
import { cacheAcrossRequests } from "../utils/short-lived-cache";
import { getTeamById } from "./index";

type ConvexUserId = CurrentUserIdentityRecord["convexId"];

export type CreateBankAccountParams = {
  name: string;
  currency?: string;
  teamId: string;
  userId: ConvexUserId;
  manual?: boolean;
};

export async function createBankAccount(
  _db: Database,
  params: CreateBankAccountParams,
) {
  return createBankAccountInConvex({
    teamId: params.teamId,
    userId: params.userId,
    name: params.name,
    currency: params.currency,
    manual: params.manual,
    accountId: nanoid(),
    type: "depository",
  });
}

type DeleteBankAccountParams = {
  id: string;
  teamId: string;
};

export async function deleteBankAccount(
  _db: Database,
  params: DeleteBankAccountParams,
) {
  return deleteBankAccountInConvex({
    id: params.id,
    teamId: params.teamId,
  });
}

export type UpdateBankAccountParams = {
  id: string;
  teamId: string;
  name?: string;
  type?: "depository" | "credit" | "other_asset" | "loan" | "other_liability";
  balance?: number;
  enabled?: boolean;
  currency?: string;
  baseBalance?: number;
  baseCurrency?: string;
};

export async function updateBankAccount(
  _db: Database,
  params: UpdateBankAccountParams,
) {
  const { id, teamId, ...data } = params;

  return updateBankAccountInConvex({
    id,
    teamId,
    name: data.name,
    type: data.type,
    balance: data.balance,
    enabled: data.enabled,
    currency: data.currency,
    baseBalance: data.baseBalance,
    baseCurrency: data.baseCurrency,
  });
}

export type GetBankAccountsParams = {
  teamId: string;
  enabled?: boolean;
  manual?: boolean;
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

type GetBankAccountByIdParams = {
  id: string;
  teamId: string;
};

export async function getBankAccountById(
  _db: Database,
  params: GetBankAccountByIdParams,
) {
  return getBankAccountByIdFromConvex({
    id: params.id,
    teamId: params.teamId,
  });
}

export type GetBankAccountTeamIdParams = {
  id: string;
};

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

type GetBankAccountBalanceResponse = {
  id: string;
  currency: string;
  balance: number;
  name: string;
  logo_url: string;
};

export async function getBankAccountsBalances(db: Database, teamId: string) {
  void db;
  return getBankAccountsBalancesFromConvex({ teamId });
}

type GetBankAccountsCurrenciesResponse = {
  currency: string;
};

export async function getBankAccountsCurrencies(db: Database, teamId: string) {
  void db;
  return getBankAccountsCurrenciesFromConvex({ teamId });
}

export type GetCashBalanceParams = {
  teamId: string;
  currency?: string;
};

/**
 * Get total cash balance across all cash accounts (depository + other_asset).
 * Credit cards, loans, and other liabilities are excluded.
 */
export async function getCashBalance(
  db: Database,
  params: GetCashBalanceParams,
) {
  return getOrSetQueryCacheValue(
    db,
    createQueryCacheKey("bank-accounts:cash-balance", {
      teamId: params.teamId,
      currency: params.currency ?? null,
    }),
    async () => {
      const { teamId, currency: targetCurrency } = params;

      // Get team's base currency if no target currency specified
      let baseCurrency = targetCurrency;
      if (!baseCurrency) {
        const team = await getTeamById(db, teamId);
        baseCurrency = team?.baseCurrency || "USD";
      }

      const accounts = (
        await getBankAccountsFromConvex({
          teamId,
          enabled: true,
        })
      ).filter(
        (account) =>
          !!account.type &&
          CASH_ACCOUNT_TYPES.includes(
            account.type as (typeof CASH_ACCOUNT_TYPES)[number],
          ),
      );

      let totalBalance = 0;
      const accountBreakdown: Array<{
        id: string;
        name: string;
        originalBalance: number;
        originalCurrency: string;
        convertedBalance: number;
        convertedCurrency: string;
        type: string;
        logoUrl?: string;
      }> = [];

      for (const account of accounts) {
        const balance = Number(account.balance) || 0;
        const accountCurrency: string = account.currency || baseCurrency;

        let convertedBalance = balance;

        // Use baseBalance if available and currencies match, otherwise use original balance
        if (
          accountCurrency !== baseCurrency &&
          account.baseBalance &&
          account.baseCurrency === baseCurrency
        ) {
          convertedBalance = Number(account.baseBalance);
        } else if (accountCurrency !== baseCurrency) {
          // If no baseBalance available, use original balance as fallback
          // In a real scenario, you'd want to fetch exchange rates here
          convertedBalance = balance;
        }

        totalBalance += convertedBalance;

        accountBreakdown.push({
          id: account.id,
          name: account.name || "Unknown Account",
          originalBalance: balance,
          originalCurrency: accountCurrency,
          convertedBalance,
          convertedCurrency: baseCurrency,
          type: account.type || "depository",
          logoUrl: account.bankConnection?.logoUrl || undefined,
        });
      }

      return {
        totalBalance: Math.round(totalBalance * 100) / 100,
        currency: baseCurrency,
        accountCount: accounts.length,
        accountBreakdown,
      };
    },
  );
}

export type GetNetPositionParams = {
  teamId: string;
  currency?: string;
};

/**
 * Calculate net position: Cash minus Credit Card Debt.
 *
 * Net Position provides a quick "working capital" view for SMB owners.
 *
 * **Cash includes:**
 * - `depository` accounts (checking, savings)
 * - `other_asset` accounts (treasury, money market)
 *
 * **Debt includes:**
 * - `credit` accounts (credit cards)
 *
 * **Why loans are excluded:**
 * Loan accounts (`loan` type) are intentionally NOT included in Net Position because:
 * 1. Net Position is designed as a simple "cash vs credit card" metric
 * 2. Loans are long-term liabilities with different payment structures
 * 3. Including loans would conflate short-term liquidity with long-term debt
 * 4. For complete debt visibility, use `getBalanceSheet()` which includes all debt types
 *
 * @see getBalanceSheet - For complete assets/liabilities including loans
 * @see getCashBalance - For cash-only calculation
 */
async function getNetPositionImpl(
  db: Database,
  params: GetNetPositionParams,
) {
  const { teamId, currency: targetCurrency } = params;

  // Get team's base currency if no target currency specified
  let baseCurrency = targetCurrency;
  if (!baseCurrency) {
    const team = await getTeamById(db, teamId);
    baseCurrency = team?.baseCurrency || "USD";
  }

  const accounts = await getBankAccountsFromConvex({
    teamId,
    enabled: true,
  });
  const cashAccounts = accounts.filter(
    (account) =>
      !!account.type &&
      CASH_ACCOUNT_TYPES.includes(
        account.type as (typeof CASH_ACCOUNT_TYPES)[number],
      ),
  );
  const creditAccounts = accounts.filter(
    (account) => account.type === CREDIT_ACCOUNT_TYPE,
  );

  // Calculate cash total
  let cashTotal = 0;
  for (const account of cashAccounts) {
    const balance = Number(account.balance) || 0;
    const accountCurrency: string = account.currency || baseCurrency;

    let convertedBalance = balance;
    if (
      accountCurrency !== baseCurrency &&
      account.baseBalance &&
      account.baseCurrency === baseCurrency
    ) {
      convertedBalance = Number(account.baseBalance);
    }

    cashTotal += convertedBalance;
  }

  // Calculate credit debt total
  // Note: Different providers store credit balances differently:
  // - Plaid stores as positive (amount owed)
  // - GoCardless stores as negative (debt)
  // We use Math.abs() to normalize both conventions
  let creditDebt = 0;
  for (const account of creditAccounts) {
    const balance = Number(account.balance) || 0;
    const accountCurrency: string = account.currency || baseCurrency;

    let convertedBalance = Math.abs(balance);
    if (
      accountCurrency !== baseCurrency &&
      account.baseBalance &&
      account.baseCurrency === baseCurrency
    ) {
      convertedBalance = Math.abs(Number(account.baseBalance));
    }

    creditDebt += convertedBalance;
  }

  const netPosition = cashTotal - creditDebt;

  return {
    cash: Math.round(cashTotal * 100) / 100,
    creditDebt: Math.round(creditDebt * 100) / 100,
    netPosition: Math.round(netPosition * 100) / 100,
    currency: baseCurrency,
    cashAccountCount: cashAccounts.length,
    creditAccountCount: creditAccounts.length,
  };
}

export const getNetPosition = cacheAcrossRequests({
  keyPrefix: "net-position",
  keyFn: (params: GetNetPositionParams) =>
    [params.teamId, params.currency ?? ""].join(":"),
  load: getNetPositionImpl,
});
