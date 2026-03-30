import { convexApi, createClient, serviceArgs } from "./base";
import type { TransactionFrequency } from "./transaction-records";

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
