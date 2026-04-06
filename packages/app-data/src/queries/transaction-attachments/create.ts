import { createTransactionAttachmentsInConvex } from "@tamias/app-data-convex";
import type { DatabaseOrTransaction } from "../../client";
import { deleteAccountingSyncRecordsForTransactions } from "../accounting-sync";
import { createActivity } from "../activities";
import type { CreateAttachmentsParams } from "./types";

export async function createAttachments(
  db: DatabaseOrTransaction,
  params: CreateAttachmentsParams,
) {
  const { attachments, teamId, userId } = params;
  const result = await createTransactionAttachmentsInConvex({
    teamId,
    attachments,
  });

  const transactionIds = [
    ...new Set(
      result
        .map((attachment) => attachment.transactionId)
        .filter((id): id is string => id !== null),
    ),
  ];

  if (transactionIds.length > 0) {
    await deleteAccountingSyncRecordsForTransactions(db, {
      teamId,
      transactionIds,
    });
  }

  for (const attachment of result) {
    createActivity(db, {
      teamId,
      userId,
      type: "transaction_attachment_created",
      source: "user",
      priority: 7,
      metadata: {
        attachmentId: attachment.id,
        transactionId: attachment.transactionId,
        fileName: attachment.name,
        fileSize: attachment.size,
        fileType: attachment.type,
      },
    });
  }

  return result;
}
