import {
  type CurrentUserIdentityRecord,
  getCurrentTrackerTimerFromConvex,
  getTrackerEntryByIdFromConvex,
} from "../../convex";
import {
  endOfMonth,
  endOfWeek,
  formatISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { Database } from "../../client";
import { getTeamById } from "../teams";
import { getTrackerRecordsByRange } from "./records";
import { enrichTrackerEntries } from "./shared";

type ConvexUserId = CurrentUserIdentityRecord["convexId"];

export type GetCurrentTimerParams = {
  teamId: string;
  assignedId?: ConvexUserId | null;
};

export type GetTimerStatusParams = {
  teamId: string;
  assignedId?: ConvexUserId | null;
};

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
  const entries = await getTrackerRecordsByRange(_db, {
    teamId: params.teamId,
    from: params.from,
    to: params.to,
    userId: params.assignedId,
  });

  const totalDuration = Object.values(entries.result)
    .flat()
    .reduce((duration, entry) => duration + (entry.duration ?? 0), 0);

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
