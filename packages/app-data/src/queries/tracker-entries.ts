import {
  endOfMonth,
  endOfWeek,
  formatISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  deleteTrackerEntryInConvex,
  type CurrentUserIdentityRecord,
  getCustomersByIdsFromConvex,
  getCurrentTrackerTimerFromConvex,
  getTeamMembersFromConvexIdentity,
  getTrackerEntriesByDateFromConvex,
  getTrackerEntriesByRangeFromConvex,
  getTrackerEntryByIdFromConvex,
  getTrackerProjectsByIdsFromConvex,
  startTrackerTimerInConvex,
  stopTrackerTimerInConvex,
  upsertTrackerEntriesInConvex,
  type TrackerEntryRecord,
  type TrackerProjectRecord,
} from "@tamias/app-data-convex";
import type { Database } from "../client";
import { createActivity } from "./activities";
import { getTeamById } from "./index";

type ConvexUserId = CurrentUserIdentityRecord["convexId"];

type GetTrackerRecordsByDateParams = {
  teamId: string;
  date: string;
  projectId?: string;
  userId?: ConvexUserId;
};

type EnrichedTrackerProject = TrackerProjectRecord & {
  customer: {
    id: string;
    name: string | null;
    website: string | null;
  } | null;
};

type EnrichedTrackerEntry = TrackerEntryRecord & {
  user: {
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
  } | null;
  trackerProject: EnrichedTrackerProject | null;
};

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

async function getCustomersByIds(teamId: string, customerIds: string[]) {
  if (customerIds.length === 0) {
    return new Map<
      string,
      {
        id: string;
        name: string | null;
        website: string | null;
      }
    >();
  }

  const rows = await getCustomersByIdsFromConvex({
    teamId,
    customerIds: [...new Set(customerIds)],
  });

  return new Map(rows.map((row) => [row.id, row]));
}

async function getUsersByIds(
  _db: Database,
  teamId: string,
  assignedIds: string[],
) {
  if (assignedIds.length === 0) {
    return new Map<
      string,
      {
        id: string;
        fullName: string | null;
        avatarUrl: string | null;
      }
    >();
  }

  const assignedIdSet = new Set(assignedIds);

  return new Map(
    (await getTeamMembersFromConvexIdentity({ teamId }))
      .filter((member) => assignedIdSet.has(member.user.convexId))
      .map((member) => [
        member.user.convexId,
        {
          id: member.user.convexId,
          fullName: member.user.fullName,
          avatarUrl: member.user.avatarUrl,
        },
      ]),
  );
}

async function enrichTrackerEntries(
  db: Database,
  teamId: string,
  entries: TrackerEntryRecord[],
): Promise<EnrichedTrackerEntry[]> {
  const projectIds = [
    ...new Set(entries.map((entry) => entry.projectId).filter(isDefined)),
  ];
  const projects = await getTrackerProjectsByIdsFromConvex({
    teamId,
    projectIds,
  });
  const customersById = await getCustomersByIds(
    teamId,
    projects.map((project) => project.customerId).filter(isDefined),
  );
  const projectById = new Map<string, EnrichedTrackerProject>(
    projects.map((project) => [
      project.id,
      {
        ...project,
        customer: project.customerId
          ? (customersById.get(project.customerId) ?? {
              id: project.customerId,
              name: null,
              website: null,
            })
          : null,
      },
    ]),
  );
  const usersById = await getUsersByIds(
    db,
    teamId,
    entries.map((entry) => entry.assignedId).filter(isDefined),
  );

  return entries.map((entry) => ({
    ...entry,
    user: entry.assignedId ? (usersById.get(entry.assignedId) ?? null) : null,
    trackerProject: entry.projectId
      ? (projectById.get(entry.projectId) ?? null)
      : null,
  }));
}

export async function getTrackerRecordsByDate(
  db: Database,
  params: GetTrackerRecordsByDateParams,
) {
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

  const totalDuration = data.reduce(
    (duration, item) => (item.duration ?? 0) + duration,
    0,
  );

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
  const result = dataWithProject.reduce<Record<string, EntryType[]>>(
    (acc, item) => {
      const dateKey = item.date;

      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }

      acc[dateKey].push(item);
      return acc;
    },
    {},
  );

  const totalDuration = data.reduce(
    (duration, item) => duration + (item.duration ?? 0),
    0,
  );
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

export type StartTimerParams = {
  teamId: string;
  projectId: string;
  assignedId?: ConvexUserId | null;
  description?: string | null;
  start?: string;
};

export type StopTimerParams = {
  teamId: string;
  entryId?: string;
  assignedId?: ConvexUserId | null;
  stop?: string;
};

export type GetCurrentTimerParams = {
  teamId: string;
  assignedId?: ConvexUserId | null;
};

export type GetTimerStatusParams = {
  teamId: string;
  assignedId?: ConvexUserId | null;
};

