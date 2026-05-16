import type { Database } from "../../../client";
import {
  getFullTransactionData,
  toTransactionUpsertInput,
  type TransactionRecord,
  type TransactionUserId,
} from "../shared";
import {
  addTransactionTagToTransactionsInD1,
  getTransactionsByIdsFromD1,
  requireTransactionsD1,
  upsertTransactionsInD1,
} from "../d1";
import {
  clearAccountingSyncForStatusChange,
  normalizeTransactionMutationInput,
  recordTransactionMutationActivities,
  type TransactionMutationStatus,
} from "./shared";

type UpdateTransactionData = {
  id: string;
  teamId: string;
  userId?: TransactionUserId;
  name?: string;
  amount?: number;
  currency?: string;
  date?: string;
  bankAccountId?: string;
  categorySlug?: string | null;
  status?: TransactionMutationStatus;
  internal?: boolean;
  note?: string | null;
  assignedId?: string | null;
  recurring?: boolean;
  frequency?: "weekly" | "monthly" | "annually" | "irregular" | null;
  taxRate?: number | null;
  taxAmount?: number | null;
  taxType?: string | null;
};

export type UpdateTransactionsData = {
  ids: string[];
  teamId: string;
  userId?: TransactionUserId;
  categorySlug?: string | null;
  status?: TransactionMutationStatus;
  internal?: boolean;
  note?: string | null;
  assignedId?: string | null;
  tagId?: string | null;
  recurring?: boolean;
  frequency?: "weekly" | "monthly" | "annually" | "irregular" | null;
  taxRate?: number | null;
  taxAmount?: number | null;
  taxType?: string | null;
};

async function upsertUpdatedTransactions(args: {
  db: Database;
  teamId: string;
  currentTransactions: TransactionRecord[];
  updates: Partial<TransactionRecord>;
}) {
  if (args.currentTransactions.length === 0) {
    return;
  }

  await upsertTransactionsInD1(requireTransactionsD1(args.db), {
    teamId: args.teamId,
    transactions: args.currentTransactions.map((transaction) =>
      toTransactionUpsertInput(transaction, args.updates),
    ),
  });
}

export async function updateTransaction(db: Database, params: UpdateTransactionData) {
  const { id, teamId, userId, ...dataToUpdate } = params;
  const normalizedDataToUpdate = normalizeTransactionMutationInput(dataToUpdate);
  const current = await getTransactionsByIdsFromD1(requireTransactionsD1(db), {
    teamId,
    transactionIds: [id],
  }).then((rows) => rows[0] ?? null);

  if (!current) {
    return null;
  }

  await upsertUpdatedTransactions({
    db,
    teamId,
    currentTransactions: [current],
    updates: normalizedDataToUpdate,
  });

  await clearAccountingSyncForStatusChange({
    db,
    teamId,
    transactionIds: [id],
    status: dataToUpdate.status,
  });

  recordTransactionMutationActivities({
    db,
    teamId,
    userId,
    categorySlug: dataToUpdate.categorySlug,
    assignedId: dataToUpdate.assignedId,
    transactionIds: [id],
  });

  return getFullTransactionData(db, id, teamId);
}

export async function updateTransactions(db: Database, data: UpdateTransactionsData) {
  const { ids, tagId, teamId, userId, ...input } = data;
  const normalizedInput = normalizeTransactionMutationInput(input);

  if (tagId) {
    await addTransactionTagToTransactionsInD1(requireTransactionsD1(db), {
      teamId,
      transactionIds: ids,
      tagId,
    });
  }

  let results: { id: string }[] = [];

  if (Object.keys(input).length > 0) {
    const currentTransactions = await getTransactionsByIdsFromD1(requireTransactionsD1(db), {
      teamId,
      transactionIds: ids,
    });

    await upsertUpdatedTransactions({
      db,
      teamId,
      currentTransactions,
      updates: normalizedInput,
    });

    results = currentTransactions.map((transaction) => ({
      id: transaction.id,
    }));
  } else {
    results = ids.map((id) => ({ id }));
  }

  await clearAccountingSyncForStatusChange({
    db,
    teamId,
    transactionIds: ids,
    status: input.status,
  });

  recordTransactionMutationActivities({
    db,
    teamId,
    userId,
    categorySlug: input.categorySlug,
    assignedId: input.assignedId,
    transactionIds: results.map((result) => result.id),
  });

  const fullTransactions = await Promise.all(
    results.map((result) => getFullTransactionData(db, result.id, teamId)),
  );

  return fullTransactions.filter((transaction) => transaction !== null);
}
