import type {
  BankAccountRecord,
  TransactionRecord,
} from "@tamias/app-data-convex";
import { getTransactionCategoryContext } from "../../transaction-categories";
import type { TransactionDerivedState } from "./types";

export function getTransactionDerivedState(
  transaction: TransactionRecord,
  lookups: {
    pendingSuggestionIds: Set<string>;
    syncedTransactionIds: Set<string>;
    errorTransactionIds: Set<string>;
  },
): TransactionDerivedState {
  const isFulfilled =
    transaction.hasAttachment || transaction.status === "completed";
  const isExported =
    transaction.status === "exported" ||
    lookups.syncedTransactionIds.has(transaction.id);

  return {
    hasPendingSuggestion: lookups.pendingSuggestionIds.has(transaction.id),
    isFulfilled,
    isExported,
    hasExportError: lookups.errorTransactionIds.has(transaction.id),
  };
}

export function isActiveWorkflowStatus(status: TransactionRecord["status"]) {
  return status !== "excluded" && status !== "archived";
}

export function compareStrings(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  return (left ?? "").localeCompare(right ?? "");
}

export function compareNumbers(
  left: number | null | undefined,
  right: number | null | undefined,
) {
  return (left ?? 0) - (right ?? 0);
}

export function compareBooleans(left: boolean, right: boolean) {
  return Number(left) - Number(right);
}

export function compareTransactionsByDateDesc(
  left: Pick<TransactionRecord, "id" | "date">,
  right: Pick<TransactionRecord, "id" | "date">,
) {
  const dateComparison = right.date.localeCompare(left.date);

  if (dateComparison !== 0) {
    return dateComparison;
  }

  return right.id.localeCompare(left.id);
}

export function compareTransactionsForSort(
  left: TransactionRecord,
  right: TransactionRecord,
  args: {
    sort: string[] | null | undefined;
    derivedStateByTransactionId: Map<string, TransactionDerivedState>;
    assigneeSortIndexById: Map<string, number>;
    bankAccountsById: Map<string, BankAccountRecord>;
    categoryContext: Awaited<ReturnType<typeof getTransactionCategoryContext>>;
    taggedTransactionIds: Set<string>;
  },
) {
  if (!args.sort || args.sort.length !== 2) {
    return compareTransactionsByDateDesc(left, right);
  }

  const [column, direction] = args.sort;
  const multiplier = direction === "asc" ? 1 : -1;
  const leftDerived = args.derivedStateByTransactionId.get(left.id);
  const rightDerived = args.derivedStateByTransactionId.get(right.id);
  let comparison = 0;

  switch (column) {
    case "attachment":
      comparison = compareBooleans(
        leftDerived?.isFulfilled ?? false,
        rightDerived?.isFulfilled ?? false,
      );
      break;
    case "assigned":
      comparison = compareNumbers(
        args.assigneeSortIndexById.get(left.assignedId ?? "") ??
          args.assigneeSortIndexById.size,
        args.assigneeSortIndexById.get(right.assignedId ?? "") ??
          args.assigneeSortIndexById.size,
      );
      break;
    case "bank_account":
      comparison = compareStrings(
        args.bankAccountsById.get(left.bankAccountId ?? "")?.name,
        args.bankAccountsById.get(right.bankAccountId ?? "")?.name,
      );
      break;
    case "category":
      comparison = compareStrings(
        args.categoryContext.bySlug.get(left.categorySlug ?? "")?.name ??
          left.categorySlug,
        args.categoryContext.bySlug.get(right.categorySlug ?? "")?.name ??
          right.categorySlug,
      );
      break;
    case "tags":
      comparison = compareBooleans(
        args.taggedTransactionIds.has(left.id),
        args.taggedTransactionIds.has(right.id),
      );
      break;
    case "date":
      comparison = compareStrings(left.date, right.date);
      break;
    case "amount":
      comparison = compareNumbers(left.amount, right.amount);
      break;
    case "name":
      comparison = compareStrings(left.name, right.name);
      break;
    case "status":
      comparison = compareStrings(left.status, right.status);
      break;
    case "counterparty":
      comparison = compareStrings(
        left.counterpartyName,
        right.counterpartyName,
      );
      break;
    default:
      return compareTransactionsByDateDesc(left, right);
  }

  if (comparison !== 0) {
    return comparison * multiplier;
  }

  return compareStrings(left.id, right.id) * multiplier;
}
