import {
  getInboxAccountsByIdsFromConvex,
  getInboxItemByIdFromConvex,
  getTransactionByIdFromConvex,
  getTransactionMatchSuggestionsFromConvex,
  getTransactionsByIdsFromConvex,
  upsertInboxItemsInConvex,
  upsertTransactionMatchSuggestionsInConvex,
  upsertTransactionsInConvex,
  type CurrentUserIdentityRecord,
  type InboxAccountListRecord,
  type InboxItemRecord,
  type MatchSuggestionStatus,
  type TransactionMatchSuggestionRecord,
  type TransactionRecord,
} from "@tamias/app-data-convex";
import { getInboxItemsPaged } from "../paged-records";

export type InboxConvexUserId = CurrentUserIdentityRecord["convexId"];

export function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function compareNullableStrings(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  return normalizeText(left).localeCompare(normalizeText(right));
}

export function compareNullableNumbers(
  left: number | null | undefined,
  right: number | null | undefined,
) {
  return (left ?? 0) - (right ?? 0);
}

export function compareNullableDates(
  left: string | null | undefined,
  right: string | null | undefined,
  direction: "asc" | "desc",
) {
  const leftValue = left ?? (direction === "asc" ? "" : "\uffff");
  const rightValue = right ?? (direction === "asc" ? "" : "\uffff");
  return leftValue.localeCompare(rightValue);
}

export function includesSearch(
  value: string | null | undefined,
  query: string,
) {
  return normalizeText(value).includes(normalizeText(query));
}

export function filePathEquals(
  left: string[] | null | undefined,
  right: string[],
) {
  if (!left || left.length !== right.length) {
    return false;
  }

  return left.every((token, index) => token === right[index]);
}

