import {
  getBankAccountsFromConvex,
  getTeamMembersFromConvexIdentity,
  getTransactionAttachmentsForTransactionIdsFromConvex,
  getTransactionTagAssignmentsForTransactionIdsFromConvex,
  type TransactionRecord,
} from "../../convex";
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
  getPendingSuggestionTransactionIdsForTransactions,
  getTransactionDerivedState,
} from "./shared";
import {
  buildEmptyProcessedTransactionPage,
  buildTransactionsPageMeta,
} from "./reads-shared";

type CategoryContext = Awaited<ReturnType<typeof getTransactionCategoryContext>>;
type TeamMembers = Awaited<ReturnType<typeof getTeamMembersFromConvexIdentity>>;
type BankAccounts = Awaited<ReturnType<typeof getBankAccountsFromConvex>>;
type TransactionAttachments = Awaited<
  ReturnType<typeof getTransactionAttachmentsForTransactionIdsFromConvex>
>;
type TransactionTagAssignments = Awaited<
  ReturnType<typeof getTransactionTagAssignmentsForTransactionIdsFromConvex>
>;

export function buildProcessedTransactionLookups(args: {
  transactions: TransactionRecord[];
  teamMembers: TeamMembers;
  accountingSyncRecords: Awaited<ReturnType<typeof getAccountingSyncStatus>>;
  categoryContext: CategoryContext;
  bankAccounts: BankAccounts;
  pendingSuggestionIds: Set<string>;
  transactionAttachments: TransactionAttachments;
  transactionTagAssignments: TransactionTagAssignments;
}) {
  const assignedUserById = buildAssignedUserLookup(args.teamMembers);
  const bankAccountsById = new Map(
    args.bankAccounts.map((account) => [account.id, account]),
  );
  const {
    syncedByTransactionId,
    errorByTransactionId,
    syncedTransactionIds,
    errorTransactionIds,
  } = buildAccountingSyncLookups(args.accountingSyncRecords);
  const syncedTransactionIdSet = new Set(syncedTransactionIds);
  const errorTransactionIdSet = new Set(errorTransactionIds);
  const { attachmentsByTransactionId } = buildTransactionAttachmentLookups(
    args.transactionAttachments,
  );
  const { tagsByTransactionId } = buildTransactionTagLookups(
    args.transactionTagAssignments,
  );
  const derivedStateByTransactionId = new Map(
    args.transactions.map((transaction) => [
      transaction.id,
      getTransactionDerivedState(transaction, {
        pendingSuggestionIds: args.pendingSuggestionIds,
        syncedTransactionIds: syncedTransactionIdSet,
        errorTransactionIds: errorTransactionIdSet,
      }),
    ]),
  );

  return {
    assignedUserById,
    bankAccountsById,
    categoryContext: args.categoryContext,
    syncedByTransactionId,
    errorByTransactionId,
    syncedTransactionIdSet,
    errorTransactionIdSet,
    derivedStateByTransactionId,
    attachmentsByTransactionId,
    tagsByTransactionId,
  };
}

export type ProcessedTransactionLookups = ReturnType<
  typeof buildProcessedTransactionLookups
>;

export async function loadTransactionPageDecorations(args: {
  teamId: string;
  transactionIds: string[];
}) {
  const [transactionAttachments, transactionTagAssignments] = await Promise.all([
    getTransactionAttachmentsForTransactionIdsFromConvex({
      teamId: args.teamId,
      transactionIds: args.transactionIds,
    }),
    getTransactionTagAssignmentsForTransactionIdsFromConvex({
      teamId: args.teamId,
      transactionIds: args.transactionIds,
    }),
  ]);

  return {
    attachmentsByTransactionId: buildTransactionAttachmentLookups(
      transactionAttachments,
    ).attachmentsByTransactionId,
    tagsByTransactionId: buildTransactionTagLookups(transactionTagAssignments)
      .tagsByTransactionId,
  };
}

export async function loadProcessedTransactionLookups(args: {
  db: Database;
  teamId: string;
  transactions: TransactionRecord[];
}) {
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

  return buildProcessedTransactionLookups({
    transactions: args.transactions,
    teamMembers,
    accountingSyncRecords,
    categoryContext,
    bankAccounts,
    pendingSuggestionIds,
    transactionAttachments,
    transactionTagAssignments,
  });
}

export function buildProcessedTransactions(args: {
  transactions: TransactionRecord[];
  lookups: ProcessedTransactionLookups;
}) {
  return args.transactions.map((transaction) => {
    const account = transaction.bankAccountId
      ? (args.lookups.bankAccountsById.get(transaction.bankAccountId) ?? null)
      : null;
    const syncedRecord = args.lookups.syncedByTransactionId.get(transaction.id);
    const errorRecord = args.lookups.errorByTransactionId.get(transaction.id);
    const currentAttachments =
      args.lookups.attachmentsByTransactionId.get(transaction.id) ?? [];
    const category = buildTransactionCategorySummary(
      args.lookups.categoryContext.bySlug.get(transaction.categorySlug ?? ""),
    );
    const resolvedAccount = account
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
        args.lookups.derivedStateByTransactionId.get(transaction.id)
          ?.hasPendingSuggestion ?? false,
      attachments: currentAttachments.map((attachment) => ({
        id: attachment.id,
        filename: attachment.name,
        path: attachment.path,
        type: attachment.type,
        size: attachment.size,
      })),
      isFulfilled: transaction.hasAttachment || transaction.status === "completed",
      isExported: transaction.status === "exported" || Boolean(syncedRecord),
      exportProvider: syncedRecord?.provider ?? null,
      exportedAt: syncedRecord?.syncedAt ?? null,
      hasExportError: Boolean(errorRecord),
      exportErrorCode: errorRecord?.errorCode ?? null,
      account: resolvedAccount,
      assigned: buildAssignedTransactionUser(
        transaction.assignedId
          ? args.lookups.assignedUserById.get(transaction.assignedId)
          : undefined,
      ),
      category,
      tags: args.lookups.tagsByTransactionId.get(transaction.id) ?? [],
      taxRate,
      taxType,
      taxAmount,
    };
  });
}

export async function buildProcessedTransactionPage(args: {
  db: Database;
  teamId: string;
  transactions: TransactionRecord[];
  cursor: string | null | undefined;
  nextCursor: string | null | undefined;
  hasNextPage: boolean;
}) {
  if (args.transactions.length === 0) {
    return buildEmptyProcessedTransactionPage({
      cursor: args.cursor,
      nextCursor: args.nextCursor,
      hasNextPage: args.hasNextPage,
    });
  }

  const lookups = await loadProcessedTransactionLookups({
    db: args.db,
    teamId: args.teamId,
    transactions: args.transactions,
  });

  return {
    meta: buildTransactionsPageMeta({
      cursor: args.cursor,
      nextCursor: args.nextCursor,
      hasNextPage: args.hasNextPage,
    }),
    data: buildProcessedTransactions({
      transactions: args.transactions,
      lookups,
    }),
  };
}
