import { upsertTransactionsInConvex } from "@tamias/app-data-convex";
import type { Database } from "../../../client";
import { nanoid } from "nanoid";
import { createAttachments, type Attachment } from "../../transaction-attachments";
import { getFullTransactionData } from "../shared";

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

function buildManualTransactionInput(args: {
  id: string;
  createdAt: string;
  transaction: CreateTransactionParams;
}) {
  return {
    id: args.id,
    createdAt: args.createdAt,
    date: args.transaction.date,
    name: args.transaction.name,
    method: "other" as const,
    amount: args.transaction.amount,
    currency: args.transaction.currency,
    assignedId: args.transaction.assignedId,
    note: args.transaction.note,
    bankAccountId: args.transaction.bankAccountId,
    internalId: `${args.transaction.teamId}_${nanoid()}`,
    status: "posted" as const,
    manual: true,
    notified: true,
    internal: args.transaction.internal ?? false,
    categorySlug: args.transaction.categorySlug,
    recurring: false,
    enrichmentCompleted: false,
  };
}

export async function createTransaction(db: Database, params: CreateTransactionParams) {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await upsertTransactionsInConvex({
    teamId: params.teamId,
    transactions: [
      buildManualTransactionInput({
        id,
        createdAt,
        transaction: params,
      }),
    ],
  });

  if (params.attachments) {
    await createAttachments(db, {
      attachments: params.attachments.map((attachment) => ({
        ...attachment,
        transactionId: id,
      })),
      teamId: params.teamId,
    });
  }

  return getFullTransactionData(db, id, params.teamId);
}

export async function createTransactions(db: Database, params: CreateTransactionParams[]) {
  if (params.length === 0) {
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
      transactions: transactionsForTeam.map(({ input, id }) =>
        buildManualTransactionInput({
          id,
          createdAt,
          transaction: input,
        }),
      ),
    });
  }

  const fullTransactions = await Promise.all(
    results.map((result) => getFullTransactionData(db, result.id, result.teamId)),
  );

  return fullTransactions.filter((transaction) => transaction !== null);
}
