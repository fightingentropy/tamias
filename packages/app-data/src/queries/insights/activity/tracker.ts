import {
  getTrackerEntriesByRangeFromConvex,
  getTrackerProjectsByIdsFromConvex,
} from "../../../convex";
import type { Database } from "../../../client";
import type { GetInsightActivityDataParams } from "./types";

type TrackerActivityStats = {
  totalHours: number;
  unbilledHours: number;
  billableAmount: number;
};

export async function getTrackerActivityStats(
  _db: Database,
  params: GetInsightActivityDataParams,
): Promise<TrackerActivityStats> {
  const { teamId, from, to } = params;
  const entries = await getTrackerEntriesByRangeFromConvex({
    teamId,
    from,
    to,
  });
  const projectIds = [
    ...new Set(
      entries
        .map((entry) => entry.projectId)
        .filter((projectId): projectId is string => projectId !== null),
    ),
  ];
  const projects =
    projectIds.length > 0
      ? await getTrackerProjectsByIdsFromConvex({
          teamId,
          projectIds,
        })
      : [];
  const projectById = new Map(projects.map((project) => [project.id, project]));

  let totalSeconds = 0;
  let unbilledSeconds = 0;
  let billableAmount = 0;

  for (const entry of entries) {
    const duration = entry.duration ?? 0;

    totalSeconds += duration;

    if (!entry.billed) {
      unbilledSeconds += duration;
      const rate = Number(
        entry.rate ??
          (entry.projectId ? projectById.get(entry.projectId)?.rate : 0) ??
          0,
      );

      billableAmount += (rate * duration) / 3600;
    }
  }

  return {
    totalHours: Math.round((totalSeconds / 3600) * 10) / 10,
    unbilledHours: Math.round((unbilledSeconds / 3600) * 10) / 10,
    billableAmount: Math.round(billableAmount * 100) / 100,
  };
}
