import {
  getTransactionByIdFromConvex,
  getTransactionsByIdsFromConvex,
  getTransactionsPageFromConvex,
  upsertTransactionsInConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../../client";
import { reuseQueryResult } from "../../utils/request-cache";
import {
  deleteAccountingSyncRecordsForTransactions,
  getAccountingSyncStatus,
} from "../accounting-sync";
import { toConvexTransactionInput } from "./shared";

const READY_FOR_EXPORT_COUNT_BATCH_SIZE = 250;

async function getTransactionsReadyForExportCountImpl(
  db: Database,
  teamId: string,
): Promise<number> {
  let cursor: string | null | undefined = null;
  let count = 0;

  while (true) {
    const result = await getTransactionsPageFromConvex({
      teamId,
      cursor,
      pageSize: READY_FOR_EXPORT_COUNT_BATCH_SIZE,
      statusesNotIn: ["exported", "excluded", "archived"],
    });

    if (result.page.length === 0) {
      break;
    }

    const transactionIds = result.page.map((transaction) => transaction.id);
    const accountingSyncRecords = await getAccountingSyncStatus(db, {
      teamId,
      transactionIds,
    });
    const syncedTransactionIdSet = new Set(
      accountingSyncRecords
        .filter((record) => record.status === "synced")
        .map((record) => record.transactionId),
    );

    count += result.page.filter(
      (transaction) =>
        !syncedTransactionIdSet.has(transaction.id) &&
        (transaction.status === "completed" || transaction.hasAttachment),
    ).length;

    if (result.isDone) {
      break;
    }

    cursor = result.continueCursor;
  }

  return count;
}

export const getTransactionsReadyForExportCount = reuseQueryResult({
  keyPrefix: "transactions-review-count",
  keyFn: (teamId: string) => teamId,
  load: getTransactionsReadyForExportCountImpl,
});

export async function markTransactionsAsExported(
  _db: Database,
  transactionIds: string[],
  teamId: string,
): Promise<void> {
  if (transactionIds.length === 0) return;

  const currentTransactions = await getTransactionsByIdsFromConvex({
    teamId,
    transactionIds,
  });

  if (currentTransactions.length === 0) {
    return;
  }

  await upsertTransactionsInConvex({
    teamId,
    transactions: currentTransactions.map((transaction) =>
      toConvexTransactionInput(transaction, {
        status: "exported",
      }),
    ),
  });
}

export async function moveTransactionToReview(
  db: Database,
  params: { transactionId: string; teamId: string },
): Promise<void> {
  const transaction = await getTransactionByIdFromConvex({
    teamId: params.teamId,
    transactionId: params.transactionId,
  });

  if (transaction?.status === "exported") {
    await upsertTransactionsInConvex({
      teamId: params.teamId,
      transactions: [
        toConvexTransactionInput(transaction, {
          status: "posted",
        }),
      ],
    });
  }

  await deleteAccountingSyncRecordsForTransactions(db, {
    teamId: params.teamId,
    transactionIds: [params.transactionId],
  });
}
