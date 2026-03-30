import { api, createClient, serviceArgs } from "./base";

export type DocumentTagRecord = {
  id: string;
  teamId: string;
  name: string;
  slug: string;
  createdAt: string;
};

export type UpsertDocumentTagInput = {
  teamId: string;
  name: string;
  slug: string;
};

export type DocumentTagAssignmentRecord = {
  documentId: string;
  tagId: string;
  teamId: string;
  createdAt: string;
  updatedAt: string;
  documentTag: {
    id: string;
    name: string;
    slug: string;
  };
};

export type UpsertDocumentTagAssignmentInput = {
  documentId: string;
  tagId: string;
  teamId: string;
};

export async function getDocumentTagsFromConvex(args: { teamId: string }) {
  return createClient().query(
    api.documentTags.serviceGetDocumentTags,
    serviceArgs({
      teamId: args.teamId,
    }),
  ) as Promise<DocumentTagRecord[]>;
}

export async function createDocumentTagInConvex(args: {
  teamId: string;
  name: string;
  slug: string;
}) {
  return createClient().mutation(
    api.documentTags.serviceCreateDocumentTag,
    serviceArgs({
      teamId: args.teamId,
      name: args.name,
      slug: args.slug,
    }),
  ) as Promise<DocumentTagRecord>;
}

export async function deleteDocumentTagInConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().mutation(
    api.documentTags.serviceDeleteDocumentTag,
    serviceArgs({
      teamId: args.teamId,
      documentTagId: args.id,
    }),
  ) as Promise<{ id: string } | null>;
}

export async function upsertDocumentTagsInConvex(args: {
  tags: UpsertDocumentTagInput[];
}) {
  return createClient().mutation(
    api.documentTags.serviceUpsertDocumentTags,
    serviceArgs({
      tags: args.tags.map((tag) => ({
        teamId: tag.teamId,
        name: tag.name,
        slug: tag.slug,
      })),
    }),
  ) as Promise<Array<{ id: string; slug: string }>>;
}

export async function createDocumentTagAssignmentInConvex(args: {
  teamId: string;
  documentId: string;
  tagId: string;
}) {
  return createClient().mutation(
    api.documentTags.serviceCreateDocumentTagAssignment,
    serviceArgs({
      teamId: args.teamId,
      documentId: args.documentId,
      tagId: args.tagId,
    }),
  ) as Promise<DocumentTagAssignmentRecord>;
}

export async function deleteDocumentTagAssignmentInConvex(args: {
  teamId: string;
  documentId: string;
  tagId: string;
}) {
  return createClient().mutation(
    api.documentTags.serviceDeleteDocumentTagAssignment,
    serviceArgs({
      teamId: args.teamId,
      documentId: args.documentId,
      tagId: args.tagId,
    }),
  ) as Promise<DocumentTagAssignmentRecord | null>;
}

export async function upsertDocumentTagAssignmentsInConvex(args: {
  assignments: UpsertDocumentTagAssignmentInput[];
}) {
  return createClient().mutation(
    api.documentTags.serviceUpsertDocumentTagAssignments,
    serviceArgs({
      assignments: args.assignments.map((assignment) => ({
        teamId: assignment.teamId,
        documentId: assignment.documentId,
        tagId: assignment.tagId,
      })),
    }),
  ) as Promise<DocumentTagAssignmentRecord[]>;
}

export async function getDocumentTagAssignmentsForDocumentIdsFromConvex(args: {
  teamId: string;
  documentIds: string[];
}) {
  return createClient().query(
    api.documentTags.serviceGetDocumentTagAssignmentsForDocumentIds,
    serviceArgs({
      teamId: args.teamId,
      documentIds: args.documentIds,
    }),
  ) as Promise<DocumentTagAssignmentRecord[]>;
}

export async function rebuildDocumentTagAssignmentSortFieldsInConvex(args: {
  teamId?: string | null;
}) {
  return createClient().mutation(
    api.documentTags.serviceRebuildDocumentTagAssignmentSortFields,
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
