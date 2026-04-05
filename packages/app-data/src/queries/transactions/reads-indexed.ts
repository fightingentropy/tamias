import {
  getTransactionsByBankAccountPageFromConvex,
  getTransactionsByIdsFromConvex,
  getTransactionsPageFromConvex,
  getTaggedTransactionsPageFromConvex,
  type TransactionRecord,
  type TransactionStatus,
} from "../../convex";
import type { Database } from "../../client";
import { getAccountingSyncStatus } from "../accounting-sync";
import { buildProcessedTransactionPage } from "./reads-process";
import { getIndexedPageOrder, type GetTransactionsParams } from "./reads-shared";

type ReviewPageCursorState = {
  sourceCursor: string | null;
  sourceExhausted: boolean;
  bufferedIds: string[];
};

const REVIEW_PAGE_CURSOR_PREFIX = "review:";

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
            (bufferedId): bufferedId is string => typeof bufferedId === "string",
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
  const accountingSyncRecords = await getAccountingSyncStatus(db, {
    teamId: args.teamId,
    transactionIds,
  });
  const syncedTransactionIds = new Set(
    accountingSyncRecords
      .filter((record) => record.status === "synced")
      .map((record) => record.transactionId),
  );

  return args.transactions.filter(
    (transaction) =>
      transaction.status !== "excluded" &&
      transaction.status !== "archived" &&
      transaction.status !== "exported" &&
      !syncedTransactionIds.has(transaction.id) &&
      (transaction.status === "completed" || transaction.hasAttachment),
  );
}

export async function getIndexedReviewTransactionPage(args: {
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
    ...eligibleTransactions.slice(args.pageSize).map((transaction) => transaction.id),
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

export async function getIndexedTaggedTransactionPage(args: {
  db: Database;
  teamId: string;
  cursor: string | null | undefined;
  pageSize: number;
  sort: GetTransactionsParams["sort"];
  start: GetTransactionsParams["start"];
  end: GetTransactionsParams["end"];
  tags: GetTransactionsParams["tags"];
  statusesNotIn: TransactionStatus[];
}) {
  const indexedPage = await getTaggedTransactionsPageFromConvex({
    teamId: args.teamId,
    tagIds: args.tags ?? [],
    cursor: args.cursor,
    pageSize: args.pageSize,
    order: getIndexedPageOrder(args.sort) ?? undefined,
    dateGte: args.start ?? undefined,
    dateLte: args.end ?? undefined,
    statusesNotIn: args.statusesNotIn,
  });

  return buildProcessedTransactionPage({
    db: args.db,
    teamId: args.teamId,
    transactions: indexedPage.page,
    cursor: args.cursor,
    nextCursor: indexedPage.isDone ? undefined : indexedPage.continueCursor,
    hasNextPage: !indexedPage.isDone,
  });
}

export async function getIndexedTransactionPage(args: {
  db: Database;
  teamId: string;
  cursor: string | null | undefined;
  pageSize: number;
  sort: GetTransactionsParams["sort"];
  accounts: GetTransactionsParams["accounts"];
  start: GetTransactionsParams["start"];
  end: GetTransactionsParams["end"];
  statusesNotIn: TransactionStatus[];
}) {
  const bankAccountId =
    args.accounts && args.accounts.length === 1 ? args.accounts[0] : undefined;
  const indexedPage = bankAccountId
    ? await getTransactionsByBankAccountPageFromConvex({
        teamId: args.teamId,
        bankAccountId,
        cursor: args.cursor,
        pageSize: args.pageSize,
        order: getIndexedPageOrder(args.sort) ?? undefined,
        dateGte: args.start ?? undefined,
        dateLte: args.end ?? undefined,
        statusesNotIn: args.statusesNotIn,
      })
    : await getTransactionsPageFromConvex({
        teamId: args.teamId,
        cursor: args.cursor,
        pageSize: args.pageSize,
        order: getIndexedPageOrder(args.sort) ?? undefined,
        dateGte: args.start ?? undefined,
        dateLte: args.end ?? undefined,
        statusesNotIn: args.statusesNotIn,
      });

  return buildProcessedTransactionPage({
    db: args.db,
    teamId: args.teamId,
    transactions: indexedPage.page,
    cursor: args.cursor,
    nextCursor: indexedPage.isDone ? undefined : indexedPage.continueCursor,
    hasNextPage: !indexedPage.isDone,
  });
}
