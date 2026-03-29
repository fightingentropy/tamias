import type { Database } from "@tamias/app-data/client";
import {
  type GetCategoriesParams,
  getCategories,
} from "@tamias/app-data/queries/transaction-categories";
import {
  getTransactionsReadyForExportCount,
  getTransactions,
  type GetTransactionsParams,
} from "@tamias/app-data/queries/transactions";

export async function getTransactionCategoriesForTeam(args: {
  db: Database;
  teamId: string;
  input?: Omit<GetCategoriesParams, "teamId">;
}) {
  return getCategories(args.db, {
    teamId: args.teamId,
    ...args.input,
  });
}

export async function getTransactionsPage(args: {
  db: Database;
  teamId: string;
  input?: Omit<GetTransactionsParams, "teamId">;
}) {
  return getTransactions(args.db, {
    teamId: args.teamId,
    ...args.input,
    exported: args.input?.exported ?? undefined,
    fulfilled: args.input?.fulfilled ?? undefined,
  });
}

export async function getTransactionsReviewCount(args: {
  db: Database;
  teamId: string;
}) {
  return getTransactionsReadyForExportCount(args.db, args.teamId);
}
