import {
  countTransactionsFromConvex,
  getBankAccountsFromConvex,
  getTaggedTransactionIdsFromConvex,
  getTaggedTransactionsFromConvex,
  getTaggedTransactionsPageFromConvex,
  getTeamMembersFromConvexIdentity,
  getTransactionAttachmentsForTransactionIdsFromConvex,
  getTransactionIdsWithAttachmentsFromConvex,
  getTransactionsByIdsFromConvex,
  getTransactionsFromConvex,
  getTransactionsPageFromConvex,
  getTransactionTagAssignmentsForTransactionIdsFromConvex,
  type TransactionRecord,
  type TransactionStatus,
} from "@tamias/app-data-convex";
import {
  CONTRA_REVENUE_CATEGORIES,
  REVENUE_CATEGORIES,
} from "@tamias/categories";
import { resolveTaxValues } from "@tamias/utils/tax";
import type { Database } from "../../client";
import { getAccountingSyncStatus } from "../accounting-sync";
import { getTransactionCategoryContext } from "../transaction-categories";
import {
  buildAccountingSyncLookups,
  buildAssignedTransactionUser,
  buildAssignedUserLookup,
  buildTransactionAttachmentLookups,
  buildTransactionCategorySummary,
  buildTransactionTagLookups,
  compareTransactionsForSort,
  expandTransactionCategories,
  getComparableTransactionAmount,
  getFullTransactionData,
  getPendingSuggestionTransactionIdsForTransactions,
  getTransactionDerivedState,
  isActiveWorkflowStatus,
  matchesTransactionSearchQuery,
  type TransactionFrequency,
} from "./shared";

export type GetTransactionsParams = {
  teamId: string;
  cursor?: string | null;
  sort?: string[] | null;
  pageSize?: number;
  q?: string | null;
  statuses?:
    | (
        | "blank"
        | "receipt_match"
        | "in_review"
        | "export_error"
        | "exported"
        | "excluded"
        | "archived"
      )[]
    | null;
  attachments?: "include" | "exclude" | null;
  categories?: string[] | null;
  tags?: string[] | null;
  accounts?: string[] | null;
  assignees?: string[] | null;
  type?: "income" | "expense" | null;
  start?: string | null;
  end?: string | null;
  recurring?: string[] | null;
  amountRange?: number[] | null;
  amount?: string[] | null;
  manual?: "include" | "exclude" | null;
  exported?: boolean | null;
  fulfilled?: boolean | null;
};

type ReviewPageCursorState = {
  sourceCursor: string | null;
  sourceExhausted: boolean;
  bufferedIds: string[];
};

const REVIEW_PAGE_CURSOR_PREFIX = "review:";

function getConvexStatusesNotIn(args: {
  statuses?: GetTransactionsParams["statuses"];
  exported?: boolean | null;
}): TransactionStatus[] {
  const requestedStatuses = new Set(args.statuses ?? []);
  const statusesNotIn: TransactionStatus[] = [];

  if (!requestedStatuses.has("excluded")) {
    statusesNotIn.push("excluded");
  }

  if (!requestedStatuses.has("archived")) {
    statusesNotIn.push("archived");
  }

  if (args.exported !== true && !requestedStatuses.has("exported")) {
    statusesNotIn.push("exported");
  }

  return statusesNotIn;
}

function getIndexedPageOrder(sort: GetTransactionsParams["sort"]) {
  if (!sort || sort.length === 0) {
    return "desc" as const;
  }

  if (sort.length !== 2) {
    return null;
  }

  const [column, direction] = sort;

  if (column !== "date" || (direction !== "asc" && direction !== "desc")) {
    return null;
  }

  return direction;
}

