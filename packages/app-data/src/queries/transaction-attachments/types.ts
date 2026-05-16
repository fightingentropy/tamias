export type AttachmentUserId = string;

export type Attachment = {
  publicTransactionAttachmentId?: string;
  type: string;
  name: string;
  size: number;
  path: string[];
  transactionId?: string;
};

export type StoredTransactionAttachment = {
  id: string;
  teamId: string;
  transactionId: string | null;
  type: string;
  name: string;
  size: number;
  path: string[];
  createdAt: string;
};

export type CreateAttachmentsParams = {
  attachments: Attachment[];
  teamId: string;
  userId?: AttachmentUserId;
};
