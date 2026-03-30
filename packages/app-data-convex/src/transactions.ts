import { api, convexApi, createClient, serviceArgs } from "./base";

const apiWithTransactions = api as typeof api & {
  transactions: {
    serviceListTransactionsPage: any;
    serviceListTransactionsByBankAccountPage: any;
    serviceListTaggedTransactionsPage: any;
  };
};

export type TransactionMethod =
  | "payment"
  | "card_purchase"
  | "card_atm"
  | "transfer"
  | "other"
  | "unknown"
  | "ach"
  | "interest"
  | "deposit"
  | "wire"
  | "fee";

export type TransactionStatus =
  | "posted"
  | "pending"
  | "excluded"
  | "completed"
  | "archived"
  | "exported";

export type TransactionFrequency =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "semi_monthly"
  | "annually"
  | "irregular"
  | "unknown";

export type TransactionRecord = {
  id: string;
  teamId: string;
  createdAt: string;
  updatedAt: string;
  date: string;
  name: string;
  method: TransactionMethod;
  amount: number;
  currency: string;
  assignedId: string | null;
  note: string | null;
  bankAccountId: string | null;
  internalId: string;
  status: TransactionStatus;
  balance: number | null;
  manual: boolean;
  notified: boolean;
  internal: boolean;
  description: string | null;
  categorySlug: string | null;
  baseAmount: number | null;
  counterpartyName: string | null;
  baseCurrency: string | null;
  taxAmount: number | null;
  taxRate: number | null;
  taxType: string | null;
  recurring: boolean;
  frequency: TransactionFrequency | null;
  merchantName: string | null;
  enrichmentCompleted: boolean;
};

export type TransactionMetricAggregateRowRecord = {
  scope: "base" | "native";
  date: string;
  currency: string;
  direction: "income" | "expense";
  categorySlug: string | null;
  recurring: boolean;
  totalAmount: number;
  totalNetAmount: number | null;
  transactionCount: number;
  updatedAt: string;
};

export type TransactionRecurringAggregateRowRecord = {
  scope: "base" | "native";
  direction: "income" | "expense";
  currency: string;
  date: string;
  name: string;
  frequency: TransactionFrequency | null;
  categorySlug: string | null;
  totalAmount: number;
  transactionCount: number;
  latestAmount: number;
  latestTransactionCreatedAt: string;
  updatedAt: string;
};

export type TransactionTaxAggregateRowRecord = {
  scope: "base" | "native";
  date: string;
  currency: string;
  direction: "income" | "expense";
  categorySlug: string | null;
  taxType: string | null;
  taxRate: number;
  totalTaxAmount: number;
  totalTransactionAmount: number;
  transactionCount: number;
  updatedAt: string;
};

export type UpsertTransactionInConvexInput = {
  id: string;
  createdAt: string;
  date: string;
  name: string;
  method: TransactionMethod;
  amount: number;
  currency: string;
  assignedId?: string | null;
  note?: string | null;
  bankAccountId?: string | null;
  internalId: string;
  status: TransactionStatus;
  balance?: number | null;
  manual: boolean;
  notified?: boolean | null;
  internal?: boolean | null;
  description?: string | null;
  categorySlug?: string | null;
  baseAmount?: number | null;
  counterpartyName?: string | null;
  baseCurrency?: string | null;
  taxAmount?: number | null;
  taxRate?: number | null;
  taxType?: string | null;
  recurring?: boolean | null;
  frequency?: TransactionFrequency | null;
  merchantName?: string | null;
  enrichmentCompleted?: boolean | null;
};

export async function upsertTransactionsInConvex(args: {
  teamId: string;
  transactions: UpsertTransactionInConvexInput[];
}) {
  return createClient().mutation(
    convexApi.transactions.serviceUpsertTransactions,
    serviceArgs({
      publicTeamId: args.teamId,
      transactions: args.transactions,
    }),
  ) as Promise<TransactionRecord[]>;
}

export async function deleteTransactionsInConvex(args: {
  teamId: string;
  transactionIds: string[];
}) {
  return createClient().mutation(
    convexApi.transactions.serviceDeleteTransactions,
    serviceArgs({
      publicTeamId: args.teamId,
      transactionIds: args.transactionIds,
    }),
  ) as Promise<string[]>;
}

export async function getTransactionByIdFromConvex(args: {
  teamId: string;
  transactionId: string;
}) {
  return createClient().query(
    convexApi.transactions.serviceGetTransactionById,
    serviceArgs({
      publicTeamId: args.teamId,
      transactionId: args.transactionId,
    }),
  ) as Promise<TransactionRecord | null>;
}

export async function getTransactionInfoFromConvex(args: {
  transactionId: string;
}) {
  return createClient().query(
    convexApi.transactions.serviceGetTransactionInfo,
    serviceArgs({
      transactionId: args.transactionId,
    }),
  ) as Promise<TransactionRecord | null>;
}

