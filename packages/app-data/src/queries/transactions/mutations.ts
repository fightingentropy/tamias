import {
  addTransactionTagToTransactionsInConvex,
  deleteTransactionsInConvex,
  deleteTransactionTagsForTransactionsInConvex,
  getTransactionsByIdsFromConvex,
  getTransactionsFromConvex,
  upsertTransactionsInConvex,
  type TransactionRecord,
} from "@tamias/app-data-convex";
import type { Database } from "../../client";
import { nanoid } from "nanoid";
import { deleteAccountingSyncRecordsForTransactions } from "../accounting-sync";
import { createActivity } from "../activities";
import { createAttachments, type Attachment } from "../transaction-attachments";
import {
  getFullTransactionData,
  toConvexTransactionInput,
  type TransactionConvexUserId,
} from "./shared";

type DeleteTransactionsParams = {
  teamId: string;
  ids: string[];
};

export async function deleteTransactions(
  _db: Database,
  params: DeleteTransactionsParams,
) {
  const deleted = (
    await getTransactionsByIdsFromConvex({
      teamId: params.teamId,
      transactionIds: params.ids,
    })
  )
    .filter((transaction) => transaction.manual)
    .map((transaction) => ({ id: transaction.id }));

  if (deleted.length > 0) {
    await deleteTransactionTagsForTransactionsInConvex({
      teamId: params.teamId,
      transactionIds: deleted.map((row) => row.id),
    });
    await deleteTransactionsInConvex({
      teamId: params.teamId,
      transactionIds: deleted.map((row) => row.id),
    });
  }

  return deleted;
}

export async function deleteTransactionsByInternalIds(
  _db: Database,
  params: { teamId: string; internalIds: string[] },
) {
  if (params.internalIds.length === 0) return [];

  const fullIds = new Set(
    params.internalIds.map((id) => `${params.teamId}_${id}`),
  );
  const deleted = (await getTransactionsFromConvex({ teamId: params.teamId }))
    .filter((transaction) => fullIds.has(transaction.internalId))
    .map((transaction) => ({ id: transaction.id }));

  if (deleted.length > 0) {
    await deleteTransactionTagsForTransactionsInConvex({
      teamId: params.teamId,
      transactionIds: deleted.map((row) => row.id),
    });
    await deleteTransactionsInConvex({
      teamId: params.teamId,
      transactionIds: deleted.map((row) => row.id),
    });
  }

  return deleted;
}

type UpdateTransactionData = {
  id: string;
  teamId: string;
  userId?: TransactionConvexUserId;
  name?: string;
  amount?: number;
  currency?: string;
  date?: string;
  bankAccountId?: string;
  categorySlug?: string | null;
  status?:
    | "pending"
    | "archived"
    | "completed"
    | "posted"
    | "excluded"
    | "exported"
    | null;
  internal?: boolean;
  note?: string | null;
  assignedId?: string | null;
  recurring?: boolean;
  frequency?: "weekly" | "monthly" | "annually" | "irregular" | null;
  taxRate?: number | null;
  taxAmount?: number | null;
  taxType?: string | null;
};

export async function updateTransaction(
  db: Database,
  params: UpdateTransactionData,
) {
  const { id, teamId, userId, ...dataToUpdate } = params;

  if (dataToUpdate.categorySlug !== undefined) {
    dataToUpdate.taxRate = null;
    dataToUpdate.taxAmount = null;
    dataToUpdate.taxType = null;
  }

  const normalizedDataToUpdate: Partial<TransactionRecord> = {
    ...dataToUpdate,
    status: dataToUpdate.status ?? undefined,
  };

  const current = await getTransactionsByIdsFromConvex({
    teamId,
    transactionIds: [id],
  }).then((rows) => rows[0] ?? null);

  if (!current) {
    return null;
  }

  await upsertTransactionsInConvex({
    teamId,
    transactions: [toConvexTransactionInput(current, normalizedDataToUpdate)],
  });

  if (dataToUpdate.status !== undefined && dataToUpdate.status !== "exported") {
    await deleteAccountingSyncRecordsForTransactions(db, {
      teamId,
      transactionIds: [id],
    });
  }

  if (dataToUpdate.categorySlug) {
    createActivity(db, {
      teamId,
      userId,
      type: "transactions_categorized",
      source: "user",
      priority: 7,
      metadata: {
        categorySlug: dataToUpdate.categorySlug,
        transactionIds: [id],
        transactionCount: 1,
      },
    });
  }

  if (dataToUpdate.assignedId) {
    createActivity(db, {
      teamId,
      userId,
      type: "transactions_assigned",
      source: "user",
      priority: 7,
      metadata: {
        assignedUserId: dataToUpdate.assignedId,
        transactionIds: [id],
        transactionCount: 1,
      },
    });
  }

  return getFullTransactionData(db, id, teamId);
}

