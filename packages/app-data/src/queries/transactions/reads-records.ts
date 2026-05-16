import type { Database } from "../../client";
import { getBankAccounts } from "../bank-accounts";
import { getTransactionAttachmentsForTransactionIds } from "../transaction-attachments";
import { getTransactionCategoryContext } from "../transaction-categories";
import {
  countTransactionsFromD1,
  getTransactionsByIdsFromD1,
  getTransactionsFromD1,
  getTransactionTagAssignmentsForTransactionIdsFromD1,
  requireTransactionsD1,
} from "./d1";
import {
  buildTransactionAttachmentLookups,
  buildTransactionCategorySummary,
  buildTransactionTagLookups,
  getFullTransactionData,
} from "./shared";

export type GetTransactionByIdParams = {
  id: string;
  teamId: string;
};

export async function getTransactionById(db: Database, params: GetTransactionByIdParams) {
  return getFullTransactionData(db, params.id, params.teamId);
}

export type GetTransactionsByIdsParams = {
  ids: string[];
  teamId: string;
};

export async function getTransactionsByIds(db: Database, params: GetTransactionsByIdsParams) {
  const { ids, teamId } = params;

  if (ids.length === 0) {
    return [];
  }

  const [results, bankAccounts] = await Promise.all([
    getTransactionsByIdsFromD1(requireTransactionsD1(db), {
      teamId,
      transactionIds: ids,
    }),
    getBankAccounts(db, { teamId }),
  ]);
  const bankAccountsById = new Map(bankAccounts.map((account) => [account.id, account]));
  const categoryContext = await getTransactionCategoryContext(db, teamId);
  const { assignmentsByTransactionId } = buildTransactionTagLookups(
    await getTransactionTagAssignmentsForTransactionIdsFromD1(requireTransactionsD1(db), {
      teamId,
      transactionIds: ids,
    }),
  );
  const { attachmentsByTransactionId } = buildTransactionAttachmentLookups(
    await getTransactionAttachmentsForTransactionIds(db, {
      teamId,
      transactionIds: ids,
    }),
  );

  return results.map((result) => ({
    id: result.id,
    date: result.date,
    name: result.name,
    description: result.description,
    amount: result.amount,
    note: result.note,
    balance: result.balance,
    currency: result.currency,
    counterparty_name: result.counterpartyName,
    tax_type: result.taxType,
    tax_rate: result.taxRate,
    tax_amount: result.taxAmount,
    base_amount: result.baseAmount,
    base_currency: result.baseCurrency,
    status: result.status,
    category: buildTransactionCategorySummary(
      categoryContext.bySlug.get(result.categorySlug ?? ""),
    ),
    bank_account: result.bankAccountId
      ? {
          id: result.bankAccountId,
          name: bankAccountsById.get(result.bankAccountId)?.name ?? null,
        }
      : null,
    attachments: attachmentsByTransactionId.get(result.id) ?? [],
    tags: (assignmentsByTransactionId.get(result.id) ?? []).map(({ id, tag }) => ({
      id,
      tag: {
        id: tag.id,
        name: tag.name,
      },
    })),
  }));
}

export type GetTransactionsByAccountIdParams = {
  accountId: string;
  teamId: string;
};

export async function getTransactionsByAccountId(
  db: Database,
  params: GetTransactionsByAccountIdParams,
) {
  return getTransactionsFromD1(requireTransactionsD1(db), {
    teamId: params.teamId,
    bankAccountId: params.accountId,
  });
}

export type GetTransactionCountByBankAccountIdParams = {
  bankAccountId: string;
  teamId: string;
};

export async function getTransactionCountByBankAccountId(
  db: Database,
  params: GetTransactionCountByBankAccountIdParams,
): Promise<number> {
  return countTransactionsFromD1(requireTransactionsD1(db), {
    teamId: params.teamId,
    bankAccountId: params.bankAccountId,
  });
}
