import type { Database } from "@tamias/app-data/client";
import {
  type GetTrackerProjectsParams,
  getTrackerProjects,
} from "@tamias/app-data/queries/tracker-projects";

export async function getTrackerProjectsPage(args: {
  db: Database;
  teamId: string;
  input?: Omit<GetTrackerProjectsParams, "teamId">;
}) {
  return getTrackerProjects(args.db, {
    teamId: args.teamId,
    ...args.input,
  });
}
