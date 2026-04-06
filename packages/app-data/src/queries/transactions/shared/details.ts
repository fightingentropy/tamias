import {
  getBankAccountsFromConvex,
  getInboxItemByIdFromConvex,
  getTeamMembersFromConvexIdentity,
  getTransactionAttachmentsForTransactionIdsFromConvex,
  getTransactionByIdFromConvex,
  getTransactionMatchSuggestionsFromConvex,
  getTransactionTagAssignmentsForTransactionIdsFromConvex,
} from "@tamias/app-data-convex";
import { resolveTaxValues } from "@tamias/utils/tax";
import type { Database } from "../../../client";
import { getTransactionCategoryContext } from "../../transaction-categories";
import {
  buildAssignedTransactionUser,
  buildAssignedUserLookup,
  buildTransactionAttachmentLookups,
  buildTransactionTagLookups,
} from "./lookups";
import { buildTransactionCategorySummary } from "./types";

export async function getPendingSuggestionTransactionIds(_db: Database, teamId: string) {
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

export async function getFullTransactionData(db: Database, transactionId: string, teamId: string) {
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

  const normalizedAccount = account
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
    attachments: (attachmentsByTransactionId.get(result.id) ?? []).map((attachment) => ({
      id: attachment.id,
      filename: attachment.name,
      path: attachment.path,
      type: attachment.type,
      size: attachment.size,
    })),
    isFulfilled: result.hasAttachment || result.status === "completed",
    account: normalizedAccount,
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
