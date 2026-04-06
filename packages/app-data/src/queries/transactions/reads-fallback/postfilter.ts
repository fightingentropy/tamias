import type { TransactionRecord } from "@tamias/app-data-convex";
import {
  compareTransactionsForSort,
  isActiveWorkflowStatus,
} from "../shared";
import type { ProcessedTransactionLookups } from "../reads-process";
import type { GetTransactionsParams } from "../reads-shared";
import type { getTransactionCategoryContext } from "../../transaction-categories";

type CategoryContext = Awaited<ReturnType<typeof getTransactionCategoryContext>>;

export function buildAssigneeSortIndex(
  assignedUserById: ProcessedTransactionLookups["assignedUserById"],
) {
  return new Map(
    [...assignedUserById.values()]
      .sort((leftAssignee, rightAssignee) => {
        const nameCompare = (leftAssignee.fullName ?? "").localeCompare(
          rightAssignee.fullName ?? "",
        );

        if (nameCompare !== 0) {
          return nameCompare;
        }

        return leftAssignee.id.localeCompare(rightAssignee.id);
      })
      .map((assignee, index) => [assignee.id, index]),
  );
}

export function filterAndSortFallbackTransactions(args: {
  transactions: TransactionRecord[];
  params: GetTransactionsParams & { pageSize: number };
  lookups: ProcessedTransactionLookups;
  categoryContext: CategoryContext;
  assigneeSortIndexById: Map<string, number>;
  taggedTransactionIdSet: Set<string>;
}) {
  const {
    transactions,
    params: { attachments, statuses, exported, fulfilled, sort },
    lookups,
    categoryContext,
    assigneeSortIndexById,
    taggedTransactionIdSet,
  } = args;

  return transactions
    .filter((transaction) => {
      const derived = lookups.derivedStateByTransactionId.get(transaction.id)!;

      if (attachments === "include") {
        return derived.isFulfilled;
      }

      if (attachments === "exclude") {
        return !derived.isFulfilled;
      }

      return true;
    })
    .filter((transaction) => {
      const derived = lookups.derivedStateByTransactionId.get(transaction.id)!;

      if (!statuses || statuses.length === 0) {
        return isActiveWorkflowStatus(transaction.status);
      }

      return statuses.some((status) => {
        switch (status) {
          case "blank":
            return (
              isActiveWorkflowStatus(transaction.status) &&
              !derived.isFulfilled &&
              !derived.isExported &&
              !derived.hasExportError
            );
          case "receipt_match":
            return (
              isActiveWorkflowStatus(transaction.status) &&
              derived.hasPendingSuggestion &&
              !derived.isFulfilled &&
              !derived.isExported
            );
          case "in_review":
            return (
              isActiveWorkflowStatus(transaction.status) &&
              derived.isFulfilled &&
              !derived.isExported &&
              !derived.hasExportError
            );
          case "export_error":
            return (
              isActiveWorkflowStatus(transaction.status) &&
              derived.hasExportError &&
              !derived.isExported
            );
          case "exported":
            return derived.isExported;
          case "excluded":
            return transaction.status === "excluded";
          case "archived":
            return transaction.status === "archived";
          default:
            return false;
        }
      });
    })
    .filter((transaction) => {
      const derived = lookups.derivedStateByTransactionId.get(transaction.id)!;

      if (exported === true) {
        return derived.isExported;
      }

      if (exported === false) {
        return (
          transaction.status !== "exported" &&
          transaction.status !== "excluded" &&
          transaction.status !== "archived" &&
          !lookups.syncedTransactionIdSet.has(transaction.id)
        );
      }

      return true;
    })
    .filter((transaction) => {
      const derived = lookups.derivedStateByTransactionId.get(transaction.id)!;

      if (fulfilled === true) {
        return derived.isFulfilled;
      }

      if (fulfilled === false) {
        return !derived.isFulfilled;
      }

      return true;
    })
    .sort((left, right) =>
      compareTransactionsForSort(left, right, {
        sort,
        derivedStateByTransactionId: lookups.derivedStateByTransactionId,
        assigneeSortIndexById,
        bankAccountsById: lookups.bankAccountsById,
        categoryContext,
        taggedTransactionIds: taggedTransactionIdSet,
      }),
    );
}
