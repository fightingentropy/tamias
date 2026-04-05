import {
  createDocumentTagAssignmentInConvex,
  deleteDocumentTagAssignmentInConvex,
  upsertDocumentTagAssignmentsInConvex,
} from "../convex";
import type { Database } from "../client";

export type CreateDocumentTagAssignmentParams = {
  documentId: string;
  tagId: string;
  teamId: string;
};

export const createDocumentTagAssignment = async (
  _db: Database,
  params: CreateDocumentTagAssignmentParams,
) => {
  return createDocumentTagAssignmentInConvex({
    documentId: params.documentId,
    tagId: params.tagId,
    teamId: params.teamId,
  });
};

export type DeleteDocumentTagAssignmentParams = {
  documentId: string;
  tagId: string;
  teamId: string;
};

export const deleteDocumentTagAssignment = async (
  _db: Database,
  params: DeleteDocumentTagAssignmentParams,
) => {
  return deleteDocumentTagAssignmentInConvex({
    documentId: params.documentId,
    tagId: params.tagId,
    teamId: params.teamId,
  });
};

export type UpsertDocumentTagAssignmentParams = {
  documentId: string;
  tagId: string;
  teamId: string;
};

export const upsertDocumentTagAssignments = async (
  _db: Database,
  params: UpsertDocumentTagAssignmentParams[],
) => {
  if (params.length === 0) {
    return [];
  }

  return upsertDocumentTagAssignmentsInConvex({
    assignments: params.map((assignment) => ({
      documentId: assignment.documentId,
      tagId: assignment.tagId,
      teamId: assignment.teamId,
    })),
  });
};