function decodeReviewPageCursor(
  cursor: string | null | undefined,
): ReviewPageCursorState {
  if (!cursor?.startsWith(REVIEW_PAGE_CURSOR_PREFIX)) {
    return {
      sourceCursor: null,
      sourceExhausted: false,
      bufferedIds: [],
    };
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(
        cursor.slice(REVIEW_PAGE_CURSOR_PREFIX.length),
        "base64url",
      ).toString("utf8"),
    ) as Partial<ReviewPageCursorState>;

    return {
      sourceCursor:
        typeof parsed.sourceCursor === "string" ? parsed.sourceCursor : null,
      sourceExhausted: parsed.sourceExhausted === true,
      bufferedIds: Array.isArray(parsed.bufferedIds)
        ? parsed.bufferedIds.filter(
            (bufferedId): bufferedId is string =>
              typeof bufferedId === "string",
          )
        : [],
    };
  } catch {
    return {
      sourceCursor: null,
      sourceExhausted: false,
      bufferedIds: [],
    };
  }
}

function encodeReviewPageCursor(state: ReviewPageCursorState) {
  return `${REVIEW_PAGE_CURSOR_PREFIX}${Buffer.from(
    JSON.stringify(state),
    "utf8",
  ).toString("base64url")}`;
}

function canUseIndexedTransactionPage(args: {
  sort: GetTransactionsParams["sort"];
  q: GetTransactionsParams["q"];
  statuses: GetTransactionsParams["statuses"];
  attachments: GetTransactionsParams["attachments"];
  categories: GetTransactionsParams["categories"];
  tags: GetTransactionsParams["tags"];
  accounts: GetTransactionsParams["accounts"];
  assignees: GetTransactionsParams["assignees"];
  type: GetTransactionsParams["type"];
  end: GetTransactionsParams["end"];
  recurring: GetTransactionsParams["recurring"];
  amountRange: GetTransactionsParams["amountRange"];
  amount: GetTransactionsParams["amount"];
  manual: GetTransactionsParams["manual"];
  exported: GetTransactionsParams["exported"];
  fulfilled: GetTransactionsParams["fulfilled"];
}) {
  return (
    getIndexedPageOrder(args.sort) !== null &&
    !args.q &&
    !args.statuses?.length &&
    !args.attachments &&
    !args.categories?.length &&
    !args.tags?.length &&
    !args.accounts?.length &&
    !args.assignees?.length &&
    !args.type &&
    !args.end &&
    !args.recurring?.length &&
    !args.amountRange?.length &&
    !args.amount?.length &&
    !args.manual &&
    args.exported !== true &&
    args.fulfilled == null
  );
}

function canUseIndexedTaggedTransactionPage(args: {
  sort: GetTransactionsParams["sort"];
  q: GetTransactionsParams["q"];
  statuses: GetTransactionsParams["statuses"];
  attachments: GetTransactionsParams["attachments"];
  categories: GetTransactionsParams["categories"];
  tags: GetTransactionsParams["tags"];
  accounts: GetTransactionsParams["accounts"];
  assignees: GetTransactionsParams["assignees"];
  type: GetTransactionsParams["type"];
  recurring: GetTransactionsParams["recurring"];
  amountRange: GetTransactionsParams["amountRange"];
  amount: GetTransactionsParams["amount"];
  manual: GetTransactionsParams["manual"];
  exported: GetTransactionsParams["exported"];
  fulfilled: GetTransactionsParams["fulfilled"];
}) {
  return (
    getIndexedPageOrder(args.sort) !== null &&
    !args.q &&
    !args.statuses?.length &&
    !args.attachments &&
    !args.categories?.length &&
    Boolean(args.tags?.length) &&
    !args.accounts?.length &&
    !args.assignees?.length &&
    !args.type &&
    !args.recurring?.length &&
    !args.amountRange?.length &&
    !args.amount?.length &&
    !args.manual &&
    args.exported !== true &&
    args.fulfilled == null
  );
}