export type UpdateTransactionsData = {
  ids: string[];
  teamId: string;
  userId?: TransactionConvexUserId;
  categorySlug?: string | null;
  status?:
    | "pending"
    | "archived"
    | "completed"
    | "posted"
    | "excluded"
    | "exported"
    | null;
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

export async function updateTransactions(
  db: Database,
  data: UpdateTransactionsData,
) {
  const { ids, tagId, teamId, userId, ...input } = data;

  if (input.categorySlug !== undefined) {
    input.taxRate = null;
    input.taxAmount = null;
    input.taxType = null;
  }

  if (tagId) {
    await addTransactionTagToTransactionsInConvex({
      teamId,
      transactionIds: ids,
      tagId,
    });
  }

  let results: { id: string }[] = [];

  if (Object.keys(input).length > 0) {
    const currentTransactions = await getTransactionsByIdsFromConvex({
      teamId,
      transactionIds: ids,
    });

    if (currentTransactions.length > 0) {
      await upsertTransactionsInConvex({
        teamId,
        transactions: currentTransactions.map((transaction) =>
          toConvexTransactionInput(transaction, {
            ...input,
            status: input.status ?? undefined,
          }),
        ),
      });
    }

    results = currentTransactions.map((transaction) => ({
      id: transaction.id,
    }));
  } else {
    results = ids.map((id) => ({ id }));
  }

  if (input.status !== undefined && input.status !== "exported") {
    await deleteAccountingSyncRecordsForTransactions(db, {
      teamId,
      transactionIds: ids,
    });
  }

  if (results.length > 0) {
    if (input.categorySlug) {
      createActivity(db, {
        teamId,
        userId,
        type: "transactions_categorized",
        source: "user",
        priority: 7,
        metadata: {
          categorySlug: input.categorySlug,
          transactionIds: results.map((r) => r.id),
          transactionCount: results.length,
        },
      });
    }

    if (input.assignedId) {
      createActivity(db, {
        teamId,
        userId,
        type: "transactions_assigned",
        source: "user",
        priority: 7,
        metadata: {
          assignedUserId: input.assignedId,
          transactionIds: results.map((r) => r.id),
          transactionCount: results.length,
        },
      });
    }
  }

  const fullTransactions = await Promise.all(
    results.map((result) => getFullTransactionData(db, result.id, teamId)),
  );

  return fullTransactions.filter((transaction) => transaction !== null);
}

export type CreateTransactionParams = {
  name: string;
  amount: number;
  currency: string;
  teamId: string;
  date: string;
  bankAccountId: string;
  assignedId?: string | null;
  categorySlug?: string | null;
  note?: string | null;
  internal?: boolean;
  attachments?: Attachment[];
};

export async function createTransaction(
  db: Database,
  params: CreateTransactionParams,
) {
  const {
    teamId,
    attachments,
    bankAccountId,
    categorySlug,
    assignedId,
    ...rest
  } = params;
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await upsertTransactionsInConvex({
    teamId,
    transactions: [
      {
        id,
        createdAt,
        date: rest.date,
        name: rest.name,
        method: "other",
        amount: rest.amount,
        currency: rest.currency,
        assignedId,
        note: rest.note,
        bankAccountId,
        internalId: `${teamId}_${nanoid()}`,
        status: "posted",
        manual: true,
        notified: true,
        internal: rest.internal ?? false,
        categorySlug,
        recurring: false,
        enrichmentCompleted: false,
      },
    ],
  });

  if (attachments) {
    await createAttachments(db, {
      attachments: attachments.map((attachment) => ({
        ...attachment,
        transactionId: id,
      })),
      teamId,
    });
  }

  return getFullTransactionData(db, id, teamId);
}

export async function createTransactions(
  db: Database,
  params: CreateTransactionParams[],
) {
  const firstTransaction = params.at(0);

  if (!firstTransaction) {
    return [];
  }

  const createdAt = new Date().toISOString();
  const results = params.map((transaction) => ({
    id: crypto.randomUUID(),
    teamId: transaction.teamId,
  }));
  const transactionsByTeam = new Map<
    string,
    Array<{ input: CreateTransactionParams; id: string }>
  >();

  for (const [index, transaction] of params.entries()) {
    const teamTransactions = transactionsByTeam.get(transaction.teamId) ?? [];
    teamTransactions.push({
      input: transaction,
      id: results[index]!.id,
    });
    transactionsByTeam.set(transaction.teamId, teamTransactions);
  }

  for (const [teamId, transactionsForTeam] of transactionsByTeam) {
    await upsertTransactionsInConvex({
      teamId,
      transactions: transactionsForTeam.map(({ input, id }) => ({
        id,
        createdAt,
        date: input.date,
        name: input.name,
        method: "other",
        amount: input.amount,
        currency: input.currency,
        assignedId: input.assignedId,
        note: input.note,
        bankAccountId: input.bankAccountId,
        internalId: `${input.teamId}_${nanoid()}`,
        status: "posted",
        manual: true,
        notified: true,
        internal: input.internal ?? false,
        categorySlug: input.categorySlug,
        recurring: false,
        enrichmentCompleted: false,
      })),
    });
  }

  const fullTransactions = await Promise.all(
    results.map((result) =>
      getFullTransactionData(db, result.id, result.teamId),
    ),
  );

  return fullTransactions.filter((transaction) => transaction !== null);
}

export type UpsertTransactionData = {
  name: string;
  date: string;
  method: "other" | "card_purchase" | "transfer";
  amount: number;
  currency: string;
  teamId: string;
  bankAccountId: string | null;
  internalId: string;
  status: "pending" | "completed" | "archived" | "posted" | "excluded";
  manual: boolean;
  categorySlug?: string | null;
  description?: string | null;
  balance?: number | null;
  note?: string | null;
  counterpartyName?: string | null;
  merchantName?: string | null;
  assignedId?: string | null;
  internal?: boolean;
  notified?: boolean;
  baseAmount?: number | null;
  baseCurrency?: string | null;
  taxAmount?: number | null;
  taxRate?: number | null;
  taxType?: string | null;
  recurring?: boolean;
  frequency?:
    | "weekly"
    | "biweekly"
    | "monthly"
    | "semi_monthly"
    | "annually"
    | "irregular"
    | "unknown"
    | null;
  enrichmentCompleted?: boolean;
};

export type UpsertTransactionsParams = {
  transactions: UpsertTransactionData[];
  teamId: string;
};

export async function upsertTransactions(
  _db: Database,
  params: UpsertTransactionsParams,
): Promise<Array<{ id: string }>> {
  const { transactions: transactionsData, teamId: _teamId } = params;
  if (transactionsData.length === 0) {
    return [];
  }

  const upserted = await upsertTransactionsInConvex({
    teamId: params.teamId,
    transactions: transactionsData.map((transaction) => ({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      date: transaction.date,
      name: transaction.name,
      method: transaction.method,
      amount: transaction.amount,
      currency: transaction.currency,
      assignedId: transaction.assignedId ?? null,
      note: transaction.note ?? null,
      bankAccountId: transaction.bankAccountId ?? null,
      internalId: transaction.internalId,
      status: transaction.status,
      balance: transaction.balance ?? null,
      manual: transaction.manual,
      notified: transaction.notified ?? false,
      internal: transaction.internal ?? false,
      description: transaction.description ?? null,
      categorySlug: transaction.categorySlug ?? null,
      baseAmount: transaction.baseAmount ?? null,
      counterpartyName: transaction.counterpartyName ?? null,
      baseCurrency: transaction.baseCurrency ?? null,
      taxAmount: transaction.taxAmount ?? null,
      taxRate: transaction.taxRate ?? null,
      taxType: transaction.taxType ?? null,
      recurring: transaction.recurring ?? false,
      frequency: transaction.frequency ?? null,
      merchantName: transaction.merchantName ?? null,
      enrichmentCompleted: transaction.enrichmentCompleted ?? false,
    })),
  });

  return upserted.map((transaction) => ({ id: transaction.id }));
}

export type BulkUpdateTransactionsBaseCurrencyParams = {
  transactions: Array<{
    id: string;
    baseAmount: number;
    baseCurrency: string;
  }>;
  teamId: string;
};

export async function bulkUpdateTransactionsBaseCurrency(
  _db: Database,
  params: BulkUpdateTransactionsBaseCurrencyParams,
) {
  const { transactions: transactionsData, teamId } = params;

  if (!teamId?.trim()) {
    throw new Error("bulkUpdateTransactionsBaseCurrency: teamId is required");
  }

  if (transactionsData.length === 0) return;
  const currentTransactions = await getTransactionsByIdsFromConvex({
    teamId,
    transactionIds: transactionsData.map((transaction) => transaction.id),
  });
  const updatesById = new Map(
    transactionsData.map((transaction) => [transaction.id, transaction]),
  );

  await upsertTransactionsInConvex({
    teamId,
    transactions: currentTransactions.map((transaction) =>
      toConvexTransactionInput(transaction, {
        baseAmount:
          updatesById.get(transaction.id)?.baseAmount ?? transaction.baseAmount,
        baseCurrency:
          updatesById.get(transaction.id)?.baseCurrency ??
          transaction.baseCurrency,
      }),
    ),
  });
}
