import type { ConvexUserId } from "./base";
import { api, convexApi, createClient, serviceArgs } from "./base";

export type MatchSuggestionStatus =
  | "pending"
  | "confirmed"
  | "declined"
  | "expired"
  | "unmatched";

export type MatchSuggestionType =
  | "auto_matched"
  | "high_confidence"
  | "suggested";

export type TransactionMatchSuggestionRecord = {
  id: string;
  teamId: string;
  inboxId: string;
  transactionId: string;
  normalizedInboxName: string | null;
  normalizedTransactionName: string | null;
  confidenceScore: number;
  amountScore: number | null;
  currencyScore: number | null;
  dateScore: number | null;
  nameScore: number | null;
  matchType: MatchSuggestionType;
  matchDetails: Record<string, unknown> | null;
  status: MatchSuggestionStatus;
  userActionAt: string | null;
  userId: ConvexUserId | null;
  createdAt: string;
  updatedAt: string;
};

export type UpsertTransactionMatchSuggestionInConvexInput = {
  teamId: string;
  id?: string;
  inboxId: string;
  transactionId: string;
  confidenceScore: number;
  amountScore?: number | null;
  currencyScore?: number | null;
  dateScore?: number | null;
  nameScore?: number | null;
  matchType: MatchSuggestionType;
  matchDetails?: Record<string, unknown> | null;
  status: MatchSuggestionStatus;
  userActionAt?: string | null;
  userId?: ConvexUserId | null;
  createdAt?: string;
  updatedAt?: string;
};

export async function getTransactionMatchSuggestionsFromConvex(args: {
  teamId: string;
  inboxId?: string;
  transactionId?: string;
  transactionIds?: string[];
  statuses?: MatchSuggestionStatus[];
}) {
  return createClient().query(
    api.inbox.serviceGetTransactionMatchSuggestions,
    serviceArgs({
      publicTeamId: args.teamId,
      inboxId: args.inboxId,
      transactionId: args.transactionId,
      transactionIds: args.transactionIds,
      statuses: args.statuses,
    }),
  ) as Promise<TransactionMatchSuggestionRecord[]>;
}

export async function getTransactionMatchSuggestionsPageFromConvex(args: {
  teamId: string;
  status: MatchSuggestionStatus;
  cursor?: string | null;
  pageSize: number;
  order?: "asc" | "desc";
  createdAtFrom?: string;
  createdAtTo?: string;
}) {
  return createClient().query(
    convexApi.inbox.serviceListTransactionMatchSuggestionsPage,
    serviceArgs({
      publicTeamId: args.teamId,
      status: args.status,
      order: args.order,
      createdAtFrom: args.createdAtFrom,
      createdAtTo: args.createdAtTo,
      paginationOpts: {
        numItems: args.pageSize,
        cursor: args.cursor ?? null,
      },
    }),
  ) as Promise<{
    page: TransactionMatchSuggestionRecord[];
    isDone: boolean;
    continueCursor: string;
  }>;
}

export async function upsertTransactionMatchSuggestionsInConvex(args: {
  suggestions: UpsertTransactionMatchSuggestionInConvexInput[];
}) {
  return createClient().mutation(
    api.inbox.serviceUpsertTransactionMatchSuggestions,
    serviceArgs({
      suggestions: args.suggestions.map((suggestion) => ({
        publicTeamId: suggestion.teamId,
        id: suggestion.id,
        inboxId: suggestion.inboxId,
        transactionId: suggestion.transactionId,
        confidenceScore: suggestion.confidenceScore,
        amountScore: suggestion.amountScore,
        currencyScore: suggestion.currencyScore,
        dateScore: suggestion.dateScore,
        nameScore: suggestion.nameScore,
        matchType: suggestion.matchType,
        matchDetails: suggestion.matchDetails,
        status: suggestion.status,
        userActionAt: suggestion.userActionAt,
        userId: suggestion.userId,
        createdAt: suggestion.createdAt,
        updatedAt: suggestion.updatedAt,
      })),
    }),
  ) as Promise<TransactionMatchSuggestionRecord[]>;
}

export async function deleteTransactionMatchSuggestionsInConvex(args: {
  teamId: string;
  suggestionIds?: string[];
  inboxIds?: string[];
}) {
  return createClient().mutation(
    api.inbox.serviceDeleteTransactionMatchSuggestions,
    serviceArgs({
      publicTeamId: args.teamId,
      suggestionIds: args.suggestionIds,
      inboxIds: args.inboxIds,
    }),
  ) as Promise<string[]>;
}

export async function rebuildTransactionMatchSuggestionLearningFieldsInConvex(args: {
  teamId?: string | null;
}) {
  return createClient().mutation(
    convexApi.inbox.serviceRebuildTransactionMatchSuggestionLearningFields,
    serviceArgs({
      publicTeamId: args.teamId ?? null,
    }),
  ) as Promise<
    Array<{
      teamId: string;
      suggestionCount: number;
      updatedSuggestionCount: number;
    }>
  >;
}
