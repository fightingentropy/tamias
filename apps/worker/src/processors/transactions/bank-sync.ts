import {
  getBankAccountById,
  upsertTransactions as upsertTransactionsQuery,
  type UpsertTransactionData,
} from "@tamias/app-data/queries";
import { patchBankAccountInConvex } from "@tamias/app-data/convex";
import { enqueue } from "@tamias/job-client";
import { trpc } from "@tamias/trpc";
import type { SyncBankAccountPayload } from "../../schemas/transactions";
import { getDb } from "../../utils/db";
import { processBatch } from "../../utils/process-batch";

const BATCH_SIZE = 500;

type ProviderTransaction = {
  id: string;
  description: string | null;
  method: string | null;
  date: string;
  name: string;
  status: "pending" | "posted";
  counterparty_name: string | null;
  merchant_name: string | null;
  balance: number | null;
  currency: string;
  amount: number;
  category: string | null;
};

type LoggerLike = {
  info(message: string, payload?: Record<string, unknown>): void;
  warn(message: string, payload?: Record<string, unknown>): void;
  error(message: string, payload?: Record<string, unknown>): void;
};

function parseAPIError(error: unknown) {
  if (typeof error === "object" && error !== null && "error" in error) {
    const apiError = error as { error: { code: string; message: string } };

    return {
      code: apiError.error.code,
      message: apiError.error.message,
    };
  }

  return { code: "unknown", message: "An unknown error occurred" };
}

function getClassification(type: SyncBankAccountPayload["accountType"]) {
  switch (type) {
    case "credit":
      return "credit";
    default:
      return "depository";
  }
}

function normalizeMethod(
  method: string | null,
): UpsertTransactionData["method"] {
  switch (method) {
    case "card_purchase":
    case "transfer":
    case "other":
      return method;
    default:
      return "other";
  }
}

function toUpsertTransaction(params: {
  transaction: ProviderTransaction;
  teamId: string;
  bankAccountId: string;
  manualSync?: boolean;
}): UpsertTransactionData {
  const { transaction, teamId, bankAccountId, manualSync } = params;

  return {
    name: transaction.name,
    description: transaction.description,
    date: transaction.date,
    amount: transaction.amount,
    currency: transaction.currency,
    method: normalizeMethod(transaction.method),
    internalId: `${teamId}_${transaction.id}`,
    categorySlug: transaction.category,
    bankAccountId,
    balance: transaction.balance,
    teamId,
    counterpartyName: transaction.counterparty_name,
    merchantName: transaction.merchant_name,
    status: transaction.status,
    manual: false,
    ...(manualSync ? { notified: true } : {}),
  };
}

