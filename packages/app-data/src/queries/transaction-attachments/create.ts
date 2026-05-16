import type { DatabaseOrTransaction } from "../../client";
import { deleteAccountingSyncRecordsForTransactions } from "../accounting-sync";
import { createActivity } from "../activities";
import { createTransactionAttachmentsInD1, requireTransactionAttachmentsD1 } from "./d1";
import { syncTransactionHasAttachmentFlags } from "./sync";
import type { CreateAttachmentsParams } from "./types";

export async function createAttachments(
  db: DatabaseOrTransaction,
  params: CreateAttachmentsParams,
) {
  const { attachments, teamId, userId } = params;
  const d1 = requireTransactionAttachmentsD1(db);
  const { attachments: result, affectedTransactionIds } = await createTransactionAttachmentsInD1(
    d1,
    {
      teamId,
      attachments,
    },
  );

  const transactionIds = [...new Set(affectedTransactionIds)];

  if (transactionIds.length > 0) {
    await syncTransactionHasAttachmentFlags({
      d1,
      teamId,
      transactionIds,
    });
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
