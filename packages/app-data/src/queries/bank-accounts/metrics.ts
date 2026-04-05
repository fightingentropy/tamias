import {
  CASH_ACCOUNT_TYPES,
  CREDIT_ACCOUNT_TYPE,
} from "@tamias/banking/account";
import { getBankAccountsFromConvex } from "../../convex";
import type { Database } from "../../client";
import { createQueryCacheKey, getOrSetQueryCacheValue } from "../../client";
import { reuseQueryResult } from "../../utils/request-cache";
import { getTeamById } from "../teams";
import type {
  GetCashBalanceParams,
  GetNetPositionParams,
} from "./types";

type EnabledBankAccount = Awaited<
  ReturnType<typeof getBankAccountsFromConvex>
>[number];

type CashBalanceAccountBreakdownItem = {
  id: string;
  name: string;
  originalBalance: number;
  originalCurrency: string;
  convertedBalance: number;
  convertedCurrency: string;
  type: string;
  logoUrl?: string;
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

async function getResolvedBaseCurrency(
  db: Database,
  teamId: string,
  targetCurrency?: string,
) {
  if (targetCurrency) {
    return targetCurrency;
  }

  const team = await getTeamById(db, teamId);
  return team?.baseCurrency || "USD";
}

function getAccountCurrency(
  account: EnabledBankAccount,
  baseCurrency: string,
) {
  return account.currency || baseCurrency;
}

function getConvertedAccountBalance(
  account: EnabledBankAccount,
  baseCurrency: string,
  options?: {
    absolute?: boolean;
  },
) {
  const balance = Number(account.balance) || 0;
  const accountCurrency = getAccountCurrency(account, baseCurrency);

  let convertedBalance =
    options?.absolute === true ? Math.abs(balance) : balance;

  if (
    accountCurrency !== baseCurrency &&
    account.baseBalance &&
    account.baseCurrency === baseCurrency
  ) {
    convertedBalance =
      options?.absolute === true
        ? Math.abs(Number(account.baseBalance))
        : Number(account.baseBalance);
  }

  return {
    balance,
    accountCurrency,
    convertedBalance,
  };
}

async function getEnabledBankAccounts(teamId: string) {
  return getBankAccountsFromConvex({
    teamId,
    enabled: true,
  });
}

function getCashAccounts(accounts: EnabledBankAccount[]) {
  return accounts.filter(
    (account) =>
      !!account.type &&
      CASH_ACCOUNT_TYPES.includes(
        account.type as (typeof CASH_ACCOUNT_TYPES)[number],
      ),
  );
}

function getCreditAccounts(accounts: EnabledBankAccount[]) {
  return accounts.filter((account) => account.type === CREDIT_ACCOUNT_TYPE);
}

function buildCashBalanceBreakdown(args: {
  accounts: EnabledBankAccount[];
  baseCurrency: string;
}) {
  let totalBalance = 0;
  const accountBreakdown: CashBalanceAccountBreakdownItem[] = [];

  for (const account of args.accounts) {
    const { balance, accountCurrency, convertedBalance } =
      getConvertedAccountBalance(account, args.baseCurrency);

    totalBalance += convertedBalance;
    accountBreakdown.push({
      id: account.id,
      name: account.name || "Unknown Account",
      originalBalance: balance,
      originalCurrency: accountCurrency,
      convertedBalance,
      convertedCurrency: args.baseCurrency,
      type: account.type || "depository",
      logoUrl: account.bankConnection?.logoUrl || undefined,
    });
  }

  return {
    totalBalance: roundMoney(totalBalance),
    accountBreakdown,
  };
}

function sumConvertedBalances(
  accounts: EnabledBankAccount[],
  baseCurrency: string,
  options?: {
    absolute?: boolean;
  },
) {
  let total = 0;

  for (const account of accounts) {
    total += getConvertedAccountBalance(account, baseCurrency, options)
      .convertedBalance;
  }

  return roundMoney(total);
}

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
      const baseCurrency = await getResolvedBaseCurrency(
        db,
        params.teamId,
        params.currency,
      );
      const cashAccounts = getCashAccounts(
        await getEnabledBankAccounts(params.teamId),
      );
      const { totalBalance, accountBreakdown } = buildCashBalanceBreakdown({
        accounts: cashAccounts,
        baseCurrency,
      });

      return {
        totalBalance,
        currency: baseCurrency,
        accountCount: cashAccounts.length,
        accountBreakdown,
      };
    },
  );
}

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
  const baseCurrency = await getResolvedBaseCurrency(
    db,
    params.teamId,
    params.currency,
  );
  const accounts = await getEnabledBankAccounts(params.teamId);
  const cashAccounts = getCashAccounts(accounts);
  const creditAccounts = getCreditAccounts(accounts);
  const cash = sumConvertedBalances(cashAccounts, baseCurrency);
  const creditDebt = sumConvertedBalances(creditAccounts, baseCurrency, {
    absolute: true,
  });
  const netPosition = roundMoney(cash - creditDebt);

  return {
    cash,
    creditDebt,
    netPosition,
    currency: baseCurrency,
    cashAccountCount: cashAccounts.length,
    creditAccountCount: creditAccounts.length,
  };
}

export const getNetPosition = reuseQueryResult({
  keyPrefix: "net-position",
  keyFn: (params: GetNetPositionParams) =>
    [params.teamId, params.currency ?? ""].join(":"),
  load: getNetPositionImpl,
});
