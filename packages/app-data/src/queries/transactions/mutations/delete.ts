import {
  deleteTransactionsInConvex,
  deleteTransactionTagsForTransactionsInConvex,
  getTransactionsByIdsFromConvex,
  getTransactionsByInternalIdsFromConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../../../client";

type DeleteTransactionsParams = {
  teamId: string;
  ids: string[];
};

async function deleteTransactionRows(args: { teamId: string; transactionIds: string[] }) {
  if (args.transactionIds.length === 0) {
    return;
  }

  await deleteTransactionTagsForTransactionsInConvex({
    teamId: args.teamId,
    transactionIds: args.transactionIds,
  });
  await deleteTransactionsInConvex({
    teamId: args.teamId,
    transactionIds: args.transactionIds,
  });
}

export async function deleteTransactions(_db: Database, params: DeleteTransactionsParams) {
  const deleted = (
    await getTransactionsByIdsFromConvex({
      teamId: params.teamId,
      transactionIds: params.ids,
    })
  )
    .filter((transaction) => transaction.manual)
    .map((transaction) => ({ id: transaction.id }));

  await deleteTransactionRows({
    teamId: params.teamId,
    transactionIds: deleted.map((row) => row.id),
  });

  return deleted;
}

export async function deleteTransactionsByInternalIds(
  _db: Database,
  params: { teamId: string; internalIds: string[] },
) {
  if (params.internalIds.length === 0) {
    return [];
  }

  const fullIds = new Set(params.internalIds.map((id) => `${params.teamId}_${id}`));
  const deleted = (
    await getTransactionsByInternalIdsFromConvex({
      teamId: params.teamId,
      internalIds: [...fullIds],
    })
  )
    .filter((transaction) => fullIds.has(transaction.internalId))
    .map((transaction) => ({ id: transaction.id }));

  await deleteTransactionRows({
    teamId: params.teamId,
    transactionIds: deleted.map((row) => row.id),
  });

  return deleted;
}
