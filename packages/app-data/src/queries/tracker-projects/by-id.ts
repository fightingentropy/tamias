import { getTrackerProjectByIdFromConvex } from "@tamias/app-data-convex";
import type { Database } from "../../client";
import { reuseQueryResult } from "../../utils/request-cache";
import { enrichProjects } from "./enrich";
import type { GetTrackerProjectByIdParams } from "./types";

async function getTrackerProjectByIdImpl(db: Database, params: GetTrackerProjectByIdParams) {
  const project = await getTrackerProjectByIdFromConvex({
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
