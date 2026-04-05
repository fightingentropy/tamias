import {
  type CurrentUserIdentityRecord,
  deleteTrackerEntryInConvex,
  getTrackerProjectsByIdsFromConvex,
  startTrackerTimerInConvex,
  stopTrackerTimerInConvex,
  upsertTrackerEntriesInConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../../client";
import { createActivity } from "../activities";
import { enrichTrackerEntries } from "./shared";

type ConvexUserId = CurrentUserIdentityRecord["convexId"];

export type UpsertTrackerEntriesParams = {
  id?: string;
  teamId: string;
  start: string;
  stop: string;
  dates: string[];
  assignedId?: ConvexUserId | null;
  activityUserId?: ConvexUserId;
  projectId: string;
  description?: string | null;
  duration: number;
};

export async function upsertTrackerEntries(
  db: Database,
  params: UpsertTrackerEntriesParams,
) {
  const { dates, id, teamId, activityUserId, ...rest } = params;
  const entries = dates.map((date) => ({
    id: id ?? crypto.randomUUID(),
    teamId,
    date,
    start: rest.start,
    stop: rest.stop,
    assignedId: rest.assignedId,
    projectId: rest.projectId,
    description: rest.description,
    duration: rest.duration,
  }));
  const result = await upsertTrackerEntriesInConvex({
    teamId,
    entries,
  });

  if (!id && result.length > 0) {
    for (const entry of result) {
      createActivity(db, {
        teamId,
        userId: rest.assignedId ?? activityUserId,
        type: "tracker_entry_created",
        source: "user",
        priority: 7,
        metadata: {
          entryId: entry.id,
          projectId: rest.projectId,
          duration: rest.duration,
          dates,
          description: rest.description,
        },
      });
    }
  }

  return enrichTrackerEntries(db, teamId, result);
}

export type BulkCreateTrackerEntriesParams = {
  teamId: string;
  entries: Array<{
    start: string;
    stop: string;
    dates: string[];
    assignedId?: ConvexUserId | null;
    projectId: string;
    description?: string | null;
    duration: number;
  }>;
};

export async function bulkCreateTrackerEntries(
  db: Database,
  params: BulkCreateTrackerEntriesParams,
) {
  const { teamId, entries } = params;
  const flatEntries = entries.flatMap((entry) =>
    entry.dates.map((date) => ({
      id: crypto.randomUUID(),
      teamId,
      date,
      start: entry.start,
      stop: entry.stop,
      assignedId: entry.assignedId,
      projectId: entry.projectId,
      description: entry.description,
      duration: entry.duration,
    })),
  );

  if (flatEntries.length === 0) {
    return [];
  }

  const result = await upsertTrackerEntriesInConvex({
    teamId,
    entries: flatEntries,
  });

  return enrichTrackerEntries(db, teamId, result);
}

export type DeleteTrackerEntryParams = {
  teamId: string;
  id: string;
};

export async function deleteTrackerEntry(
  _db: Database,
  params: DeleteTrackerEntryParams,
) {
  return deleteTrackerEntryInConvex({
    teamId: params.teamId,
    id: params.id,
  });
}

export async function startTimer(
  db: Database,
  params: {
    teamId: string;
    projectId: string;
    assignedId?: ConvexUserId | null;
    description?: string | null;
    start?: string;
  },
) {
  const result = await startTrackerTimerInConvex({
    teamId: params.teamId,
    id: crypto.randomUUID(),
    projectId: params.projectId,
    assignedId: params.assignedId,
    description: params.description,
    start: params.start,
  });
  const [entry] = await enrichTrackerEntries(db, params.teamId, [result]);

  if (!entry) {
    throw new Error("Failed to fetch created timer entry");
  }

  return {
    ...entry,
    project: entry.trackerProject,
  };
}

export async function stopTimer(
  db: Database,
  params: {
    teamId: string;
    entryId?: string;
    assignedId?: ConvexUserId | null;
    stop?: string;
  },
) {
  const result = await stopTrackerTimerInConvex({
    teamId: params.teamId,
    id: params.entryId,
    assignedId: params.assignedId,
    stop: params.stop,
  });

  if ("discarded" in result && result.discarded) {
    const [project] = result.projectId
      ? await getTrackerProjectsByIdsFromConvex({
          teamId: params.teamId,
          projectIds: [result.projectId],
        })
      : [];

    return {
      ...result,
      project: project
        ? {
            id: project.id,
            name: project.name,
          }
        : null,
      trackerProject: project
        ? {
            id: project.id,
            name: project.name,
          }
        : null,
    };
  }

  const [entry] = await enrichTrackerEntries(db, params.teamId, [result]);

  if (!entry) {
    throw new Error("Failed to fetch updated timer entry");
  }

  return {
    ...entry,
    discarded: false as const,
    project: entry.trackerProject,
  };
}
