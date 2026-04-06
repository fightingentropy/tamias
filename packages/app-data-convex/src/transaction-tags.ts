import { api, createClient, serviceArgs } from "./base";

export type TagRecord = {
  id: string;
  teamId: string;
  name: string;
  createdAt: string;
};

export type TransactionTagAssignmentRecord = {
  id: string;
  transactionId: string;
  tagId: string;
  teamId: string;
  createdAt: string;
  updatedAt: string;
  tag: {
    id: string;
    name: string;
  };
};

export async function getTagsFromConvex(args: { teamId: string }) {
  return createClient().query(
    api.tags.serviceGetTags,
    serviceArgs({
      teamId: args.teamId,
    }),
  ) as Promise<TagRecord[]>;
}

export async function getTagsByIdsFromConvex(args: { teamId: string; tagIds: string[] }) {
  return createClient().query(
    api.tags.serviceGetTagsByIds,
    serviceArgs({
      teamId: args.teamId,
      tagIds: args.tagIds,
    }),
  ) as Promise<TagRecord[]>;
}

export async function getTagByIdFromConvex(args: { teamId: string; tagId: string }) {
  return createClient().query(
    api.tags.serviceGetTagById,
    serviceArgs({
      teamId: args.teamId,
      tagId: args.tagId,
    }),
  ) as Promise<TagRecord | null>;
}

export async function createTagInConvex(args: { teamId: string; name: string }) {
  return createClient().mutation(
    api.tags.serviceCreateTag,
    serviceArgs({
      teamId: args.teamId,
      name: args.name,
    }),
  ) as Promise<TagRecord>;
}

export async function updateTagInConvex(args: { teamId: string; tagId: string; name: string }) {
  return createClient().mutation(
    api.tags.serviceUpdateTag,
    serviceArgs({
      teamId: args.teamId,
      tagId: args.tagId,
      name: args.name,
    }),
  ) as Promise<TagRecord>;
}

export async function deleteTagInConvex(args: { teamId: string; tagId: string }) {
  return createClient().mutation(
    api.tags.serviceDeleteTag,
    serviceArgs({
      teamId: args.teamId,
      tagId: args.tagId,
    }),
  ) as Promise<{ id: string; name: string } | null>;
}

export async function getTransactionTagAssignmentsForTransactionIdsFromConvex(args: {
  teamId: string;
  transactionIds: string[];
}) {
  return createClient().query(
    api.transactionTags.serviceGetTransactionTagAssignmentsForTransactionIds,
    serviceArgs({
      teamId: args.teamId,
      transactionIds: args.transactionIds,
    }),
  ) as Promise<TransactionTagAssignmentRecord[]>;
}

export async function getTaggedTransactionIdsFromConvex(args: { teamId: string }) {
  return createClient().query(
    api.transactionTags.serviceGetTaggedTransactionIds,
    serviceArgs({
      teamId: args.teamId,
    }),
  ) as Promise<string[]>;
}

export async function rebuildTransactionTagSortFieldsInConvex(args: { teamId?: string | null }) {
  return createClient().mutation(
    api.transactionTags.serviceRebuildTransactionTagSortFields,
    serviceArgs({
      teamId: args.teamId ?? null,
    }),
  ) as Promise<
    Array<{
      teamId: string;
      assignmentCount: number;
      updatedAssignmentCount: number;
      deletedAssignmentCount: number;
    }>
  >;
}

export async function createTransactionTagInConvex(args: {
  teamId: string;
  transactionId: string;
  tagId: string;
}) {
  return createClient().mutation(
    api.transactionTags.serviceCreateTransactionTag,
    serviceArgs({
      teamId: args.teamId,
      transactionId: args.transactionId,
      tagId: args.tagId,
    }),
  ) as Promise<TransactionTagAssignmentRecord>;
}

export async function deleteTransactionTagInConvex(args: {
  teamId: string;
  transactionId: string;
  tagId: string;
}) {
  return createClient().mutation(
    api.transactionTags.serviceDeleteTransactionTag,
    serviceArgs({
      teamId: args.teamId,
      transactionId: args.transactionId,
      tagId: args.tagId,
    }),
  ) as Promise<{ id: string } | null>;
}

export async function addTransactionTagToTransactionsInConvex(args: {
  teamId: string;
  transactionIds: string[];
  tagId: string;
}) {
  return createClient().mutation(
    api.transactionTags.serviceAddTransactionTagToTransactions,
    serviceArgs({
      teamId: args.teamId,
      transactionIds: args.transactionIds,
      tagId: args.tagId,
    }),
  ) as Promise<TransactionTagAssignmentRecord[]>;
}

export async function deleteTransactionTagsForTagInConvex(args: { teamId: string; tagId: string }) {
  return createClient().mutation(
    api.transactionTags.serviceDeleteTransactionTagsForTag,
    serviceArgs({
      teamId: args.teamId,
      tagId: args.tagId,
    }),
  ) as Promise<{ tagId: string }>;
}

export async function deleteTransactionTagsForTransactionsInConvex(args: {
  teamId: string;
  transactionIds: string[];
}) {
  return createClient().mutation(
    api.transactionTags.serviceDeleteTransactionTagsForTransactionIds,
    serviceArgs({
      teamId: args.teamId,
      transactionIds: args.transactionIds,
    }),
  ) as Promise<{ transactionIds: string[] }>;
}
