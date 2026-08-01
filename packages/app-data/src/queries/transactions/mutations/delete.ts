import type { Database } from "../../../client";
import { syncDeletedTransactionComplianceJournalEntries } from "../../compliance/ledger";
import {
  deleteTransactionsInD1,
  getTransactionsByIdsFromD1,
  getTransactionsByInternalIdsFromD1,
  requireTransactionsD1,
} from "../d1";

type DeleteTransactionsParams = {
  teamId: string;
  ids: string[];
};

async function deleteTransactionRows(
  db: Database,
  args: { teamId: string; transactionIds: string[] },
) {
  if (args.transactionIds.length === 0) {
    return;
  }

  await deleteTransactionsInD1(requireTransactionsD1(db), {
    teamId: args.teamId,
    transactionIds: args.transactionIds,
  });
}

export async function deleteTransactions(db: Database, params: DeleteTransactionsParams) {
  const deleted = (
    await getTransactionsByIdsFromD1(requireTransactionsD1(db), {
      teamId: params.teamId,
      transactionIds: params.ids,
    })
  )
    .filter((transaction) => transaction.manual)
    .map((transaction) => ({ id: transaction.id }));

  await deleteTransactionRows(db, {
    teamId: params.teamId,
    transactionIds: deleted.map((row) => row.id),
  });
  await syncDeletedTransactionComplianceJournalEntries(db, {
    teamId: params.teamId,
    transactionIds: deleted.map((row) => row.id),
  });

  return deleted;
}

export async function deleteTransactionsByInternalIds(
  db: Database,
  params: { teamId: string; internalIds: string[] },
) {
  if (params.internalIds.length === 0) {
    return [];
  }

  const fullIds = new Set(params.internalIds.map((id) => `${params.teamId}_${id}`));
  const deleted = (
    await getTransactionsByInternalIdsFromD1(requireTransactionsD1(db), {
      teamId: params.teamId,
      internalIds: [...fullIds],
    })
  )
    .filter((transaction) => fullIds.has(transaction.internalId))
    .map((transaction) => ({ id: transaction.id }));

  await deleteTransactionRows(db, {
    teamId: params.teamId,
    transactionIds: deleted.map((row) => row.id),
  });
  await syncDeletedTransactionComplianceJournalEntries(db, {
    teamId: params.teamId,
    transactionIds: deleted.map((row) => row.id),
  });

  return deleted;
}
