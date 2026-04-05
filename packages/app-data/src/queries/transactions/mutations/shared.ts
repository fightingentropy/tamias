import type { TransactionRecord } from "../../../convex";
import type { Database } from "../../../client";
import { deleteAccountingSyncRecordsForTransactions } from "../../accounting-sync";
import { createActivity } from "../../activities";
import type { TransactionConvexUserId } from "../shared";

export type TransactionMutationStatus =
  | "pending"
  | "archived"
  | "completed"
  | "posted"
  | "excluded"
  | "exported"
  | null;

type TransactionMutationPatch = {
  categorySlug?: string | null;
  status?: TransactionMutationStatus;
  taxRate?: number | null;
  taxAmount?: number | null;
  taxType?: string | null;
};

export function normalizeTransactionMutationInput(
  input: TransactionMutationPatch & Record<string, unknown>,
): Partial<TransactionRecord> {
  const normalizedInput = { ...input };

  if (normalizedInput.categorySlug !== undefined) {
    normalizedInput.taxRate = null;
    normalizedInput.taxAmount = null;
    normalizedInput.taxType = null;
  }

  return {
    ...normalizedInput,
    status: normalizedInput.status ?? undefined,
  } as Partial<TransactionRecord>;
}

export async function clearAccountingSyncForStatusChange(args: {
  db: Database;
  teamId: string;
  transactionIds: string[];
  status: TransactionMutationStatus | undefined;
}) {
  if (args.status === undefined || args.status === "exported") {
    return;
  }

  await deleteAccountingSyncRecordsForTransactions(args.db, {
    teamId: args.teamId,
    transactionIds: args.transactionIds,
  });
}

export function recordTransactionMutationActivities(args: {
  db: Database;
  teamId: string;
  userId?: TransactionConvexUserId;
  categorySlug?: string | null;
  assignedId?: string | null;
  transactionIds: string[];
}) {
  if (args.transactionIds.length === 0) {
    return;
  }

  if (args.categorySlug) {
    createActivity(args.db, {
      teamId: args.teamId,
      userId: args.userId,
      type: "transactions_categorized",
      source: "user",
      priority: 7,
      metadata: {
        categorySlug: args.categorySlug,
        transactionIds: args.transactionIds,
        transactionCount: args.transactionIds.length,
      },
    });
  }

  if (args.assignedId) {
    createActivity(args.db, {
      teamId: args.teamId,
      userId: args.userId,
      type: "transactions_assigned",
      source: "user",
      priority: 7,
      metadata: {
        assignedUserId: args.assignedId,
        transactionIds: args.transactionIds,
        transactionCount: args.transactionIds.length,
      },
    });
  }
}
