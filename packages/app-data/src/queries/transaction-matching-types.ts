import type {
  CurrentUserIdentityRecord,
  InboxItemRecord,
} from "@tamias/app-data-convex";
import type { MatchType } from "../utils/transaction-matching";

type ConvexUserId = CurrentUserIdentityRecord["convexId"];

export type FindMatchesParams = {
  teamId: string;
  inboxId: string;
};

export type FindInboxMatchesParams = {
  teamId: string;
  transactionId: string;
  candidateInboxItems?: InboxItemRecord[];
};

export type MatchResult = {
  transactionId: string;
  name: string;
  amount: number;
  currency: string;
  date: string;
  nameScore?: number;
  amountScore: number;
  currencyScore: number;
  dateScore: number;
  confidenceScore: number;
  matchType: MatchType;
  isAlreadyMatched: boolean;
};

export type InboxMatchResult = {
  inboxId: string;
  displayName: string | null;
  amount: number | null;
  currency: string | null;
  date: string;
  nameScore?: number;
  amountScore: number;
  currencyScore: number;
  dateScore: number;
  confidenceScore: number;
  matchType: MatchType;
  isAlreadyMatched: boolean;
};

export type CreateMatchSuggestionParams = {
  teamId: string;
  inboxId: string;
  transactionId: string;
  confidenceScore: number;
  amountScore: number;
  currencyScore: number;
  dateScore: number;
  nameScore?: number;
  matchType: MatchType;
  matchDetails: Record<string, any>;
  status?: "pending" | "confirmed" | "declined";
  userId?: ConvexUserId;
};

export type InboxSuggestion = {
  id: string;
  transactionId: string;
  transactionName: string;
  transactionAmount: number;
  transactionCurrency: string;
  transactionDate: string;
  confidenceScore: number;
  matchType: "auto_matched" | "high_confidence" | "suggested";
  status: "pending" | "confirmed" | "declined" | "expired";
};

export type TeamCalibrationData = {
  teamId: string;
  totalSuggestions: number;
  confirmedSuggestions: number;
  declinedSuggestions: number;
  unmatchedSuggestions: number;
  avgConfidenceConfirmed: number;
  avgConfidenceDeclined: number;
  avgConfidenceUnmatched: number;
  suggestedMatchAccuracy: number;
  calibratedSuggestedThreshold: number;
  calibratedAutoThreshold: number;
  thresholdOptimizationSampleSize: number;
  lastUpdated: string;
};

export type TeamPairHistoryRow = {
  status: string;
  confidenceScore: number | null;
  createdAt: string;
};

export type TeamPairHistoryMap = Map<string, TeamPairHistoryRow[]>;

export type TeamPairHistory = TeamPairHistoryMap;
