import type { CloudflareD1DatabaseBinding } from "../../client";
import { getTransactionByIdFromD1, upsertTransactionsInD1 } from "../transactions/d1";
import { toTransactionUpsertInput } from "../transactions/shared";
import { transactionHasAttachmentsInD1 } from "./d1";

export async function syncTransactionHasAttachmentFlags(args: {
  d1: CloudflareD1DatabaseBinding;
  teamId: string;
  transactionIds: string[];
}) {
  for (const transactionId of [...new Set(args.transactionIds)]) {
    const [transaction, hasAttachment] = await Promise.all([
      getTransactionByIdFromD1(args.d1, {
        teamId: args.teamId,
        transactionId,
      }),
      transactionHasAttachmentsInD1(args.d1, {
        teamId: args.teamId,
        transactionId,
      }),
    ]);

    if (!transaction || transaction.hasAttachment === hasAttachment) {
      continue;
    }

    await upsertTransactionsInD1(args.d1, {
      teamId: args.teamId,
      transactions: [toTransactionUpsertInput(transaction, { hasAttachment })],
    });
  }
}
