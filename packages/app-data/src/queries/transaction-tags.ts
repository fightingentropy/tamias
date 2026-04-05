import {
  createTransactionTagInConvex,
  deleteTransactionTagInConvex,
} from "../convex";
import type { Database } from "../client";

type CreateTransactionTagParams = {
  teamId: string;
  transactionId: string;
  tagId: string;
};

export async function createTransactionTag(
  _db: Database,
  params: CreateTransactionTagParams,
) {
  return createTransactionTagInConvex({
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

export async function deleteTransactionTag(
  _db: Database,
  params: DeleteTransactionTagParams,
) {
  return deleteTransactionTagInConvex({
    teamId: params.teamId,
    transactionId: params.transactionId,
    tagId: params.tagId,
  });
}