export async function startTimer(db: Database, params: StartTimerParams) {
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

export async function stopTimer(db: Database, params: StopTimerParams) {
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

export async function getCurrentTimer(
  db: Database,
  params: GetCurrentTimerParams,
) {
  const result = await getCurrentTrackerTimerFromConvex({
    teamId: params.teamId,
    assignedId: params.assignedId,
  });

  if (!result) {
    return null;
  }

  const [entry] = await enrichTrackerEntries(db, params.teamId, [result]);

  if (!entry) {
    return null;
  }

  return {
    ...entry,
    project: entry.trackerProject,
  };
}

export async function getTimerStatus(
  db: Database,
  params: GetTimerStatusParams,
) {
  const currentTimer = await getCurrentTimer(db, params);

  if (!currentTimer) {
    return {
      isRunning: false,
      currentEntry: null,
      elapsedTime: 0,
    };
  }

  let elapsedTime = 0;
  if (currentTimer.start) {
    const startTime = new Date(currentTimer.start).getTime();
    const currentTime = Date.now();
    elapsedTime = Math.floor((currentTime - startTime) / 1000);
  }

  return {
    isRunning: true,
    currentEntry: {
      id: currentTimer.id,
      start: currentTimer.start,
      description: currentTimer.description,
      projectId: currentTimer.projectId ?? null,
      trackerProject: {
        id: currentTimer.trackerProject?.id ?? null,
        name: currentTimer.trackerProject?.name ?? null,
      },
    },
    elapsedTime,
  };
}

export type GetTrackedTimeParams = {
  teamId: string;
  from: string;
  to: string;
  assignedId?: ConvexUserId;
};

export async function getTrackedTime(
  _db: Database,
  params: GetTrackedTimeParams,
) {
  const entries = await getTrackerEntriesByRangeFromConvex({
    teamId: params.teamId,
    from: params.from,
    to: params.to,
    assignedId: params.assignedId,
  });

  const totalDuration = entries.reduce(
    (duration, entry) => duration + (entry.duration ?? 0),
    0,
  );

  return {
    totalDuration,
    from: params.from,
    to: params.to,
  };
}

export type GetBillableHoursParams = {
  teamId: string;
  date: string;
  view: "week" | "month";
  weekStartsOnMonday?: boolean;
};

export type BillableHoursResult = {
  totalDuration: number;
  totalAmount: number;
  earningsByCurrency: Record<string, number>;
  projectBreakdown: Array<{
    id: string;
    name: string;
    duration: number;
    amount: number;
    currency: string;
  }>;
  currency: string;
};

export async function getBillableHours(
  db: Database,
  params: GetBillableHoursParams,
): Promise<BillableHoursResult> {
  const { teamId, date, view, weekStartsOnMonday = false } = params;
  const currentDate = new Date(date);
  let from: string;
  let to: string;

  if (view === "week") {
    const weekStart = startOfWeek(currentDate, {
      weekStartsOn: weekStartsOnMonday ? 1 : 0,
    });
    const weekEnd = endOfWeek(currentDate, {
      weekStartsOn: weekStartsOnMonday ? 1 : 0,
    });
    from = formatISO(weekStart, { representation: "date" });
    to = formatISO(weekEnd, { representation: "date" });
  } else {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const extendedStart = new Date(monthStart);
    extendedStart.setDate(extendedStart.getDate() - 1);
    const extendedEnd = new Date(monthEnd);
    extendedEnd.setDate(extendedEnd.getDate() + 1);
    from = formatISO(extendedStart, { representation: "date" });
    to = formatISO(extendedEnd, { representation: "date" });
  }

  const data = await getTrackerRecordsByRange(db, {
    teamId,
    from,
    to,
  });
  const team = await getTeamById(db, teamId);
  const baseCurrency = team?.baseCurrency || "USD";

  if (!data?.result) {
    return {
      totalDuration: 0,
      totalAmount: 0,
      earningsByCurrency: {},
      projectBreakdown: [],
      currency: baseCurrency,
    };
  }

  let totalDuration = 0;
  const earningsByCurrency: Record<string, number> = {};
  const projects: Record<
    string,
    {
      id: string;
      name: string;
      duration: number;
      amount: number;
      currency: string;
    }
  > = {};

  for (const entry of Object.values(data.result).flat()) {
    if (entry.duration) {
      totalDuration += entry.duration;
    }

    if (
      entry.trackerProject?.billable &&
      entry.trackerProject?.rate &&
      entry.duration
    ) {
      const projectId = entry.trackerProject.id;
      const projectName = entry.trackerProject.name;
      const currency = entry.trackerProject.currency || baseCurrency;
      const rate = Number(entry.trackerProject.rate);
      const hours = entry.duration / 3600;
      const earning = rate * hours;

      earningsByCurrency[currency] =
        (earningsByCurrency[currency] || 0) + earning;

      if (projects[projectId]) {
        projects[projectId].duration += entry.duration;
        projects[projectId].amount += earning;
      } else {
        projects[projectId] = {
          id: projectId,
          name: projectName,
          duration: entry.duration,
          amount: earning,
          currency,
        };
      }
    }
  }

  return {
    totalDuration,
    totalAmount: earningsByCurrency[baseCurrency] || 0,
    earningsByCurrency,
    projectBreakdown: Object.values(projects).sort(
      (a, b) => b.amount - a.amount,
    ),
    currency: baseCurrency,
  };
}

export type GetTrackerEntryByIdParams = {
  id: string;
  teamId: string;
};

export async function getTrackerEntryById(
  _db: Database,
  params: GetTrackerEntryByIdParams,
) {
  return getTrackerEntryByIdFromConvex({
    teamId: params.teamId,
    id: params.id,
  });
}
