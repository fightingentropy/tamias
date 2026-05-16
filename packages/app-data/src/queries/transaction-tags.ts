import type { Database } from "../client";
import {
  createTransactionTagInD1,
  deleteTransactionTagInD1,
  requireTransactionsD1,
} from "./transactions/d1";

type CreateTransactionTagParams = {
  teamId: string;
  transactionId: string;
  tagId: string;
};

export async function createTransactionTag(db: Database, params: CreateTransactionTagParams) {
  return createTransactionTagInD1(requireTransactionsD1(db), {
    teamId: params.teamId,
    transactionId: params.transactionId,
    tagId: params.tagId,
  });
}

type DeleteTransactionTagParams = {
  transactionId: string;
  tagId: string;
  teamId: string;
};

export async function deleteTransactionTag(db: Database, params: DeleteTransactionTagParams) {
  return deleteTransactionTagInD1(requireTransactionsD1(db), {
    teamId: params.teamId,
    transactionId: params.transactionId,
    tagId: params.tagId,
  });
}
