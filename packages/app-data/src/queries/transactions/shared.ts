import {
  type BankAccountRecord,
  type TransactionMethod as ConvexTransactionMethod,
  type TransactionStatus as ConvexTransactionStatus,
  type CurrentUserIdentityRecord,
  getBankAccountsFromConvex,
  getInboxItemByIdFromConvex,
  getTeamMembersFromConvexIdentity,
  getTransactionAttachmentsForTransactionIdsFromConvex,
  getTransactionByIdFromConvex,
  getTransactionMatchSuggestionsFromConvex,
  getTransactionsByAmountRangeFromConvex,
  getTransactionTagAssignmentsForTransactionIdsFromConvex,
  searchTransactionsFromConvex,
  type TransactionCategoryRecord,
  type TransactionRecord,
  type TransactionTagAssignmentRecord,
  type UpsertTransactionInConvexInput,
} from "@tamias/app-data-convex";
import { resolveTaxValues } from "@tamias/utils/tax";
import type { Database } from "../../client";
import type { transactionFrequencyEnum } from "../../schema";
import type { AccountingSyncRecord } from "../accounting-sync";
import { getTransactionCategoryContext } from "../transaction-categories";

export type TransactionConvexUserId = CurrentUserIdentityRecord["convexId"];

export type TransactionFrequency =
  (typeof transactionFrequencyEnum.enumValues)[number];

export const MATCHING_EXCLUDED_TRANSACTION_STATUSES: ConvexTransactionStatus[] =
  ["pending", "excluded", "completed", "archived", "exported"];

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

export function toConvexTransactionInput(
  row: TransactionRecord,
  overrides: Partial<TransactionRecord> = {},
): UpsertTransactionInConvexInput {
  const next = { ...row, ...overrides };

  return {
    id: next.id,
    createdAt: next.createdAt,
    date: next.date,
    name: next.name,
    method: next.method as ConvexTransactionMethod,
    amount: Number(next.amount),
    currency: next.currency,
    assignedId: next.assignedId,
    note: next.note,
    bankAccountId: next.bankAccountId,
    internalId: next.internalId,
    status: next.status as ConvexTransactionStatus,
    balance: next.balance,
    manual: next.manual ?? false,
    notified: next.notified ?? false,
    internal: next.internal ?? false,
    description: next.description,
    categorySlug: next.categorySlug,
    baseAmount: next.baseAmount,
    counterpartyName: next.counterpartyName,
    baseCurrency: next.baseCurrency,
    taxAmount: next.taxAmount,
    taxRate: next.taxRate,
    taxType: next.taxType,
    recurring: next.recurring ?? false,
    frequency: next.frequency as TransactionFrequency | null | undefined,
    merchantName: next.merchantName,
    enrichmentCompleted: next.enrichmentCompleted ?? false,
    hasAttachment: next.hasAttachment ?? false,
  };
}

function pickLatestAccountingSyncRecord(
  current: AccountingSyncRecord | undefined,
  next: AccountingSyncRecord,
) {
  if (!current) {
    return next;
  }

  return next.syncedAt.localeCompare(current.syncedAt) > 0 ? next : current;
}

export function buildAccountingSyncLookups(records: AccountingSyncRecord[]) {
  const syncedByTransactionId = new Map<string, AccountingSyncRecord>();
  const errorByTransactionId = new Map<string, AccountingSyncRecord>();

  for (const record of records) {
    if (record.status === "synced") {
      syncedByTransactionId.set(
        record.transactionId,
        pickLatestAccountingSyncRecord(
          syncedByTransactionId.get(record.transactionId),
          record,
        ),
      );
      continue;
    }

    if (record.status === "failed" || record.status === "partial") {
      errorByTransactionId.set(
        record.transactionId,
        pickLatestAccountingSyncRecord(
          errorByTransactionId.get(record.transactionId),
          record,
        ),
      );
    }
  }

  return {
    syncedByTransactionId,
    errorByTransactionId,
    syncedTransactionIds: [...syncedByTransactionId.keys()],
    errorTransactionIds: [...errorByTransactionId.keys()],
  };
}

export type TransactionTag = {
  id: string;
  name: string | null;
};

export type AssignedTransactionUser = {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
};