export function shiftIsoDate(date: string, days: number) {
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

export function buildInboxAccountMap(accounts: InboxAccountListRecord[]) {
  return new Map(
    accounts.map((account) => [
      account.id,
      {
        id: account.id,
        email: account.email,
        provider: account.provider,
      },
    ]),
  );
}

export async function getInboxAccountMap(
  inboxAccountIds: Array<string | null | undefined>,
) {
  const uniqueIds = [...new Set(inboxAccountIds.filter(Boolean))] as string[];

  if (uniqueIds.length === 0) {
    return new Map<
      string,
      { id: string; email: string; provider: "gmail" | "outlook" }
    >();
  }

  const accounts = await getInboxAccountsByIdsFromConvex({
    ids: uniqueIds,
  });

  return buildInboxAccountMap(accounts);
}

export type InboxTransactionSummary = Pick<
  TransactionRecord,
  "id" | "amount" | "currency" | "name" | "date"
>;

export function buildInboxTransactionSummary(
  transaction: TransactionRecord | null,
): InboxTransactionSummary | null {
  if (!transaction) {
    return null;
  }

  return {
    id: transaction.id,
    amount: transaction.amount,
    currency: transaction.currency,
    name: transaction.name,
    date: transaction.date,
  };
}

export async function getInboxTransactionMap(
  teamId: string,
  transactionIds: Array<string | null | undefined>,
) {
  const uniqueIds = [...new Set(transactionIds.filter(Boolean))] as string[];

  if (uniqueIds.length === 0) {
    return new Map<string, InboxTransactionSummary>();
  }

  const transactions = await getTransactionsByIdsFromConvex({
    teamId,
    transactionIds: uniqueIds,
  });

  return new Map(
    transactions.map((transaction) => [
      transaction.id,
      buildInboxTransactionSummary(transaction)!,
    ]),
  );
}

export function toUpsertInboxItem(
  item: InboxItemRecord,
  overrides: Partial<InboxItemRecord> = {},
) {
  const next = { ...item, ...overrides };

  return {
    teamId: next.teamId,
    id: next.id,
    createdAt: next.createdAt,
    updatedAt: next.updatedAt,
    filePath: next.filePath,
    fileName: next.fileName,
    transactionId: next.transactionId,
    amount: next.amount,
    currency: next.currency,
    contentType: next.contentType,
    size: next.size,
    attachmentId: next.attachmentId,
    date: next.date,
    forwardedTo: next.forwardedTo,
    referenceId: next.referenceId,
    meta: next.meta,
    status: next.status,
    website: next.website,
    senderEmail: next.senderEmail,
    displayName: next.displayName,
    type: next.type,
    description: next.description,
    baseAmount: next.baseAmount,
    baseCurrency: next.baseCurrency,
    taxAmount: next.taxAmount,
    taxRate: next.taxRate,
    taxType: next.taxType,
    inboxAccountId: next.inboxAccountId,
    invoiceNumber: next.invoiceNumber,
    groupedInboxId: next.groupedInboxId,
  };
}

export function toUpsertTransaction(
  transaction: TransactionRecord,
  overrides: Partial<TransactionRecord> = {},
) {
  const next = { ...transaction, ...overrides };

  return {
    id: next.id,
    createdAt: next.createdAt,
    date: next.date,
    name: next.name,
    method: next.method,
    amount: next.amount,
    currency: next.currency,
    assignedId: next.assignedId,
    note: next.note,
    bankAccountId: next.bankAccountId,
    internalId: next.internalId,
    status: next.status,
    balance: next.balance,
    manual: next.manual,
    internal: next.internal,
    description: next.description,
    categorySlug: next.categorySlug,
    baseAmount: next.baseAmount,
    counterpartyName: next.counterpartyName,
    baseCurrency: next.baseCurrency,
    taxAmount: next.taxAmount,
    taxRate: next.taxRate,
    taxType: next.taxType,
    recurring: next.recurring,
    frequency: next.frequency,
    merchantName: next.merchantName,
    enrichmentCompleted: next.enrichmentCompleted,
  };
}

export function toUpsertSuggestion(
  suggestion: TransactionMatchSuggestionRecord,
  overrides: Partial<TransactionMatchSuggestionRecord> = {},
) {
  const next = { ...suggestion, ...overrides };

  return {
    teamId: next.teamId,
    id: next.id,
    inboxId: next.inboxId,
    transactionId: next.transactionId,
    confidenceScore: next.confidenceScore,
    amountScore: next.amountScore,
    currencyScore: next.currencyScore,
    dateScore: next.dateScore,
    nameScore: next.nameScore,
    matchType: next.matchType,
    matchDetails: next.matchDetails,
    status: next.status,
    userActionAt: next.userActionAt,
    userId: next.userId,
    createdAt: next.createdAt,
    updatedAt: next.updatedAt,
  };
}

export async function patchTransactionFields(
  teamId: string,
  transactionId: string,
  overrides: Partial<TransactionRecord>,
) {
  const current = await getTransactionByIdFromConvex({
    teamId,
    transactionId,
  });

  if (!current) {
    throw new Error("Transaction not found or belongs to another team");
  }

  await upsertTransactionsInConvex({
    teamId,
    transactions: [toUpsertTransaction(current, overrides)],
  });
}

export async function loadSuggestionMaps(
  teamId: string,
  suggestions: TransactionMatchSuggestionRecord[],
) {
  const transactionMap = new Map<string, InboxTransactionSummary>();
  const suggestionIds = suggestions
    .map((suggestion) => suggestion.transactionId)
    .filter(Boolean);

  if (suggestionIds.length === 0) {
    return transactionMap;
  }

  const transactions = await getTransactionsByIdsFromConvex({
    teamId,
    transactionIds: suggestionIds,
  });

  for (const transaction of transactions) {
    transactionMap.set(
      transaction.id,
      buildInboxTransactionSummary(transaction)!,
    );
  }

  return transactionMap;
}

export async function hydrateInboxItems(
  teamId: string,
  items: InboxItemRecord[],
) {
  const [inboxAccountMap, transactionMap] = await Promise.all([
    getInboxAccountMap(items.map((item) => item.inboxAccountId)),
    getInboxTransactionMap(
      teamId,
      items.map((item) => item.transactionId),
    ),
  ]);

  return items.map((item) => ({
    ...item,
    inboxAccount: item.inboxAccountId
      ? (inboxAccountMap.get(item.inboxAccountId) ?? null)
      : null,
    transaction: item.transactionId
      ? (transactionMap.get(item.transactionId) ?? null)
      : null,
  }));
}

export async function getTeamInboxItems(teamId: string) {
  return getInboxItemsPaged({ teamId, order: "desc" });
}

export async function getTeamMatchSuggestions(
  teamId: string,
  statuses?: MatchSuggestionStatus[],
) {
  return getTransactionMatchSuggestionsFromConvex({ teamId, statuses });
}

export async function getPendingSuggestionForInbox(
  teamId: string,
  inboxId: string,
) {
  const suggestions = await getTransactionMatchSuggestionsFromConvex({
    teamId,
    inboxId,
    statuses: ["pending"],
  });

  return (
    suggestions.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    )[0] ?? null
  );
}

export async function clearInboxSuggestions(
  teamId: string,
  suggestions: TransactionMatchSuggestionRecord[],
  params: {
    status: MatchSuggestionStatus;
    userId?: InboxConvexUserId | null;
  },
) {
  if (suggestions.length === 0) {
    return;
  }

  await upsertTransactionMatchSuggestionsInConvex({
    suggestions: suggestions.map((suggestion) =>
      toUpsertSuggestion(suggestion, {
        status: params.status,
        userActionAt: new Date().toISOString(),
        userId: params.userId ?? null,
        updatedAt: new Date().toISOString(),
      }),
    ),
  });
}

export async function markInboxItems(
  items: InboxItemRecord[],
  overrides: Partial<InboxItemRecord>,
) {
  if (items.length === 0) {
    return [];
  }

  return upsertInboxItemsInConvex({
    items: items.map((item) =>
      toUpsertInboxItem(item, {
        ...overrides,
        updatedAt: new Date().toISOString(),
      }),
    ),
  });
}