function canUseIndexedReviewTransactionPage(args: {
  sort: GetTransactionsParams["sort"];
  q: GetTransactionsParams["q"];
  statuses: GetTransactionsParams["statuses"];
  attachments: GetTransactionsParams["attachments"];
  categories: GetTransactionsParams["categories"];
  tags: GetTransactionsParams["tags"];
  accounts: GetTransactionsParams["accounts"];
  assignees: GetTransactionsParams["assignees"];
  type: GetTransactionsParams["type"];
  start: GetTransactionsParams["start"];
  end: GetTransactionsParams["end"];
  recurring: GetTransactionsParams["recurring"];
  amountRange: GetTransactionsParams["amountRange"];
  amount: GetTransactionsParams["amount"];
  manual: GetTransactionsParams["manual"];
  exported: GetTransactionsParams["exported"];
  fulfilled: GetTransactionsParams["fulfilled"];
}) {
  return (
    getIndexedPageOrder(args.sort) !== null &&
    !args.q &&
    !args.statuses?.length &&
    !args.attachments &&
    !args.categories?.length &&
    !args.tags?.length &&
    !args.accounts?.length &&
    !args.assignees?.length &&
    !args.type &&
    !args.start &&
    !args.end &&
    !args.recurring?.length &&
    !args.amountRange?.length &&
    !args.amount?.length &&
    !args.manual &&
    args.exported === false &&
    args.fulfilled === true
  );
}

function getIndexedReviewBatchSize(pageSize: number) {
  return Math.min(Math.max(pageSize * 2, 100), 250);
}

async function getTransactionsByIdsInOrder(args: {
  teamId: string;
  transactionIds: string[];
}) {
  if (args.transactionIds.length === 0) {
    return [];
  }

  const transactions = await getTransactionsByIdsFromConvex({
    teamId: args.teamId,
    transactionIds: args.transactionIds,
  });
  const transactionsById = new Map(
    transactions.map((transaction) => [transaction.id, transaction]),
  );

  return args.transactionIds.flatMap((transactionId) => {
    const transaction = transactionsById.get(transactionId);

    return transaction ? [transaction] : [];
  });
}

async function getTransactionsReadyForReviewFromCandidates(
  db: Database,
  args: {
    teamId: string;
    transactions: TransactionRecord[];
  },
) {
  if (args.transactions.length === 0) {
    return [];
  }

  const transactionIds = args.transactions.map((transaction) => transaction.id);
  const [accountingSyncRecords, attachmentTransactionIds] = await Promise.all([
    getAccountingSyncStatus(db, {
      teamId: args.teamId,
      transactionIds,
    }),
    getTransactionIdsWithAttachmentsFromConvex({
      teamId: args.teamId,
      transactionIds,
    }),
  ]);
  const syncedTransactionIds = new Set(
    accountingSyncRecords
      .filter((record) => record.status === "synced")
      .map((record) => record.transactionId),
  );
  const attachmentTransactionIdSet = new Set(attachmentTransactionIds);

  return args.transactions.filter(
    (transaction) =>
      transaction.status !== "excluded" &&
      transaction.status !== "archived" &&
      transaction.status !== "exported" &&
      !syncedTransactionIds.has(transaction.id) &&
      (transaction.status === "completed" ||
        attachmentTransactionIdSet.has(transaction.id)),
  );
}

