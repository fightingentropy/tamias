import {
  type CurrentUserIdentityRecord,
  getTrackerEntriesByDateFromConvex,
  getTrackerEntriesByRangeFromConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../../client";
import { enrichTrackerEntries } from "./shared";

type ConvexUserId = CurrentUserIdentityRecord["convexId"];

export type GetTrackerRecordsByDateParams = {
  teamId: string;
  date: string;
  projectId?: string;
  userId?: ConvexUserId;
};

export async function getTrackerRecordsByDate(db: Database, params: GetTrackerRecordsByDateParams) {
  const { teamId, projectId, date, userId } = params;
  const data = await enrichTrackerEntries(
    db,
    teamId,
    await getTrackerEntriesByDateFromConvex({
      teamId,
      date,
      projectId,
      assignedId: userId,
    }),
  );

  const totalDuration = data.reduce((duration, item) => (item.duration ?? 0) + duration, 0);

  return {
    meta: {
      totalDuration,
    },
    data,
  };
}

export type GetTrackerRecordsByRangeParams = {
  teamId: string;
  from: string;
  to: string;
  projectId?: string;
  userId?: ConvexUserId;
};

export async function getTrackerRecordsByRange(
  db: Database,
  params: GetTrackerRecordsByRangeParams,
) {
  const { teamId, from, to, projectId, userId } = params;
  const data = await enrichTrackerEntries(
    db,
    teamId,
    await getTrackerEntriesByRangeFromConvex({
      teamId,
      from,
      to,
      projectId,
      assignedId: userId,
    }),
  );
  const dataWithProject = data.map((item) => ({
    ...item,
    project: item.trackerProject,
  }));

  type EntryType = (typeof dataWithProject)[number];
  const result = dataWithProject.reduce<Record<string, EntryType[]>>((acc, item) => {
    const dateKey = item.date;

    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }

    acc[dateKey].push(item);
    return acc;
  }, {});

  const totalDuration = data.reduce((duration, item) => duration + (item.duration ?? 0), 0);
  const totalAmount = data.reduce((amount, item) => {
    const rate = item.trackerProject?.rate ?? 0;
    const duration = item.duration ?? 0;
    return amount + (Number(rate) * duration) / 3600;
  }, 0);

  return {
    meta: {
      totalDuration,
      totalAmount,
      from,
      to,
    },
    result,
  };
}
