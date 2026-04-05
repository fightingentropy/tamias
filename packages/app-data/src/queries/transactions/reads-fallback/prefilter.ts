import {
  getBankAccountsFromConvex,
  getTaggedTransactionIdsFromConvex,
  getTaggedTransactionsFromConvex,
  getTeamMembersFromConvexIdentity,
  getTransactionsFromConvex,
  type TransactionStatus,
} from "../../../convex";
import {
  CONTRA_REVENUE_CATEGORIES,
  REVENUE_CATEGORIES,
} from "@tamias/categories";
import type { Database } from "../../../client";
import { getTransactionCategoryContext } from "../../transaction-categories";
import {
  expandTransactionCategories,
  getComparableTransactionAmount,
  matchesTransactionSearchQuery,
  type TransactionFrequency,
} from "../shared";
import type { GetTransactionsParams } from "../reads-shared";
import { normalizeAmountRange, parseAmountFilter } from "./amount-filters";

type CategoryContext = Awaited<ReturnType<typeof getTransactionCategoryContext>>;
type TeamMembers = Awaited<ReturnType<typeof getTeamMembersFromConvexIdentity>>;
type FallbackTransaction = Awaited<ReturnType<typeof getTransactionsFromConvex>>[number];

export async function loadFallbackPageContext(args: {
  db: Database;
  params: GetTransactionsParams & { pageSize: number };
  convexStatusesNotIn: TransactionStatus[];
}) {
  const {
    db,
    params: {
      teamId,
      sort,
      tags: filterTags,
      accounts: filterAccounts,
      start,
      end,
    },
    convexStatusesNotIn,
  } = args;
  const convexBankAccountId =
    filterAccounts && filterAccounts.length === 1 ? filterAccounts[0] : undefined;
  const [
    teamMembers,
    categoryContext,
    bankAccounts,
    allTransactions,
    taggedTransactionIdsForSort,
  ] = await Promise.all([
    getTeamMembersFromConvexIdentity({ teamId }),
    getTransactionCategoryContext(db, teamId),
    getBankAccountsFromConvex({ teamId }),
    filterTags && filterTags.length > 0
      ? getTaggedTransactionsFromConvex({
          teamId,
          tagIds: filterTags,
          dateGte: start ?? undefined,
          dateLte: end ?? undefined,
          statusesNotIn: convexStatusesNotIn,
        })
      : getTransactionsFromConvex({
          teamId,
          bankAccountId: convexBankAccountId,
          dateGte: start ?? undefined,
          dateLte: end ?? undefined,
          statusesNotIn: convexStatusesNotIn,
        }),
    sort?.[0] === "tags" && (!filterTags || filterTags.length === 0)
      ? getTaggedTransactionIdsFromConvex({ teamId })
      : [],
  ]);

  return {
    teamMembers,
    categoryContext,
    bankAccounts,
    allTransactions,
    taggedTransactionIdSet: new Set(taggedTransactionIdsForSort),
  };
}

export function buildFallbackFilterState(args: {
  params: GetTransactionsParams & { pageSize: number };
  categoryContext: CategoryContext;
  teamMembers: TeamMembers;
}) {
  const {
    params: {
      categories: filterCategories,
      recurring: filterRecurring,
      assignees: filterAssignees,
      amountRange: filterAmountRange,
      amount: filterAmount,
    },
    categoryContext,
    teamMembers,
  } = args;

  const expandedFilterCategories =
    filterCategories && filterCategories.length > 0
      ? expandTransactionCategories(
          categoryContext.bySlug,
          categoryContext.byId,
          filterCategories,
        )
      : null;
  const validRecurringFrequencies = filterRecurring?.filter(
    (frequency) => frequency !== "all",
  ) as TransactionFrequency[] | undefined;
  const teamMemberIds = new Set(teamMembers.map((member) => member.user.id));
  const validAssigneeIds =
    filterAssignees?.filter((assigneeId) => teamMemberIds.has(assigneeId)) ?? [];

  return {
    expandedFilterCategories,
    validRecurringFrequencies,
    validAssigneeIds,
    normalizedAmountRange: normalizeAmountRange(filterAmountRange),
    parsedAmountFilter: parseAmountFilter(filterAmount),
  };
}