async function buildProcessedTransactionPage(args: {
  db: Database;
  teamId: string;
  transactions: TransactionRecord[];
  cursor: string | null | undefined;
  nextCursor: string | null | undefined;
  hasNextPage: boolean;
}) {
  if (args.transactions.length === 0) {
    return {
      meta: {
        cursor: args.nextCursor ?? undefined,
        hasPreviousPage: Boolean(args.cursor),
        hasNextPage: args.hasNextPage,
      },
      data: [],
    };
  }

  const transactionIds = args.transactions.map((transaction) => transaction.id);
  const [
    teamMembers,
    accountingSyncRecords,
    categoryContext,
    bankAccounts,
    pendingSuggestionIds,
    transactionAttachments,
    transactionTagAssignments,
  ] = await Promise.all([
    getTeamMembersFromConvexIdentity({ teamId: args.teamId }),
    getAccountingSyncStatus(args.db, {
      teamId: args.teamId,
      transactionIds,
    }),
    getTransactionCategoryContext(args.db, args.teamId),
    getBankAccountsFromConvex({ teamId: args.teamId }),
    getPendingSuggestionTransactionIdsForTransactions(args.db, {
      teamId: args.teamId,
      transactionIds,
    }),
    getTransactionAttachmentsForTransactionIdsFromConvex({
      teamId: args.teamId,
      transactionIds,
    }),
    getTransactionTagAssignmentsForTransactionIdsFromConvex({
      teamId: args.teamId,
      transactionIds,
    }),
  ]);

  const assignedUserById = buildAssignedUserLookup(teamMembers);
  const bankAccountsById = new Map(
    bankAccounts.map((account) => [account.id, account]),
  );
  const {
    syncedByTransactionId,
    errorByTransactionId,
    syncedTransactionIds,
    errorTransactionIds,
  } = buildAccountingSyncLookups(accountingSyncRecords);
  const { attachmentsByTransactionId, transactionIdsWithAttachments } =
    buildTransactionAttachmentLookups(transactionAttachments);
  const { tagsByTransactionId } = buildTransactionTagLookups(
    transactionTagAssignments,
  );
  const syncedTransactionIdSet = new Set(syncedTransactionIds);
  const errorTransactionIdSet = new Set(errorTransactionIds);
  const derivedStateByTransactionId = new Map(
    args.transactions.map((transaction) => [
      transaction.id,
      getTransactionDerivedState(transaction, {
        pendingSuggestionIds,
        attachmentTransactionIds: transactionIdsWithAttachments,
        syncedTransactionIds: syncedTransactionIdSet,
        errorTransactionIds: errorTransactionIdSet,
      }),
    ]),
  );

  return {
    meta: {
      cursor: args.nextCursor ?? undefined,
      hasPreviousPage: Boolean(args.cursor),
      hasNextPage: args.hasNextPage,
    },
    data: args.transactions.map((transaction) => {
      const account = transaction.bankAccountId
        ? (bankAccountsById.get(transaction.bankAccountId) ?? null)
        : null;
      const syncedRecord = syncedByTransactionId.get(transaction.id);
      const errorRecord = errorByTransactionId.get(transaction.id);
      const currentAttachments =
        attachmentsByTransactionId.get(transaction.id) ?? [];
      const category = buildTransactionCategorySummary(
        categoryContext.bySlug.get(transaction.categorySlug ?? ""),
      );
      const newAccount = account
        ? {
            id: account.id,
            name: account.name,
            currency: account.currency,
            connection: account.bankConnection
              ? {
                  id: account.bankConnection.id,
                  name: account.bankConnection.name,
                  logoUrl: account.bankConnection.logoUrl,
                }
              : null,
          }
        : null;
      const { taxAmount, taxRate, taxType } = resolveTaxValues({
        transactionAmount: transaction.amount,
        transactionTaxAmount: transaction.taxAmount,
        transactionTaxRate: transaction.taxRate,
        transactionTaxType: transaction.taxType,
        categoryTaxRate: category?.taxRate,
        categoryTaxType: category?.taxType,
      });

      return {
        ...transaction,
        hasPendingSuggestion:
          derivedStateByTransactionId.get(transaction.id)
            ?.hasPendingSuggestion ?? false,
        attachments: currentAttachments.map((attachment) => ({
          id: attachment.id,
          filename: attachment.name,
          path: attachment.path,
          type: attachment.type,
          size: attachment.size,
        })),
        isFulfilled:
          transactionIdsWithAttachments.has(transaction.id) ||
          transaction.status === "completed",
        isExported: transaction.status === "exported" || Boolean(syncedRecord),
        exportProvider: syncedRecord?.provider ?? null,
        exportedAt: syncedRecord?.syncedAt ?? null,
        hasExportError: Boolean(errorRecord),
        exportErrorCode: errorRecord?.errorCode ?? null,
        account: newAccount,
        assigned: buildAssignedTransactionUser(
          transaction.assignedId
            ? assignedUserById.get(transaction.assignedId)
            : undefined,
        ),
        category,
        tags: tagsByTransactionId.get(transaction.id) ?? [],
        taxRate,
        taxType,
        taxAmount,
      };
    }),
  };
}

