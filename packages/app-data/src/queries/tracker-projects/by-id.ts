import type { Database } from "../../client";
import { reuseQueryResult } from "../../utils/request-cache";
import { getTrackerProjectByIdFromD1, requireTrackerProjectsD1 } from "./d1";
import { enrichProjects } from "./enrich";
import type { GetTrackerProjectByIdParams } from "./types";

async function getTrackerProjectByIdImpl(db: Database, params: GetTrackerProjectByIdParams) {
  const project = await getTrackerProjectByIdFromD1(requireTrackerProjectsD1(db), {
    teamId: params.teamId,
    id: params.id,
  });

  if (!project) {
    return null;
  }

  const [enriched] = await enrichProjects(db, params.teamId, [project]);

  return enriched ?? null;
}

export const getTrackerProjectById = reuseQueryResult({
  keyPrefix: "tracker-project-by-id",
  keyFn: (params: GetTrackerProjectByIdParams) => [params.teamId, params.id].join(":"),
  load: getTrackerProjectByIdImpl,
});
