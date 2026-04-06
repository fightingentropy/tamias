import type { InvoiceStatus } from "../../invoice-projections";
import type { SearchCandidate, SearchCandidateLoadParams, SearchSourceType } from "../types";
import {
  ALL_SEARCH_SOURCE_TYPES,
  INVOICE_SEARCH_STATUSES,
  TRACKER_PROJECT_SEARCH_STATUSES,
  TRANSACTION_SEARCH_STATUSES,
} from "../types";

function tokenizeSearchTerm(searchTerm: string | null | undefined) {
  return (searchTerm ?? "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function calculateRelevance(searchTerm: string | null | undefined, searchText: string) {
  const tokens = tokenizeSearchTerm(searchTerm);

  if (tokens.length === 0) {
    return 1;
  }

  let matches = 0;
  let exactBoost = 0;

  for (const token of tokens) {
    if (searchText.includes(token)) {
      matches += 1;
    }
  }

  if (tokens.length > 1 && searchText.includes(tokens.join(" "))) {
    exactBoost = 0.2;
  }

  return Math.min(1, matches / tokens.length + exactBoost);
}

export function matchesSearchTerm(candidate: SearchCandidate, searchTerm?: string) {
  const tokens = tokenizeSearchTerm(searchTerm);

  if (tokens.length === 0) {
    return true;
  }

  return tokens.every((token) => candidate.searchText.includes(token));
}

function matchesDateRange(value: string | null, start?: string, end?: string) {
  if (!(start || end)) {
    return true;
  }

  if (!value) {
    return false;
  }

  if (start && value < start) {
    return false;
  }

  if (end && value > end) {
    return false;
  }

  return true;
}

function matchesAmountRange(
  value: number | null,
  args: {
    amount?: number;
    amountMin?: number;
    amountMax?: number;
  },
) {
  if (args.amount == null && args.amountMin == null && args.amountMax == null) {
    return true;
  }

  if (value == null) {
    return false;
  }

  if (args.amount != null && value !== args.amount) {
    return false;
  }

  if (args.amountMin != null && value < args.amountMin) {
    return false;
  }

  if (args.amountMax != null && value > args.amountMax) {
    return false;
  }

  return true;
}

function matchesCurrency(value: string | null, currency?: string) {
  if (!currency) {
    return true;
  }

  return value === currency;
}

function matchesStatus(value: string | null, status?: string) {
  if (!status) {
    return true;
  }

  return value === status;
}

function matchesType(candidate: SearchCandidate, types?: string[]) {
  if (!types?.length) {
    return true;
  }

  return types.includes(candidate.sourceType);
}

function hasAmountFilters(args: { amount?: number; amountMin?: number; amountMax?: number }) {
  return args.amount != null || args.amountMin != null || args.amountMax != null;
}

export function getRequestedSourceTypes(types?: string[]) {
  if (!types?.length) {
    return ALL_SEARCH_SOURCE_TYPES;
  }

  const requested = new Set(types);

  return ALL_SEARCH_SOURCE_TYPES.filter((sourceType) => requested.has(sourceType));
}

export function sourceCanMatchFilters(
  sourceType: SearchSourceType,
  params: SearchCandidateLoadParams,
) {
  if ((params.dueDateStart || params.dueDateEnd) && sourceType !== "invoices") {
    return false;
  }

  if (hasAmountFilters(params)) {
    if (sourceType === "customers" || sourceType === "documents") {
      return false;
    }
  }

  if (params.currency && sourceType === "documents") {
    return false;
  }

  if (params.status) {
    if (sourceType === "invoices" && !INVOICE_SEARCH_STATUSES.has(params.status as InvoiceStatus)) {
      return false;
    }

    if (sourceType === "tracker_projects" && !TRACKER_PROJECT_SEARCH_STATUSES.has(params.status)) {
      return false;
    }

    if (sourceType === "transactions" && !TRANSACTION_SEARCH_STATUSES.has(params.status)) {
      return false;
    }
  }

  return true;
}

export function matchesSemanticCandidate(
  candidate: SearchCandidate,
  params: SearchCandidateLoadParams,
) {
  if (!matchesType(candidate, params.types)) {
    return false;
  }

  if (!matchesSearchTerm(candidate, params.searchTerm)) {
    return false;
  }

  if (!matchesDateRange(candidate.filterDate, params.startDate, params.endDate)) {
    return false;
  }

  if (!matchesDateRange(candidate.dueDate, params.dueDateStart, params.dueDateEnd)) {
    return false;
  }

  if (
    !matchesAmountRange(candidate.amount, {
      amount: params.amount,
      amountMin: params.amountMin,
      amountMax: params.amountMax,
    })
  ) {
    return false;
  }

  if (!matchesCurrency(candidate.currency, params.currency)) {
    return false;
  }

  return matchesStatus(candidate.status, params.status);
}
