import { api, createClient, serviceArgs } from "./base";
import {
  getTransactionsByIdsFromConvex,
  type TransactionRecord,
  type TransactionStatus,
} from "./transaction-records";

const apiWithTransactions = api as typeof api & {
  transactions: {
    serviceListTransactionsPage: any;
    serviceListTransactionsByBankAccountPage: any;
    serviceListTaggedTransactionsPage: any;
  };
};

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

export async function countTransactionsFromConvex(args: {
  teamId: string;
  bankAccountId?: string | null;
  dateGte?: string | null;
  dateLte?: string | null;
  statusesNotIn?: TransactionStatus[];
}) {
  return createClient().query(
    api.transactions.serviceCountTransactions,
    serviceArgs({
      publicTeamId: args.teamId,
      bankAccountId: args.bankAccountId,
      dateGte: args.dateGte,
      dateLte: args.dateLte,
      statusesNotIn: args.statusesNotIn,
    }),
  ) as Promise<number>;
}
