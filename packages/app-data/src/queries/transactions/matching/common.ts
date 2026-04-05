import { createLoggerWithContext } from "@tamias/logger";

export const logger = createLoggerWithContext("transactions");

export const MIN_SIMILARITY_THRESHOLD = 0.6;
export const TRGM_CANDIDATE_THRESHOLD = 0.3;
export const EXACT_MERCHANT_SCORE = 0.95;
export const MAX_CANDIDATES = 200;

export function dedupeTransactionsById<T extends { id: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

export function roundMatchingScore(value: number) {
  return Math.round(value * 1000) / 1000;
}

export type SearchTransactionMatchParams = {
  teamId: string;
  inboxId?: string;
  query?: string;
  maxResults?: number;
  minConfidenceScore?: number;
  includeAlreadyMatched?: boolean;
};

export type SearchTransactionMatchResult = {
  transaction_id: string;
  name: string;
  transaction_amount: number;
  transaction_currency: string;
  transaction_date: string;
  name_score: number;
  amount_score: number;
  currency_score: number;
  date_score: number;
  confidence_score: number;
  is_already_matched: boolean;
  matched_attachment_filename?: string;
};