export async function syncBankAccount(
  payload: SyncBankAccountPayload,
  logger: LoggerLike,
) {
  const {
    id,
    teamId,
    accountId,
    accountType,
    accessToken,
    errorRetries,
    provider,
    currency: storedCurrency,
    manualSync,
  } = payload;
  const db = getDb();
  const classification = getClassification(accountType);
  const updateAccount = async (data: {
    balance?: number | null;
    availableBalance?: number | null;
    creditLimit?: number | null;
    errorDetails?: string | null;
    errorRetries?: number | null;
    currency?: string;
  }) => {
    await patchBankAccountInConvex({
      id,
      teamId,
      balance: data.balance ?? undefined,
      availableBalance: data.availableBalance ?? undefined,
      creditLimit: data.creditLimit ?? undefined,
      errorDetails: data.errorDetails ?? undefined,
      errorRetries: data.errorRetries ?? undefined,
      currency: data.currency,
    });
  };

  let currentCurrency = storedCurrency;
  if (!currentCurrency) {
    const accountData = await getBankAccountById(db, { id, teamId });
    currentCurrency = accountData?.currency ?? undefined;
  }

  const needsCurrencyHeal = currentCurrency?.toUpperCase() === "XXX";
  let currencyHealed = false;

  try {
    const balanceResult = await trpc.banking.getBalance.query({
      provider,
      id: accountId,
      accessToken,
      accountType,
    });

    const balanceData = balanceResult.data as {
      amount: number;
      currency: string;
      available_balance?: number | null;
      credit_limit?: number | null;
    } | null;

    const balance = balanceData?.amount ?? null;
    const balanceCurrencyValid =
      balanceData?.currency && balanceData.currency.toUpperCase() !== "XXX";

    if (balance !== null) {
      const updatePayload: Parameters<typeof updateAccount>[0] = {
        balance,
        availableBalance: balanceData?.available_balance ?? null,
        creditLimit: balanceData?.credit_limit ?? null,
        errorDetails: null,
        errorRetries: null,
      };

      if (needsCurrencyHeal && balanceCurrencyValid) {
        updatePayload.currency = balanceData.currency;
        currencyHealed = true;
        logger.info("Healing account currency from balance", {
          accountId,
          from: currentCurrency,
          to: balanceData.currency,
        });
      }

      await updateAccount(updatePayload);
    } else {
      await updateAccount({
        errorDetails: null,
        errorRetries: null,
      });
    }
  } catch (error) {
    const parsedError = parseAPIError(error);

    logger.error("Failed to sync account balance", { error: parsedError });

    if (parsedError.code === "disconnected") {
      const retries = errorRetries ? errorRetries + 1 : 1;

      await updateAccount({
        errorDetails: parsedError.message,
        errorRetries: retries,
      });

      throw error;
    }
  }

  const upsertedTransactionIds: string[] = [];

  try {
    const transactionsResult = await trpc.banking.getProviderTransactions.query(
      {
        provider,
        accountId,
        accountType: classification,
        accessToken,
        latest: !manualSync,
      },
    );

    await updateAccount({
      errorDetails: null,
      errorRetries: null,
    });

    const transactionsData = transactionsResult.data;

    if (!transactionsData) {
      logger.info("No transactions to upsert for bank account", {
        accountId,
        teamId,
      });
      return {
        accountId,
        bankAccountId: id,
        upsertedCount: 0,
        transactionIds: upsertedTransactionIds,
      };
    }

    const mappedTransactions = transactionsData.map((transaction) => ({
      ...transaction,
      merchant_name: transaction.merchant_name ?? null,
    }));

    if (needsCurrencyHeal && !currencyHealed && mappedTransactions.length > 0) {
      const transactionCurrency = mappedTransactions.find(
        (transaction) =>
          transaction.currency && transaction.currency.toUpperCase() !== "XXX",
      )?.currency;

      if (transactionCurrency) {
        await updateAccount({ currency: transactionCurrency });

        logger.info("Healing account currency from transaction", {
          accountId,
          from: currentCurrency,
          to: transactionCurrency,
        });
      }
    }

    await processBatch(mappedTransactions, BATCH_SIZE, async (batch) => {
      const upsertedTransactions = await upsertTransactionsQuery(db, {
        transactions: batch.map((transaction) =>
          toUpsertTransaction({
            transaction,
            teamId,
            bankAccountId: id,
            manualSync,
          }),
        ),
        teamId,
      });

      const batchTransactionIds = upsertedTransactions
        .map((transaction) => transaction.id)
        .filter(Boolean);

      if (batchTransactionIds.length > 0) {
        upsertedTransactionIds.push(...batchTransactionIds);

        await enqueue(
          "enrich-transactions",
          {
            transactionIds: batchTransactionIds,
            teamId,
          },
          "transactions",
        );

        await enqueue(
          "match-transactions-bidirectional",
          {
            teamId,
            newTransactionIds: batchTransactionIds,
          },
          "inbox",
        );
      }

      return upsertedTransactions;
    });

    return {
      accountId,
      bankAccountId: id,
      upsertedCount: upsertedTransactionIds.length,
      transactionIds: upsertedTransactionIds,
    };
  } catch (error) {
    logger.error("Failed to sync account transactions", {
      accountId,
      teamId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
