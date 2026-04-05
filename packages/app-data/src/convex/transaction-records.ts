import { convexApi, createClient, serviceArgs } from "./base";

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
  hasAttachment: boolean;
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
  hasAttachment?: boolean | null;
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
