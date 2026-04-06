import {
  deleteDocumentTagAssignmentInConvex,
  getDocumentTagAssignmentsForDocumentIdsFromConvex,
  type DocumentTagAssignmentRecord,
} from "@tamias/app-data-convex";

function groupAssignmentsByDocumentId(
  assignments: DocumentTagAssignmentRecord[],
) {
  const assignmentsByDocumentId = new Map<
    string,
    DocumentTagAssignmentRecord[]
  >();

  for (const assignment of assignments) {
    const current = assignmentsByDocumentId.get(assignment.documentId) ?? [];
    current.push(assignment);
    assignmentsByDocumentId.set(assignment.documentId, current);
  }

  return assignmentsByDocumentId;
}

async function getAssignmentsByDocumentId(
  teamId: string,
  documentIds: string[],
) {
  if (documentIds.length === 0) {
    return new Map<string, DocumentTagAssignmentRecord[]>();
  }

  const assignments = await getDocumentTagAssignmentsForDocumentIdsFromConvex({
    teamId,
    documentIds,
  });

  return groupAssignmentsByDocumentId(assignments);
}

export async function attachAssignments<TDocument extends { id: string }>(
  teamId: string,
  documents: TDocument[],
) {
  const assignmentsByDocumentId = await getAssignmentsByDocumentId(
    teamId,
    documents.map((document) => document.id),
  );

  return documents.map((document) => ({
    ...document,
    documentTagAssignments: assignmentsByDocumentId.get(document.id) ?? [],
  }));
}

export async function deleteDocumentTagAssignments(
  teamId: string,
  documentId: string,
) {
  const assignments = await getDocumentTagAssignmentsForDocumentIdsFromConvex({
    teamId,
    documentIds: [documentId],
  });

  for (const assignment of assignments) {
    await deleteDocumentTagAssignmentInConvex({
      teamId,
      documentId,
      tagId: assignment.tagId,
    });
  }
}
