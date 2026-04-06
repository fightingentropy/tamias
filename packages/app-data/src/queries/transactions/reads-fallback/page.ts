import { type TransactionStatus } from "@tamias/app-data-convex";
import type { Database } from "../../../client";
import { getAccountingSyncStatus } from "../../accounting-sync";
import { getPendingSuggestionTransactionIdsForTransactions } from "../shared";
import {
  buildProcessedTransactionLookups,
  buildProcessedTransactions,
  loadTransactionPageDecorations,
} from "../reads-process";
import {
  buildEmptyProcessedTransactionPage,
  buildTransactionsPageMeta,
  type GetTransactionsParams,
} from "../reads-shared";
import { buildAssigneeSortIndex, filterAndSortFallbackTransactions } from "./postfilter";
import {
  applyFallbackPrefilters,
  buildFallbackFilterState,
  loadFallbackPageContext,
} from "./prefilter";

export async function getFallbackTransactionsPage(
  db: Database,
  params: GetTransactionsParams & {
    pageSize: number;
  },
  convexStatusesNotIn: TransactionStatus[],
) {
  const { teamId, cursor, pageSize } = params;
  const { teamMembers, categoryContext, bankAccounts, allTransactions, taggedTransactionIdSet } =
    await loadFallbackPageContext({
      db,
      params,
      convexStatusesNotIn,
    });
  const filterState = buildFallbackFilterState({
    params,
    categoryContext,
    teamMembers,
  });
  const prefilteredTransactions = applyFallbackPrefilters({
    transactions: allTransactions,
    params,
    filterState,
  });

  if (prefilteredTransactions.length === 0) {
    return buildEmptyProcessedTransactionPage({
      hasPreviousPage: false,
    });
  }

  const candidateTransactionIds = prefilteredTransactions.map((transaction) => transaction.id);
  const [accountingSyncRecords, pendingSuggestionIds] = await Promise.all([
    getAccountingSyncStatus(db, {
      teamId,
      transactionIds: candidateTransactionIds,
    }),
    getPendingSuggestionTransactionIdsForTransactions(db, {
      teamId,
      transactionIds: candidateTransactionIds,
    }),
  ]);
  const baseLookups = buildProcessedTransactionLookups({
    transactions: prefilteredTransactions,
    teamMembers,
    accountingSyncRecords,
    categoryContext,
    bankAccounts,
    pendingSuggestionIds,
    transactionAttachments: [],
    transactionTagAssignments: [],
  });
  const assigneeSortIndexById = buildAssigneeSortIndex(baseLookups.assignedUserById);
  const filteredTransactions = filterAndSortFallbackTransactions({
    transactions: prefilteredTransactions,
    params,
    lookups: baseLookups,
    categoryContext,
    assigneeSortIndexById,
    taggedTransactionIdSet,
  });

  const offset = cursor ? Number.parseInt(cursor, 10) : 0;
  const fetchedData = filteredTransactions.slice(offset, offset + pageSize);
  const pageDecorations = await loadTransactionPageDecorations({
    teamId,
    transactionIds: fetchedData.map((row) => row.id),
  });
  const hasNextPage = offset + pageSize < filteredTransactions.length;
  const nextCursor = hasNextPage ? (offset + pageSize).toString() : undefined;

  return {
    meta: buildTransactionsPageMeta({
      cursor,
      nextCursor,
      hasNextPage,
    }),
    data: buildProcessedTransactions({
      transactions: fetchedData,
      lookups: {
        ...baseLookups,
        ...pageDecorations,
      },
    }),
  };
}
