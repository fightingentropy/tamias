import {
  getTransactionsByIdsFromConvex,
  type TransactionRecord,
  upsertTransactionsInConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../client";

function compareTransactionsByDateDesc(
  left: Pick<TransactionRecord, "id" | "date" | "createdAt">,
  right: Pick<TransactionRecord, "id" | "date" | "createdAt">,
) {
  const dateComparison = right.date.localeCompare(left.date);

  if (dateComparison !== 0) {
    return dateComparison;
  }

  const createdAtComparison = right.createdAt.localeCompare(left.createdAt);

  if (createdAtComparison !== 0) {
    return createdAtComparison;
  }

  return right.id.localeCompare(left.id);
}

export type GetTransactionsForEnrichmentParams = {
  transactionIds: string[];
  teamId: string;
};

export type TransactionForEnrichment = {
  id: string;
  name: string;
  counterpartyName: string | null;
  merchantName: string | null;
  description: string | null;
  amount: number;
  currency: string;
  categorySlug: string | null;
};

export type EnrichmentUpdateData = {
  merchantName?: string;
  categorySlug?: string;
};

export type UpdateTransactionEnrichmentParams = {
  transactionId: string;
  data: EnrichmentUpdateData;
};

export type UpdateTransactionEnrichmentsParams = {
  teamId: string;
  updates: UpdateTransactionEnrichmentParams[];
};

export type MarkTransactionsAsEnrichedParams = {
  teamId: string;
  transactionIds: string[];
};

function toUpsertTransaction(
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

export async function getTransactionsForEnrichment(
  _db: Database,
  params: GetTransactionsForEnrichmentParams,
): Promise<TransactionForEnrichment[]> {
  if (params.transactionIds.length === 0) {
    return [];
  }

  return (
    await getTransactionsByIdsFromConvex({
      teamId: params.teamId,
      transactionIds: params.transactionIds,
    })
  )
    .filter((transaction) => !transaction.enrichmentCompleted)
    .sort(compareTransactionsByDateDesc)
    .map((transaction) => ({
      id: transaction.id,
      name: transaction.name,
      counterpartyName: transaction.counterpartyName,
      merchantName: transaction.merchantName,
      description: transaction.description,
      amount: transaction.amount,
      currency: transaction.currency,
      categorySlug: transaction.categorySlug,
    }));
}

export async function updateTransactionEnrichments(
  _db: Database,
  params: UpdateTransactionEnrichmentsParams,
): Promise<void> {
  const { teamId, updates } = params;

  if (updates.length === 0) {
    return;
  }

  if (updates.length > 1000) {
    throw new Error(
      `Batch size too large: ${updates.length}. Maximum allowed: 1000`,
    );
  }

  for (const update of updates) {
    if (!update.transactionId?.trim()) {
      throw new Error("Invalid transactionId: cannot be empty");
    }
    if (!update.data.merchantName && !update.data.categorySlug) {
      throw new Error(
        "At least one of merchantName or categorySlug must be provided",
      );
    }
    if (
      update.data.merchantName !== undefined &&
      !update.data.merchantName?.trim()
    ) {
      throw new Error("Invalid merchantName: cannot be empty when provided");
    }
  }

  try {
    const deduped = new Map<string, EnrichmentUpdateData>();
    for (const update of updates) {
      const existing = deduped.get(update.transactionId);
      deduped.set(
        update.transactionId,
        existing ? { ...existing, ...update.data } : { ...update.data },
      );
    }

    const updatesByTransactionId = deduped;
    const transactions = await getTransactionsByIdsFromConvex({
      teamId,
      transactionIds: [...updatesByTransactionId.keys()],
    }).then((records) => records.sort(compareTransactionsByDateDesc));

    if (transactions.length === 0) {
      return;
    }

    await upsertTransactionsInConvex({
      teamId,
      transactions: transactions.map((transaction) =>
        toUpsertTransaction(transaction, {
          merchantName:
            updatesByTransactionId.get(transaction.id)?.merchantName ??
            transaction.merchantName,
          categorySlug:
            updatesByTransactionId.get(transaction.id)?.categorySlug ??
            transaction.categorySlug,
          enrichmentCompleted: true,
        }),
      ),
    });
  } catch (error) {
    throw new Error(
      `Failed to update transaction enrichments: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export async function markTransactionsAsEnriched(
  _db: Database,
  params: MarkTransactionsAsEnrichedParams,
): Promise<void> {
  const { teamId, transactionIds } = params;

  if (transactionIds.length === 0) {
    return;
  }

  if (transactionIds.length > 1000) {
    throw new Error(
      `Batch size too large: ${transactionIds.length}. Maximum allowed: 1000`,
    );
  }

  for (const id of transactionIds) {
    if (!id?.trim()) {
      throw new Error("Invalid transactionId: cannot be empty");
    }
  }

  try {
    const transactions = await getTransactionsByIdsFromConvex({
      teamId,
      transactionIds,
    }).then((records) => records.sort(compareTransactionsByDateDesc));

    if (transactions.length === 0) {
      return;
    }

    await upsertTransactionsInConvex({
      teamId,
      transactions: transactions.map((transaction) =>
        toUpsertTransaction(transaction, {
          enrichmentCompleted: true,
        }),
      ),
    });
  } catch (error) {
    throw new Error(
      `Failed to mark transactions as enriched: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