export function buildAssignedTransactionUser(
  member: AssignedTransactionUser | undefined,
) {
  return {
    id: member?.id ?? null,
    fullName: member?.fullName ?? null,
    avatarUrl: member?.avatarUrl ?? null,
  };
}

export function buildAssignedUserLookup(
  teamMembers: Awaited<ReturnType<typeof getTeamMembersFromConvexIdentity>>,
) {
  return new Map<string, AssignedTransactionUser>(
    teamMembers.map((member) => [
      member.user.id,
      {
        id: member.user.id,
        fullName: member.user.fullName,
        avatarUrl: member.user.avatarUrl,
      },
    ]),
  );
}

function sortTransactionTags<T extends { tag: { name: string } }>(
  left: T,
  right: T,
) {
  return left.tag.name.localeCompare(right.tag.name);
}

export function buildTransactionTagLookups(
  assignments: TransactionTagAssignmentRecord[],
) {
  const assignmentsByTransactionId = new Map<
    string,
    TransactionTagAssignmentRecord[]
  >();
  const tagsByTransactionId = new Map<string, TransactionTag[]>();

  for (const assignment of assignments) {
    const currentAssignments =
      assignmentsByTransactionId.get(assignment.transactionId) ?? [];
    currentAssignments.push(assignment);
    currentAssignments.sort(sortTransactionTags);
    assignmentsByTransactionId.set(
      assignment.transactionId,
      currentAssignments,
    );

    const currentTags = tagsByTransactionId.get(assignment.transactionId) ?? [];

    currentTags.push({
      id: assignment.tag.id,
      name: assignment.tag.name,
    });
    currentTags.sort((left, right) =>
      (left.name ?? "").localeCompare(right.name ?? ""),
    );
    tagsByTransactionId.set(assignment.transactionId, currentTags);
  }

  return {
    assignmentsByTransactionId,
    tagsByTransactionId,
  };
}

export type TransactionAttachmentSummary = {
  id: string;
  name: string | null;
  path: string[] | null;
  type: string | null;
  size: number | null;
};

export type TransactionCategorySummary = {
  id: string;
  name: string;
  color: string | null;
  slug: string;
  taxRate: number | null;
  taxType: string | null;
  description: string | null;
  taxReportingCode: string | null;
};

export function buildTransactionCategorySummary(
  category: TransactionCategoryRecord | undefined,
): TransactionCategorySummary | null {
  if (!category) {
    return null;
  }

  return {
    id: category.id,
    name: category.name,
    color: category.color ?? null,
    slug: category.slug,
    taxRate: category.taxRate ?? null,
    taxType: category.taxType ?? null,
    description: category.description ?? null,
    taxReportingCode: category.taxReportingCode ?? null,
  };
}

export function expandTransactionCategories(
  categoriesBySlug: Map<string, TransactionCategoryRecord>,
  categoriesById: Map<string, TransactionCategoryRecord>,
  filterCategories: string[],
) {
  const expandedSlugs = new Set(
    filterCategories.filter((slug) => slug !== "uncategorized"),
  );

  for (const slug of expandedSlugs) {
    const category = categoriesBySlug.get(slug);

    if (!category || category.parentId) {
      continue;
    }

    for (const child of categoriesById.values()) {
      if (child.parentId === category.id) {
        expandedSlugs.add(child.slug);
      }
    }
  }

  return expandedSlugs;
}

export function buildTransactionAttachmentLookups(
  attachments: Array<{
    id: string;
    transactionId: string | null;
    name: string | null;
    path: string[] | null;
    type: string | null;
    size: number | null;
  }>,
) {
  const attachmentsByTransactionId = new Map<
    string,
    TransactionAttachmentSummary[]
  >();

  for (const attachment of attachments) {
    if (!attachment.transactionId) {
      continue;
    }

    const current =
      attachmentsByTransactionId.get(attachment.transactionId) ?? [];
    current.push({
      id: attachment.id,
      name: attachment.name,
      path: attachment.path,
      type: attachment.type,
      size: attachment.size,
    });
    attachmentsByTransactionId.set(attachment.transactionId, current);
  }

  return {
    attachmentsByTransactionId,
  };
}

