import type {
  CurrentUserIdentityRecord,
  TransactionAttachmentRecord,
} from "@tamias/app-data-convex";

export type ConvexUserId = CurrentUserIdentityRecord["convexId"];

export type Attachment = {
  type: string;
  name: string;
  size: number;
  path: string[];
  transactionId?: string;
};

export type StoredTransactionAttachment = TransactionAttachmentRecord;

export type CreateAttachmentsParams = {
  attachments: Attachment[];
  teamId: string;
  userId?: ConvexUserId;
};