export async function getTransactionsByIdsFromConvex(args: {
  teamId: string;
  transactionIds: string[];
}) {
  return createClient().query(
    convexApi.transactions.serviceGetTransactionsByIds,
    serviceArgs({
      publicTeamId: args.teamId,
      transactionIds: args.transactionIds,
    }),
  ) as Promise<TransactionRecord[]>;
}

export async function searchTransactionsFromConvex(args: {
  teamId: string;
  query: string;
  dateGte?: string | null;
  dateLte?: string | null;
  statusesNotIn?: TransactionStatus[];
  limit?: number;
}) {
  return createClient().query(
    convexApi.transactions.serviceSearchTransactions,
    serviceArgs({
      publicTeamId: args.teamId,
      query: args.query,
      dateGte: args.dateGte,
      dateLte: args.dateLte,
      statusesNotIn: args.statusesNotIn,
      limit: args.limit,
    }),
  ) as Promise<TransactionRecord[]>;
}

export async function getTransactionsByAmountRangeFromConvex(args: {
  teamId: string;
  minAmount: number;
  maxAmount: number;
  dateGte?: string | null;
  dateLte?: string | null;
  statusesNotIn?: TransactionStatus[];
  limit?: number;
}) {
  return createClient().query(
    convexApi.transactions.serviceGetTransactionsByAmountRange,
    serviceArgs({
      publicTeamId: args.teamId,
      minAmount: args.minAmount,
      maxAmount: args.maxAmount,
      dateGte: args.dateGte,
      dateLte: args.dateLte,
      statusesNotIn: args.statusesNotIn,
      limit: args.limit,
    }),
  ) as Promise<TransactionRecord[]>;
}

async function getTransactionsByBankAccountPageFromConvex(args: {
  teamId: string;
  bankAccountId: string;
  cursor?: string | null;
  pageSize: number;
  order?: "asc" | "desc";
  dateGte?: string | null;
  dateLte?: string | null;
  statusesNotIn?: TransactionStatus[];
}) {
  return createClient().query(
    apiWithTransactions.transactions.serviceListTransactionsByBankAccountPage,
    serviceArgs({
      publicTeamId: args.teamId,
      bankAccountId: args.bankAccountId,
      dateGte: args.dateGte,
      dateLte: args.dateLte,
      statusesNotIn: args.statusesNotIn,
      order: args.order,
      paginationOpts: {
        numItems: args.pageSize,
        cursor: args.cursor ?? null,
      },
    }),
  ) as Promise<{
    page: TransactionRecord[];
    isDone: boolean;
    continueCursor: string;
  }>;
}

export async function getTransactionsFromConvex(args: {
  teamId: string;
  transactionIds?: string[];
  bankAccountId?: string | null;
  dateGte?: string | null;
  dateLte?: string | null;
  statusesNotIn?: TransactionStatus[];
  limit?: number;
}) {
  if (args.transactionIds && args.transactionIds.length > 0) {
    return getTransactionsByIdsFromConvex({
      teamId: args.teamId,
      transactionIds: args.transactionIds,
    });
  }

  const pageSize = Math.max(1, Math.min(args.limit ?? 200, 200));
  const transactions: TransactionRecord[] = [];
  let cursor: string | null = null;
  let result: {
    page: TransactionRecord[];
    isDone: boolean;
    continueCursor: string;
  };

  while (true) {
    result = args.bankAccountId
      ? await getTransactionsByBankAccountPageFromConvex({
          teamId: args.teamId,
          bankAccountId: args.bankAccountId,
          cursor,
          pageSize,
          order: "desc",
          dateGte: args.dateGte,
          dateLte: args.dateLte,
          statusesNotIn: args.statusesNotIn,
        })
      : await getTransactionsPageFromConvex({
          teamId: args.teamId,
          cursor,
          pageSize,
          order: "desc",
          dateGte: args.dateGte,
          dateLte: args.dateLte,
          statusesNotIn: args.statusesNotIn,
        });

    transactions.push(...result.page);

    if (result.isDone || transactions.length >= (args.limit ?? Infinity)) {
      return args.limit ? transactions.slice(0, args.limit) : transactions;
    }

    cursor = result.continueCursor;
  }
}

export async function getTransactionsPageFromConvex(args: {
  teamId: string;
  cursor?: string | null;
  pageSize: number;
  order?: "asc" | "desc";
  dateGte?: string | null;
  dateLte?: string | null;
  statusesNotIn?: TransactionStatus[];
}) {
  return createClient().query(
    apiWithTransactions.transactions.serviceListTransactionsPage,
    serviceArgs({
      publicTeamId: args.teamId,
      dateGte: args.dateGte,
      dateLte: args.dateLte,
      statusesNotIn: args.statusesNotIn,
      order: args.order,
      paginationOpts: {
        numItems: args.pageSize,
        cursor: args.cursor ?? null,
      },
    }),
  ) as Promise<{
    page: TransactionRecord[];
    isDone: boolean;
    continueCursor: string;
  }>;
}