export type TransactionDerivedState = {
  hasPendingSuggestion: boolean;
  isFulfilled: boolean;
  isExported: boolean;
  hasExportError: boolean;
};

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

export async function getPendingSuggestionTransactionIds(
  _db: Database,
  teamId: string,
) {
  const rows = await getTransactionMatchSuggestionsFromConvex({
    teamId,
    statuses: ["pending"],
  });

  return new Set(rows.map((row) => row.transactionId));
}

export async function getPendingSuggestionTransactionIdsForTransactions(
  _db: Database,
  params: {
    teamId: string;
    transactionIds: string[];
  },
) {
  if (params.transactionIds.length === 0) {
    return new Set<string>();
  }

  const rows = await getTransactionMatchSuggestionsFromConvex({
    teamId: params.teamId,
    transactionIds: params.transactionIds,
    statuses: ["pending"],
  });

  return new Set(rows.map((row) => row.transactionId));
}

export async function getPendingSuggestionForTransaction(
  _db: Database,
  params: {
    teamId: string;
    transactionId: string;
  },
) {
  const suggestion = (
    await getTransactionMatchSuggestionsFromConvex({
      teamId: params.teamId,
      transactionId: params.transactionId,
      statuses: ["pending"],
    })
  )[0];

  if (!suggestion) {
    return null;
  }

  const inboxItem = await getInboxItemByIdFromConvex({
    teamId: params.teamId,
    inboxId: suggestion.inboxId,
  });

  return {
    suggestionId: suggestion.id,
    inboxId: suggestion.inboxId,
    documentName: inboxItem?.displayName ?? null,
    documentAmount: inboxItem?.amount ?? null,
    documentCurrency: inboxItem?.currency ?? null,
    documentPath: inboxItem?.filePath ?? null,
    confidenceScore: suggestion.confidenceScore,
  };
}

export async function getFullTransactionData(
  db: Database,
  transactionId: string,
  teamId: string,
) {
  const [teamMembers, result, suggestion, bankAccounts] = await Promise.all([
    getTeamMembersFromConvexIdentity({ teamId }),
    getTransactionByIdFromConvex({
      teamId,
      transactionId,
    }),
    getPendingSuggestionForTransaction(db, {
      teamId,
      transactionId,
    }),
    getBankAccountsFromConvex({ teamId }),
  ]);

  if (!result) {
    return null;
  }

  const assignedUserById = buildAssignedUserLookup(teamMembers);
  const categoryContext = await getTransactionCategoryContext(db, teamId);

  const { attachmentsByTransactionId } = buildTransactionAttachmentLookups(
    await getTransactionAttachmentsForTransactionIdsFromConvex({
      teamId,
      transactionIds: [transactionId],
    }),
  );
  const { tagsByTransactionId } = buildTransactionTagLookups(
    await getTransactionTagAssignmentsForTransactionIdsFromConvex({
      teamId,
      transactionIds: [transactionId],
    }),
  );
  const account = result.bankAccountId
    ? (bankAccounts.find((item) => item.id === result.bankAccountId) ?? null)
    : null;
  const category = buildTransactionCategorySummary(
    categoryContext.bySlug.get(result.categorySlug ?? ""),
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
    transactionAmount: result.amount,
    transactionTaxAmount: result.taxAmount,
    transactionTaxRate: result.taxRate,
    transactionTaxType: result.taxType,
    categoryTaxRate: category?.taxRate,
    categoryTaxType: category?.taxType,
  });

  return {
    ...result,
    hasPendingSuggestion: Boolean(suggestion),
    suggestion,
    attachments: (attachmentsByTransactionId.get(result.id) ?? []).map(
      (attachment) => ({
        id: attachment.id,
        filename: attachment.name,
        path: attachment.path,
        type: attachment.type,
        size: attachment.size,
      }),
    ),
    isFulfilled: result.hasAttachment || result.status === "completed",
    account: newAccount,
    assigned: buildAssignedTransactionUser(
      result.assignedId ? assignedUserById.get(result.assignedId) : undefined,
    ),
    category,
    tags: tagsByTransactionId.get(result.id) ?? [],
    taxRate,
    taxType,
    taxAmount,
  };
}