export function applyFallbackPrefilters(args: {
  transactions: FallbackTransaction[];
  params: GetTransactionsParams & { pageSize: number };
  filterState: ReturnType<typeof buildFallbackFilterState>;
}) {
  const {
    transactions,
    params: {
      q,
      categories: filterCategories,
      recurring: filterRecurring,
      type,
      accounts: filterAccounts,
      assignees: filterAssignees,
      manual: filterManual,
      end,
    },
    filterState: {
      expandedFilterCategories,
      validRecurringFrequencies,
      validAssigneeIds,
      normalizedAmountRange,
      parsedAmountFilter,
    },
  } = args;

  return transactions
    .filter((transaction) => (end ? transaction.date <= end : true))
    .filter((transaction) =>
      q ? matchesTransactionSearchQuery(transaction, q) : true,
    )
    .filter((transaction) => {
      if (!filterCategories || filterCategories.length === 0 || !expandedFilterCategories) {
        return true;
      }

      if (
        filterCategories.includes("uncategorized") &&
        transaction.categorySlug === null
      ) {
        return true;
      }

      return transaction.categorySlug
        ? expandedFilterCategories.has(transaction.categorySlug)
        : false;
    })
    .filter((transaction) => {
      if (!filterRecurring || filterRecurring.length === 0) {
        return true;
      }

      if (filterRecurring.includes("all")) {
        return transaction.recurring;
      }

      return validRecurringFrequencies && validRecurringFrequencies.length > 0
        ? validRecurringFrequencies.includes(
            transaction.frequency as TransactionFrequency,
          )
        : true;
    })
    .filter((transaction) => {
      if (type === "expense") {
        return transaction.amount < 0 && transaction.categorySlug !== "transfer";
      }

      if (type === "income") {
        return (
          Boolean(transaction.categorySlug) &&
          REVENUE_CATEGORIES.includes(
            transaction.categorySlug as (typeof REVENUE_CATEGORIES)[number],
          ) &&
          !CONTRA_REVENUE_CATEGORIES.includes(
            transaction.categorySlug as (typeof CONTRA_REVENUE_CATEGORIES)[number],
          )
        );
      }

      return true;
    })
    .filter((transaction) =>
      filterAccounts && filterAccounts.length > 0
        ? filterAccounts.includes(transaction.bankAccountId ?? "")
        : true,
    )
    .filter((transaction) => {
      if (!filterAssignees || filterAssignees.length === 0) {
        return true;
      }

      if (validAssigneeIds.length === 0) {
        return false;
      }

      return validAssigneeIds.includes(transaction.assignedId ?? "");
    })
    .filter((transaction) => {
      if (!normalizedAmountRange) {
        return true;
      }

      const comparableAmount = getComparableTransactionAmount(transaction);

      if (type === "expense") {
        return (
          comparableAmount >= -normalizedAmountRange.max &&
          comparableAmount <= -normalizedAmountRange.min
        );
      }

      if (type === "income") {
        return (
          comparableAmount >= normalizedAmountRange.min &&
          comparableAmount <= normalizedAmountRange.max
        );
      }

      return (
        Math.abs(comparableAmount) >= normalizedAmountRange.min &&
        Math.abs(comparableAmount) <= normalizedAmountRange.max
      );
    })
    .filter((transaction) => {
      if (!parsedAmountFilter) {
        return true;
      }

      if (parsedAmountFilter.operator === "gte") {
        return transaction.amount >= parsedAmountFilter.value;
      }

      return transaction.amount <= parsedAmountFilter.value;
    })
    .filter((transaction) => {
      if (filterManual === "include") {
        return transaction.manual;
      }

      if (filterManual === "exclude") {
        return !transaction.manual;
      }

      return true;
    });
}
