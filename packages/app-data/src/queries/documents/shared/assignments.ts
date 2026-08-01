import type { Database } from "../../../client";
import {
  deleteDocumentTagAssignmentsForDocument,
  getDocumentTagAssignmentsForDocumentIds,
  type DocumentTagAssignmentRecord,
} from "../../document-tag-assignments";

function groupAssignmentsByDocumentId(assignments: DocumentTagAssignmentRecord[]) {
  const assignmentsByDocumentId = new Map<string, DocumentTagAssignmentRecord[]>();

  for (const assignment of assignments) {
    const current = assignmentsByDocumentId.get(assignment.documentId) ?? [];
    current.push(assignment);
    assignmentsByDocumentId.set(assignment.documentId, current);
  }

  return assignmentsByDocumentId;
}

async function getAssignmentsByDocumentId(db: Database, teamId: string, documentIds: string[]) {
  if (documentIds.length === 0) {
    return new Map<string, DocumentTagAssignmentRecord[]>();
  }

  const assignments = await getDocumentTagAssignmentsForDocumentIds(db, {
    teamId,
    documentIds,
  });

  return groupAssignmentsByDocumentId(assignments);
}

export async function attachAssignments<TDocument extends { id: string }>(
  db: Database,
  teamId: string,
  documents: TDocument[],
) {
  const assignmentsByDocumentId = await getAssignmentsByDocumentId(
    db,
    teamId,
    documents.map((document) => document.id),
  );

  return documents.map((document) => ({
    ...document,
    documentTagAssignments: assignmentsByDocumentId.get(document.id) ?? [],
  }));
}

export async function deleteDocumentTagAssignments(
  db: Database,
  teamId: string,
  documentId: string,
) {
  await deleteDocumentTagAssignmentsForDocument(db, {
    teamId,
    documentId,
  });
}
