import type { Database } from "../../client";
import { getFallbackTransactionsPage } from "./reads-fallback";
import {
  getIndexedReviewTransactionPage,
  getIndexedTaggedTransactionPage,
  getIndexedTransactionPage,
} from "./reads-indexed";
import {
  canUseIndexedReviewTransactionPage,
  canUseIndexedTaggedTransactionPage,
  canUseIndexedTransactionPage,
  getConvexStatusesNotIn,
  type GetTransactionsParams,
} from "./reads-shared";

export type { GetTransactionsParams } from "./reads-shared";
export {
  getTransactionById,
  getTransactionsByIds,
  getTransactionsByAccountId,
  getTransactionCountByBankAccountId,
  type GetTransactionByIdParams,
  type GetTransactionsByIdsParams,
  type GetTransactionsByAccountIdParams,
  type GetTransactionCountByBankAccountIdParams,
} from "./reads-records";

export async function getTransactions(
  db: Database,
  params: GetTransactionsParams,
) {
  const {
    teamId,
    sort,
    cursor,
    pageSize = 40,
    q,
    statuses,
    attachments,
    categories: filterCategories,
    tags: filterTags,
    type,
    accounts: filterAccounts,
    start,
    end,
    assignees: filterAssignees,
    recurring: filterRecurring,
    amount: filterAmount,
    amountRange: filterAmountRange,
    manual: filterManual,
    exported,
    fulfilled,
  } = params;
  const convexStatusesNotIn = getConvexStatusesNotIn({
    statuses,
    exported,
  });

  if (
    canUseIndexedReviewTransactionPage({
      sort,
      q,
      statuses,
      attachments,
      categories: filterCategories,
      tags: filterTags,
      accounts: filterAccounts,
      assignees: filterAssignees,
      type,
      start,
      end,
      recurring: filterRecurring,
      amountRange: filterAmountRange,
      amount: filterAmount,
      manual: filterManual,
      exported,
      fulfilled,
    })
  ) {
    return getIndexedReviewTransactionPage({
      db,
      teamId,
      cursor,
      pageSize,
      sort,
    });
  }

  if (
    canUseIndexedTaggedTransactionPage({
      sort,
      q,
      statuses,
      attachments,
      categories: filterCategories,
      tags: filterTags,
      accounts: filterAccounts,
      assignees: filterAssignees,
      type,
      recurring: filterRecurring,
      amountRange: filterAmountRange,
      amount: filterAmount,
      manual: filterManual,
      exported,
      fulfilled,
    })
  ) {
    return getIndexedTaggedTransactionPage({
      db,
      teamId,
      cursor,
      pageSize,
      sort,
      start,
      end,
      tags: filterTags,
      statusesNotIn: convexStatusesNotIn,
    });
  }

  if (
    canUseIndexedTransactionPage({
      sort,
      q,
      statuses,
      attachments,
      categories: filterCategories,
      tags: filterTags,
      accounts: filterAccounts,
      assignees: filterAssignees,
      type,
      end,
      recurring: filterRecurring,
      amountRange: filterAmountRange,
      amount: filterAmount,
      manual: filterManual,
      exported,
      fulfilled,
    })
  ) {
    return getIndexedTransactionPage({
      db,
      teamId,
      cursor,
      pageSize,
      sort,
      accounts: filterAccounts,
      start,
      end,
      statusesNotIn: convexStatusesNotIn,
    });
  }

  return getFallbackTransactionsPage(
    db,
    {
      ...params,
      pageSize,
    },
    convexStatusesNotIn,
  );
}
