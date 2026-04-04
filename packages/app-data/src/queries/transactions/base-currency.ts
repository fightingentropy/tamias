import type { Database } from "../../client";
import { getBankAccounts, updateBankAccount } from "../bank-accounts";
import { getExchangeRate } from "../exhange-rates";
import { getTeamById } from "../teams";
import { bulkUpdateTransactionsBaseCurrency } from "./mutations";
import { getTransactionsByAccountId } from "./reads";

type RefreshTeamBaseCurrencyDataParams = {
  teamId: string;
  baseCurrency?: string | null;
  enabledOnly?: boolean;
};

function roundBaseCurrencyAmount(value: number, rate: number) {
  return +(value * rate).toFixed(2);
}

export async function refreshTeamBaseCurrencyData(
  db: Database,
  params: RefreshTeamBaseCurrencyDataParams,
) {
  const team = await getTeamById(db, params.teamId);
  const baseCurrency = (
    params.baseCurrency ??
    team?.baseCurrency ??
    ""
  ).toUpperCase();

  if (!baseCurrency) {
    throw new Error("Base currency is required");
  }

  const accounts = await getBankAccounts(db, {
    teamId: params.teamId,
    enabled: params.enabledOnly ?? true,
  });

  const exchangeRates = new Map<string, number>();
  const skippedAccounts: Array<{
    accountId: string;
    reason: string;
  }> = [];

  const getRate = async (currency: string) => {
    const normalizedCurrency = currency.toUpperCase();

    if (exchangeRates.has(normalizedCurrency)) {
      return exchangeRates.get(normalizedCurrency)!;
    }

    const result = await getExchangeRate(db, {
      base: normalizedCurrency,
      target: baseCurrency,
    });

    if (!result?.rate) {
      throw new Error(
        `Missing exchange rate from ${normalizedCurrency} to ${baseCurrency}`,
      );
    }

    const rate = Number(result.rate);
    exchangeRates.set(normalizedCurrency, rate);
    return rate;
  };

  let updatedAccountCount = 0;
  let updatedTransactionCount = 0;

  for (const account of accounts) {
    const accountCurrency = (account.currency ?? baseCurrency).toUpperCase();

    try {
      const rate = await getRate(accountCurrency);
      const balance = Number(account.balance ?? 0);

      await updateBankAccount(db, {
        id: account.id,
        teamId: params.teamId,
        baseBalance:
          accountCurrency === baseCurrency
            ? balance
            : roundBaseCurrencyAmount(balance, rate),
        baseCurrency,
      });

      updatedAccountCount += 1;

      const transactions = await getTransactionsByAccountId(db, {
        accountId: account.id,
        teamId: params.teamId,
      });

      const updates = [];

      for (const transaction of transactions) {
        const transactionCurrency = transaction.currency.toUpperCase();
        const transactionRate = await getRate(transactionCurrency);
        const nextBaseAmount =
          transactionCurrency === baseCurrency
            ? Number(transaction.amount)
            : roundBaseCurrencyAmount(Number(transaction.amount), transactionRate);

        if (
          transaction.baseCurrency === baseCurrency &&
          Number(transaction.baseAmount ?? NaN) === nextBaseAmount
        ) {
          continue;
        }

        updates.push({
          id: transaction.id,
          baseAmount: nextBaseAmount,
          baseCurrency,
        });
      }

      if (updates.length > 0) {
        await bulkUpdateTransactionsBaseCurrency(db, {
          teamId: params.teamId,
          transactions: updates,
        });
        updatedTransactionCount += updates.length;
      }
    } catch (error) {
      skippedAccounts.push({
        accountId: account.id,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    teamId: params.teamId,
    baseCurrency,
    accountCount: accounts.length,
    updatedAccountCount,
    updatedTransactionCount,
    skippedAccounts,
  };
}
