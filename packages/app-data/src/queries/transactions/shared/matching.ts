import {
  type TransactionRecord,
  type TransactionStatus as ConvexTransactionStatus,
  getTransactionsByAmountRangeFromConvex,
  searchTransactionsFromConvex,
} from "@tamias/app-data-convex";
import { compareTransactionsByDateDesc } from "./sorting";

const MATCHING_SEARCH_STOP_WORDS = new Set([
  "bill",
  "document",
  "expense",
  "invoice",
  "payment",
  "receipt",
  "statement",
  "transaction",
  "transfer",
]);

export function getTransactionSearchText(transaction: TransactionRecord) {
  return [
    transaction.name,
    transaction.description,
    transaction.merchantName,
    transaction.counterpartyName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function matchesTransactionSearchQuery(
  transaction: TransactionRecord,
  query: string,
) {
  const numericQuery = Number(query);

  if (!Number.isNaN(numericQuery) && query.trim() !== "") {
    return transaction.amount === numericQuery;
  }

  return getTransactionSearchText(transaction).includes(query.toLowerCase());
}

export function getComparableTransactionAmount(transaction: TransactionRecord) {
  return transaction.baseAmount ?? transaction.amount;
}

function dedupeTransactionsById(transactions: TransactionRecord[]) {
  return [
    ...new Map(
      transactions.map((transaction) => [transaction.id, transaction]),
    ).values(),
  ];
}

function buildIndexedTransactionMatchQueries(
  searchTerms: Array<string | null | undefined>,
) {
  const queries = new Set<string>();

  for (const searchTerm of searchTerms) {
    const trimmed = searchTerm?.trim();

    if (!trimmed) {
      continue;
    }

    queries.add(trimmed);

    const significantTokens = [...new Set(trimmed.match(/[a-z0-9]+/gi) ?? [])]
      .map((token) => token.toLowerCase())
      .filter(
        (token) => token.length >= 3 && !MATCHING_SEARCH_STOP_WORDS.has(token),
      )
      .sort((left, right) => right.length - left.length);

    for (const token of significantTokens.slice(0, 2)) {
      queries.add(token);
    }

    if (queries.size >= 5) {
      break;
    }
  }

  return [...queries].slice(0, 5);
}

export async function getIndexedTransactionMatchCandidates(args: {
  teamId: string;
  searchTerms: Array<string | null | undefined>;
  amount?: number | null;
  dateGte?: string | null;
  dateLte?: string | null;
  statusesNotIn?: ConvexTransactionStatus[];
  limit?: number;
}) {
  const searchQueries = buildIndexedTransactionMatchQueries(args.searchTerms);
  const absoluteAmount =
    typeof args.amount === "number" && Number.isFinite(args.amount)
      ? Math.abs(args.amount)
      : null;
  const amountTolerance =
    absoluteAmount === null || absoluteAmount < 0.01
      ? null
      : Math.max(1, absoluteAmount * 0.25);
  const candidateLimit = Math.max(1, Math.min(args.limit ?? 120, 200));

  if (searchQueries.length === 0 && amountTolerance === null) {
    return [];
  }

  const groups = await Promise.all([
    ...searchQueries.map((query) =>
      searchTransactionsFromConvex({
        teamId: args.teamId,
        query,
        dateGte: args.dateGte ?? undefined,
        dateLte: args.dateLte ?? undefined,
        statusesNotIn: args.statusesNotIn,
        limit: candidateLimit,
      }),
    ),
    ...(absoluteAmount !== null && amountTolerance !== null
      ? [
          getTransactionsByAmountRangeFromConvex({
            teamId: args.teamId,
            minAmount: Math.max(
              0,
              Math.round((absoluteAmount - amountTolerance) * 100),
            ),
            maxAmount: Math.round((absoluteAmount + amountTolerance) * 100),
            dateGte: args.dateGte ?? undefined,
            dateLte: args.dateLte ?? undefined,
            statusesNotIn: args.statusesNotIn,
            limit: candidateLimit,
          }),
        ]
      : []),
  ]);

  return dedupeTransactionsById(groups.flat())
    .sort(compareTransactionsByDateDesc)
    .slice(0, candidateLimit);
}

export function shiftIsoDate(date: string, days: number) {
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

export function getIsoDateDistanceInDays(left: string, right: string) {
  const leftTime = new Date(`${left}T00:00:00.000Z`).getTime();
  const rightTime = new Date(`${right}T00:00:00.000Z`).getTime();
  return Math.abs(leftTime - rightTime) / (1000 * 60 * 60 * 24);
}
