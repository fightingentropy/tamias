import type { Database } from "@tamias/app-data/client";
import {
  type GetDocumentsParams,
  getDocuments,
} from "@tamias/app-data/queries/documents";

export async function getDocumentsPage(args: {
  db: Database;
  teamId: string;
  input?: Omit<GetDocumentsParams, "teamId">;
}) {
  return getDocuments(args.db, {
    teamId: args.teamId,
    ...args.input,
  });
}