async function getIndexedReviewTransactionPage(args: {
  db: Database;
  teamId: string;
  cursor: string | null | undefined;
  pageSize: number;
  sort: GetTransactionsParams["sort"];
}) {
  const order = getIndexedPageOrder(args.sort) ?? "desc";
  const cursorState = decodeReviewPageCursor(args.cursor);
  let sourceCursor = cursorState.sourceCursor;
  let sourceExhausted = cursorState.sourceExhausted;
  let bufferedIds = [...cursorState.bufferedIds];
  const eligibleTransactions: TransactionRecord[] = [];

  while (
    eligibleTransactions.length <= args.pageSize &&
    bufferedIds.length > 0
  ) {
    const bufferedTransactions = await getTransactionsByIdsInOrder({
      teamId: args.teamId,
      transactionIds: bufferedIds.slice(
        0,
        args.pageSize + 1 - eligibleTransactions.length,
      ),
    });

    bufferedIds = bufferedIds.slice(
      args.pageSize + 1 - eligibleTransactions.length,
    );

    eligibleTransactions.push(
      ...(await getTransactionsReadyForReviewFromCandidates(args.db, {
        teamId: args.teamId,
        transactions: bufferedTransactions,
      })),
    );
  }

  while (eligibleTransactions.length <= args.pageSize && !sourceExhausted) {
    const candidatePage = await getTransactionsPageFromConvex({
      teamId: args.teamId,
      cursor: sourceCursor,
      pageSize: getIndexedReviewBatchSize(args.pageSize),
      order,
      statusesNotIn: ["excluded", "archived", "exported"],
    });

    eligibleTransactions.push(
      ...(await getTransactionsReadyForReviewFromCandidates(args.db, {
        teamId: args.teamId,
        transactions: candidatePage.page,
      })),
    );

    sourceCursor = candidatePage.isDone ? null : candidatePage.continueCursor;
    sourceExhausted = candidatePage.isDone;

    if (candidatePage.page.length === 0) {
      break;
    }
  }

  const transactions = eligibleTransactions.slice(0, args.pageSize);
  const nextBufferedIds = [
    ...eligibleTransactions
      .slice(args.pageSize)
      .map((transaction) => transaction.id),
    ...bufferedIds,
  ];
  const hasNextPage = nextBufferedIds.length > 0;
  const nextCursor = hasNextPage
    ? encodeReviewPageCursor({
        sourceCursor,
        sourceExhausted,
        bufferedIds: nextBufferedIds,
      })
    : undefined;

  return buildProcessedTransactionPage({
    db: args.db,
    teamId: args.teamId,
    transactions,
    cursor: args.cursor,
    nextCursor,
    hasNextPage,
  });
}

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
    const indexedPage = await getTaggedTransactionsPageFromConvex({
      teamId,
      tagIds: filterTags ?? [],
      cursor,
      pageSize,
      order: getIndexedPageOrder(sort) ?? undefined,
      dateGte: start ?? undefined,
      dateLte: end ?? undefined,
      statusesNotIn: convexStatusesNotIn,
    });

    return buildProcessedTransactionPage({
      db,
      teamId,
      transactions: indexedPage.page,
      cursor,
      nextCursor: indexedPage.isDone ? undefined : indexedPage.continueCursor,
      hasNextPage: !indexedPage.isDone,
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
    const indexedPage = await getTransactionsPageFromConvex({
      teamId,
      cursor,
      pageSize,
      order: getIndexedPageOrder(sort) ?? undefined,
      dateGte: start ?? undefined,
      statusesNotIn: convexStatusesNotIn,
    });

    return buildProcessedTransactionPage({
      db,
      teamId,
      transactions: indexedPage.page,
      cursor,
      nextCursor: indexedPage.isDone ? undefined : indexedPage.continueCursor,
      hasNextPage: !indexedPage.isDone,
    });
  }

  const convexBankAccountId =
    filterAccounts && filterAccounts.length === 1
      ? filterAccounts[0]
      : undefined;
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
  const assignedUserById = buildAssignedUserLookup(teamMembers);
  const orderedAssigneeIds = [...assignedUserById.values()]
    .sort((left, right) => {
      const nameCompare = (left.fullName ?? "").localeCompare(
        right.fullName ?? "",
      );

      if (nameCompare !== 0) {
        return nameCompare;
      }

      return left.id.localeCompare(right.id);
    })
    .map((member) => member.id);
  const assigneeSortIndexById = new Map(
    orderedAssigneeIds.map((assigneeId, index) => [assigneeId, index]),
  );
  const bankAccountsById = new Map(
    bankAccounts.map((account) => [account.id, account]),
  );
  const taggedTransactionIdSet = new Set(taggedTransactionIdsForSort);

  const prefilteredTransactions = allTransactions
    .filter((transaction) => (end ? transaction.date <= end : true))
    .filter((transaction) =>
      q ? matchesTransactionSearchQuery(transaction, q) : true,
    )
    .filter((transaction) => {
      if (!filterCategories || filterCategories.length === 0) {
        return true;
      }

      const expandedSlugs = expandTransactionCategories(
        categoryContext.bySlug,
        categoryContext.byId,
        filterCategories,
      );

      if (
        filterCategories.includes("uncategorized") &&
        transaction.categorySlug === null
      ) {
        return true;
      }

      return transaction.categorySlug
        ? expandedSlugs.has(transaction.categorySlug)
        : false;
    })
    .filter((transaction) => {
      if (!filterRecurring || filterRecurring.length === 0) {
        return true;
      }

      if (filterRecurring.includes("all")) {
        return transaction.recurring;
      }

      const validFrequencies = filterRecurring.filter(
        (frequency) => frequency !== "all",
      ) as TransactionFrequency[];

      return validFrequencies.length > 0
        ? validFrequencies.includes(
            transaction.frequency as TransactionFrequency,
          )
        : true;
    })
    .filter((transaction) => {
      if (type === "expense") {
        return (
          transaction.amount < 0 && transaction.categorySlug !== "transfer"
        );
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

      const validAssigneeIds = filterAssignees.filter((assigneeId) =>
        assignedUserById.has(assigneeId),
      );

      if (validAssigneeIds.length === 0) {
        return false;
      }

      return validAssigneeIds.includes(transaction.assignedId ?? "");
    })
    .filter((transaction) => {
      if (
        !filterAmountRange ||
        filterAmountRange.length !== 2 ||
        filterAmountRange[0] == null ||
        filterAmountRange[1] == null
      ) {
        return true;
      }

      let minAmount = Number(filterAmountRange[0]);
      let maxAmount = Number(filterAmountRange[1]);

      if (Number.isNaN(minAmount) || Number.isNaN(maxAmount)) {
        return true;
      }

      if (minAmount > maxAmount) {
        [minAmount, maxAmount] = [maxAmount, minAmount];
      }

      const comparableAmount = getComparableTransactionAmount(transaction);

      if (type === "expense") {
        return comparableAmount >= -maxAmount && comparableAmount <= -minAmount;
      }

      if (type === "income") {
        return comparableAmount >= minAmount && comparableAmount <= maxAmount;
      }

      return (
        Math.abs(comparableAmount) >= minAmount &&
        Math.abs(comparableAmount) <= maxAmount
      );
    })
    .filter((transaction) => {
      if (!filterAmount || filterAmount.length !== 2) {
        return true;
      }

      const [operator, value] = filterAmount;
      const parsedValue = Number(value);

      if (Number.isNaN(parsedValue)) {
        return true;
      }

      if (operator === "gte") {
        return transaction.amount >= parsedValue;
      }

      if (operator === "lte") {
        return transaction.amount <= parsedValue;
      }

      return true;
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

  if (prefilteredTransactions.length === 0) {
    return {
      meta: {
        cursor: undefined,
        hasPreviousPage: false,
        hasNextPage: false,
      },
      data: [],
    };
  }

  const candidateTransactionIds = prefilteredTransactions.map(
    (transaction) => transaction.id,
  );
  const [accountingSyncRecords, pendingSuggestionIds, attachmentTransactionIds] =
    await Promise.all([
      getAccountingSyncStatus(db, {
        teamId,
        transactionIds: candidateTransactionIds,
      }),
      getPendingSuggestionTransactionIdsForTransactions(db, {
        teamId,
        transactionIds: candidateTransactionIds,
      }),
      getTransactionIdsWithAttachmentsFromConvex({
        teamId,
        transactionIds: candidateTransactionIds,
      }),
    ]);

  const {
    syncedByTransactionId,
    errorByTransactionId,
    syncedTransactionIds,
    errorTransactionIds,
  } = buildAccountingSyncLookups(accountingSyncRecords);
  const syncedTransactionIdSet = new Set(syncedTransactionIds);
  const errorTransactionIdSet = new Set(errorTransactionIds);
  const attachmentTransactionIdSet = new Set(attachmentTransactionIds);

  const derivedStateByTransactionId = new Map(
    prefilteredTransactions.map((transaction) => [
      transaction.id,
      getTransactionDerivedState(transaction, {
        pendingSuggestionIds,
        attachmentTransactionIds: attachmentTransactionIdSet,
        syncedTransactionIds: syncedTransactionIdSet,
        errorTransactionIds: errorTransactionIdSet,
      }),
    ]),
  );

  const filteredTransactions = prefilteredTransactions
    .filter((transaction) => {
      const derived = derivedStateByTransactionId.get(transaction.id)!;

      if (attachments === "include") {
        return derived.isFulfilled;
      }

      if (attachments === "exclude") {
        return !derived.isFulfilled;
      }

      return true;
    })
    .filter((transaction) => {
      const derived = derivedStateByTransactionId.get(transaction.id)!;

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
      const derived = derivedStateByTransactionId.get(transaction.id)!;

      if (exported === true) {
        return derived.isExported;
      }

      if (exported === false) {
        return (
          transaction.status !== "exported" &&
          transaction.status !== "excluded" &&
          transaction.status !== "archived" &&
          !syncedTransactionIdSet.has(transaction.id)
        );
      }

      return true;
    })
    .filter((transaction) => {
      const derived = derivedStateByTransactionId.get(transaction.id)!;

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
        derivedStateByTransactionId,
        assigneeSortIndexById,
        bankAccountsById,
        categoryContext,
        taggedTransactionIds: taggedTransactionIdSet,
      }),
    );

  const offset = cursor ? Number.parseInt(cursor, 10) : 0;
  const fetchedData = filteredTransactions.slice(offset, offset + pageSize);
  const {
    attachmentsByTransactionId,
    transactionIdsWithAttachments: fetchedTransactionIdsWithAttachments,
  } = buildTransactionAttachmentLookups(
    await getTransactionAttachmentsForTransactionIdsFromConvex({
      teamId,
      transactionIds: fetchedData.map((row) => row.id),
    }),
  );
  const { tagsByTransactionId } = buildTransactionTagLookups(
    await getTransactionTagAssignmentsForTransactionIdsFromConvex({
      teamId,
      transactionIds: fetchedData.map((transaction) => transaction.id),
    }),
  );

  const hasNextPage = offset + pageSize < filteredTransactions.length;
  const nextCursor = hasNextPage ? (offset + pageSize).toString() : undefined;

  const processedData = fetchedData.map((transaction) => {
    const account = transaction.bankAccountId
      ? (bankAccountsById.get(transaction.bankAccountId) ?? null)
      : null;
    const syncedRecord = syncedByTransactionId.get(transaction.id);
    const errorRecord = errorByTransactionId.get(transaction.id);
    const transactionAttachments =
      attachmentsByTransactionId.get(transaction.id) ?? [];
    const category = buildTransactionCategorySummary(
      categoryContext.bySlug.get(transaction.categorySlug ?? ""),
    );

    const newAccount = account
      ? {
          id: account.id,
          name: account.name,
          currency: account.currency,
          connection: account.bankConnection
            ? {
                id: account.bankConnection.id,
                name: account.bankConnection.name,
                logoUrl: account.bankConnection.logoUrl,
              }
            : null,
        }
      : null;

    const { taxAmount, taxRate, taxType } = resolveTaxValues({
      transactionAmount: transaction.amount,
      transactionTaxAmount: transaction.taxAmount,
      transactionTaxRate: transaction.taxRate,
      transactionTaxType: transaction.taxType,
      categoryTaxRate: category?.taxRate,
      categoryTaxType: category?.taxType,
    });

    return {
      ...transaction,
      hasPendingSuggestion:
        derivedStateByTransactionId.get(transaction.id)?.hasPendingSuggestion ??
        false,
      attachments: transactionAttachments.map((attachment) => ({
        id: attachment.id,
        filename: attachment.name,
        path: attachment.path,
        type: attachment.type,
        size: attachment.size,
      })),
      isFulfilled:
        fetchedTransactionIdsWithAttachments.has(transaction.id) ||
        transaction.status === "completed",
      isExported: transaction.status === "exported" || Boolean(syncedRecord),
      exportProvider: syncedRecord?.provider ?? null,
      exportedAt: syncedRecord?.syncedAt ?? null,
      hasExportError: Boolean(errorRecord),
      exportErrorCode: errorRecord?.errorCode ?? null,
      account: newAccount,
      assigned: buildAssignedTransactionUser(
        transaction.assignedId
          ? assignedUserById.get(transaction.assignedId)
          : undefined,
      ),
      category,
      tags: tagsByTransactionId.get(transaction.id) ?? [],
      taxRate,
      taxType,
      taxAmount,
    };
  });

  return {
    meta: {
      cursor: nextCursor,
      hasPreviousPage: offset > 0,
      hasNextPage,
    },
    data: processedData,
  };
}

type GetTransactionByIdParams = {
  id: string;
  teamId: string;
};

export async function getTransactionById(
  db: Database,
  params: GetTransactionByIdParams,
) {
  return getFullTransactionData(db, params.id, params.teamId);
}

export type GetTransactionsByIdsParams = {
  ids: string[];
  teamId: string;
};

export async function getTransactionsByIds(
  db: Database,
  params: GetTransactionsByIdsParams,
) {
  const { ids, teamId } = params;

  if (ids.length === 0) {
    return [];
  }

  const [results, bankAccounts] = await Promise.all([
    getTransactionsByIdsFromConvex({
      teamId,
      transactionIds: ids,
    }),
    getBankAccountsFromConvex({ teamId }),
  ]);
  const bankAccountsById = new Map(
    bankAccounts.map((account) => [account.id, account]),
  );
  const categoryContext = await getTransactionCategoryContext(db, teamId);
  const { assignmentsByTransactionId } = buildTransactionTagLookups(
    await getTransactionTagAssignmentsForTransactionIdsFromConvex({
      teamId,
      transactionIds: ids,
    }),
  );
  const { attachmentsByTransactionId } = buildTransactionAttachmentLookups(
    await getTransactionAttachmentsForTransactionIdsFromConvex({
      teamId,
      transactionIds: ids,
    }),
  );

  return results.map((result) => ({
    id: result.id,
    date: result.date,
    name: result.name,
    description: result.description,
    amount: result.amount,
    note: result.note,
    balance: result.balance,
    currency: result.currency,
    counterparty_name: result.counterpartyName,
    tax_type: result.taxType,
    tax_rate: result.taxRate,
    tax_amount: result.taxAmount,
    base_amount: result.baseAmount,
    base_currency: result.baseCurrency,
    status: result.status,
    category: buildTransactionCategorySummary(
      categoryContext.bySlug.get(result.categorySlug ?? ""),
    ),
    bank_account: result.bankAccountId
      ? {
          id: result.bankAccountId,
          name: bankAccountsById.get(result.bankAccountId)?.name ?? null,
        }
      : null,
    attachments: attachmentsByTransactionId.get(result.id) ?? [],
    tags: (assignmentsByTransactionId.get(result.id) ?? []).map(
      ({ id, tag }) => ({
        id,
        tag: {
          id: tag.id,
          name: tag.name,
        },
      }),
    ),
  }));
}

export type GetTransactionsByAccountIdParams = {
  accountId: string;
  teamId: string;
};

export async function getTransactionsByAccountId(
  _db: Database,
  params: GetTransactionsByAccountIdParams,
) {
  return getTransactionsFromConvex({
    teamId: params.teamId,
    bankAccountId: params.accountId,
  });
}

export type GetTransactionCountByBankAccountIdParams = {
  bankAccountId: string;
  teamId: string;
};

export async function getTransactionCountByBankAccountId(
  _db: Database,
  params: GetTransactionCountByBankAccountIdParams,
): Promise<number> {
  return countTransactionsFromConvex({
    teamId: params.teamId,
    bankAccountId: params.bankAccountId,
  });
}
