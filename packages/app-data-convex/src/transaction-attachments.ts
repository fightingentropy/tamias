import { api, createClient, serviceArgs } from "./base";

const apiWithTransactionAttachments = api as typeof api & {
  transactionAttachments: {
    serviceCreateTransactionAttachments: any;
    serviceGetTransactionAttachment: any;
    serviceGetTransactionAttachmentsByIds: any;
    serviceGetTransactionAttachmentsForTransactionIds: any;
    serviceGetTransactionAttachmentsByPathKeys: any;
    serviceDeleteTransactionAttachment: any;
    serviceDeleteTransactionAttachmentsByIds: any;
    serviceDeleteTransactionAttachmentsByPathKeys: any;
    serviceRebuildTransactionAttachmentFlags: any;
  };
};

export type TransactionAttachmentRecord = {
  id: string;
  transactionId: string | null;
  teamId: string;
  name: string | null;
  path: string[] | null;
  type: string | null;
  size: number | null;
  createdAt: string;
};

export type CreateTransactionAttachmentInput = {
  transactionId?: string | null;
  name: string;
  path: string[];
  type: string;
  size: number;
};

export async function createTransactionAttachmentsInConvex(args: {
  teamId: string;
  userId?: string;
  attachments: CreateTransactionAttachmentInput[];
}) {
  return createClient().mutation(
    apiWithTransactionAttachments.transactionAttachments.serviceCreateTransactionAttachments,
    serviceArgs({
      publicTeamId: args.teamId,
      attachments: args.attachments,
    }),
  ) as Promise<TransactionAttachmentRecord[]>;
}

export async function getTransactionAttachmentFromConvex(args: {
  teamId: string;
  transactionId: string;
  attachmentId: string;
}) {
  return createClient().query(
    apiWithTransactionAttachments.transactionAttachments.serviceGetTransactionAttachment,
    serviceArgs({
      publicTeamId: args.teamId,
      transactionId: args.transactionId,
      attachmentId: args.attachmentId,
    }),
  ) as Promise<TransactionAttachmentRecord | null>;
}

export async function getTransactionAttachmentsByIdsFromConvex(args: {
  teamId: string;
  attachmentIds: string[];
}) {
  return createClient().query(
    apiWithTransactionAttachments.transactionAttachments.serviceGetTransactionAttachmentsByIds,
    serviceArgs({
      publicTeamId: args.teamId,
      ids: args.attachmentIds,
    }),
  ) as Promise<TransactionAttachmentRecord[]>;
}

export async function getTransactionAttachmentsForTransactionIdsFromConvex(args: {
  teamId: string;
  transactionIds: string[];
}) {
  return createClient().query(
    apiWithTransactionAttachments.transactionAttachments
      .serviceGetTransactionAttachmentsForTransactionIds,
    serviceArgs({
      publicTeamId: args.teamId,
      transactionIds: args.transactionIds,
    }),
  ) as Promise<TransactionAttachmentRecord[]>;
}

export async function getTransactionAttachmentsByPathKeysFromConvex(args: {
  teamId: string;
  pathKeys: string[][];
}) {
  return createClient().query(
    apiWithTransactionAttachments.transactionAttachments.serviceGetTransactionAttachmentsByPathKeys,
    serviceArgs({
      publicTeamId: args.teamId,
      pathKeys: args.pathKeys,
    }),
  ) as Promise<TransactionAttachmentRecord[]>;
}

export async function deleteTransactionAttachmentInConvex(args: {
  teamId: string;
  attachmentId: string;
}) {
  return createClient().mutation(
    apiWithTransactionAttachments.transactionAttachments.serviceDeleteTransactionAttachment,
    serviceArgs({
      publicTeamId: args.teamId,
      id: args.attachmentId,
    }),
  ) as Promise<TransactionAttachmentRecord | null>;
}

export async function deleteTransactionAttachmentsByIdsInConvex(args: {
  teamId: string;
  attachmentIds: string[];
}) {
  return createClient().mutation(
    apiWithTransactionAttachments.transactionAttachments.serviceDeleteTransactionAttachmentsByIds,
    serviceArgs({
      publicTeamId: args.teamId,
      ids: args.attachmentIds,
    }),
  ) as Promise<{ deletedIds: string[]; count: number }>;
}

export async function deleteTransactionAttachmentsByPathKeysInConvex(args: {
  teamId: string;
  pathKeys: string[][];
}) {
  return createClient().mutation(
    apiWithTransactionAttachments.transactionAttachments
      .serviceDeleteTransactionAttachmentsByPathKeys,
    serviceArgs({
      publicTeamId: args.teamId,
      pathKeys: args.pathKeys,
    }),
  ) as Promise<{ deletedIds: string[]; count: number }>;
}

export async function rebuildTransactionAttachmentFlagsInConvex(args: { teamId?: string | null }) {
  return createClient().mutation(
    apiWithTransactionAttachments.transactionAttachments.serviceRebuildTransactionAttachmentFlags,
    serviceArgs({
      publicTeamId: args.teamId ?? null,
    }),
  ) as Promise<
    Array<{
      teamId: string;
      transactionCount: number;
      updatedTransactionCount: number;
    }>
  >;
}