export async function getTaggedTransactionsPageFromConvex(args: {
  teamId: string;
  tagIds: string[];
  cursor?: string | null;
  pageSize: number;
  order?: "asc" | "desc";
  dateGte?: string | null;
  dateLte?: string | null;
  statusesNotIn?: TransactionStatus[];
}) {
  return createClient().query(
    apiWithTransactions.transactions.serviceListTaggedTransactionsPage,
    serviceArgs({
      publicTeamId: args.teamId,
      tagIds: args.tagIds,
      dateGte: args.dateGte,
      dateLte: args.dateLte,
      statusesNotIn: args.statusesNotIn,
      order: args.order,
      cursor: args.cursor ?? null,
      pageSize: args.pageSize,
    }),
  ) as Promise<{
    page: TransactionRecord[];
    isDone: boolean;
    continueCursor: string | null;
  }>;
}

export async function getTransactionsByInternalIdsFromConvex(args: {
  teamId: string;
  internalIds: string[];
}) {
  return createClient().query(
    convexApi.transactions.serviceGetTransactionsByInternalIds,
    serviceArgs({
      publicTeamId: args.teamId,
      internalIds: args.internalIds,
    }),
  ) as Promise<TransactionRecord[]>;
}

export async function getUnnotifiedTransactionsFromConvex(args: {
  teamId: string;
}) {
  return createClient().query(
    convexApi.transactions.serviceListUnnotifiedTransactions,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<TransactionRecord[]>;
}

export async function getTaggedTransactionsFromConvex(args: {
  teamId: string;
  tagIds: string[];
  order?: "asc" | "desc";
  dateGte?: string | null;
  dateLte?: string | null;
  statusesNotIn?: TransactionStatus[];
}) {
  const transactions: TransactionRecord[] = [];
  let cursor: string | null = null;

  while (true) {
    const result = await getTaggedTransactionsPageFromConvex({
      teamId: args.teamId,
      tagIds: args.tagIds,
      cursor,
      pageSize: 200,
      order: args.order ?? "desc",
      dateGte: args.dateGte,
      dateLte: args.dateLte,
      statusesNotIn: args.statusesNotIn,
    });

    transactions.push(...result.page);

    if (result.isDone) {
      return transactions;
    }

    cursor = result.continueCursor;
  }
}

export async function getTransactionMetricAggregateRowsFromConvex(args: {
  teamId: string;
  scope: "base" | "native";
  currency: string;
  dateFrom?: string | null;
  dateTo?: string | null;
}) {
  return createClient().query(
    convexApi.transactions.serviceGetTransactionMetricAggregateRows,
    serviceArgs({
      publicTeamId: args.teamId,
      scope: args.scope,
      currency: args.currency,
      dateFrom: args.dateFrom,
      dateTo: args.dateTo,
    }),
  ) as Promise<TransactionMetricAggregateRowRecord[]>;
}

export async function getTransactionRecurringAggregateRowsFromConvex(args: {
  teamId: string;
  scope: "base" | "native";
  direction: "income" | "expense";
  currency: string;
  dateFrom?: string | null;
  dateTo?: string | null;
}) {
  return createClient().query(
    convexApi.transactions.serviceGetTransactionRecurringAggregateRows,
    serviceArgs({
      publicTeamId: args.teamId,
      scope: args.scope,
      direction: args.direction,
      currency: args.currency,
      dateFrom: args.dateFrom,
      dateTo: args.dateTo,
    }),
  ) as Promise<TransactionRecurringAggregateRowRecord[]>;
}

export async function getTransactionTaxAggregateRowsFromConvex(args: {
  teamId: string;
  scope: "base" | "native";
  direction: "income" | "expense";
  currency: string;
  dateFrom?: string | null;
  dateTo?: string | null;
}) {
  return createClient().query(
    convexApi.transactions.serviceGetTransactionTaxAggregateRows,
    serviceArgs({
      publicTeamId: args.teamId,
      scope: args.scope,
      direction: args.direction,
      currency: args.currency,
      dateFrom: args.dateFrom,
      dateTo: args.dateTo,
    }),
  ) as Promise<TransactionTaxAggregateRowRecord[]>;
}

export async function rebuildTransactionReportAggregatesInConvex(args: {
  teamId?: string | null;
}) {
  return createClient().mutation(
    convexApi.transactions.serviceRebuildTransactionReportAggregates,
    serviceArgs({
      publicTeamId: args.teamId ?? null,
    }),
  ) as Promise<
    Array<{
      teamId: string;
      transactionCount: number;
      transactionMetricAggregateRows: number;
      transactionRecurringAggregateRows: number;
      transactionTaxAggregateRows: number;
    }>
  >;
}

export async function countTransactionsFromConvex(args: {
  teamId: string;
  bankAccountId?: string | null;
  dateGte?: string | null;
  dateLte?: string | null;
  statusesNotIn?: TransactionStatus[];
}) {
  return createClient().query(
    convexApi.transactions.serviceCountTransactions,
    serviceArgs({
      publicTeamId: args.teamId,
      bankAccountId: args.bankAccountId,
      dateGte: args.dateGte,
      dateLte: args.dateLte,
      statusesNotIn: args.statusesNotIn,
    }),
  ) as Promise<number>;
}
