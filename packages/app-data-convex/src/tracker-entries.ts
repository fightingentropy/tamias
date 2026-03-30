import type { ConvexUserId } from "./base";
import { convexApi, createClient, serviceArgs } from "./base";

export type TrackerEntryRecord = {
  id: string;
  teamId: string;
  projectId: string | null;
  assignedId: ConvexUserId | null;
  description: string | null;
  start: string | null;
  stop: string | null;
  duration: number | null;
  date: string;
  rate: number | null;
  currency: string | null;
  billed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UpsertTrackerEntryInput = {
  id: string;
  teamId: string;
  projectId?: string | null;
  assignedId?: ConvexUserId | null;
  description?: string | null;
  start?: string | null;
  stop?: string | null;
  duration?: number | null;
  date: string;
  rate?: number | null;
  currency?: string | null;
  billed?: boolean | null;
};

export async function getTrackerEntriesByDateFromConvex(args: {
  teamId: string;
  date: string;
  projectId?: string | null;
  assignedId?: ConvexUserId | null;
}) {
  return createClient().query(
    convexApi.trackerEntries.serviceGetTrackerEntriesByDate,
    serviceArgs({
      teamId: args.teamId,
      date: args.date,
      projectId: args.projectId,
      assignedId: args.assignedId,
    }),
  ) as Promise<TrackerEntryRecord[]>;
}

export async function getTrackerEntriesByRangeFromConvex(args: {
  teamId: string;
  from: string;
  to: string;
  projectId?: string | null;
  assignedId?: ConvexUserId | null;
}) {
  return createClient().query(
    convexApi.trackerEntries.serviceGetTrackerEntriesByRange,
    serviceArgs({
      teamId: args.teamId,
      from: args.from,
      to: args.to,
      projectId: args.projectId,
      assignedId: args.assignedId,
    }),
  ) as Promise<TrackerEntryRecord[]>;
}

export async function getTrackerEntriesByProjectIdsFromConvex(args: {
  teamId: string;
  projectIds: string[];
}) {
  return createClient().query(
    convexApi.trackerEntries.serviceGetTrackerEntriesByProjectIds,
    serviceArgs({
      teamId: args.teamId,
      projectIds: args.projectIds,
    }),
  ) as Promise<TrackerEntryRecord[]>;
}

export async function getTrackerEntryByIdFromConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().query(
    convexApi.trackerEntries.serviceGetTrackerEntryById,
    serviceArgs({
      teamId: args.teamId,
      id: args.id,
    }),
  ) as Promise<TrackerEntryRecord | null>;
}

export async function upsertTrackerEntriesInConvex(args: {
  teamId: string;
  entries: UpsertTrackerEntryInput[];
}) {
  return createClient().mutation(
    convexApi.trackerEntries.serviceUpsertTrackerEntries,
    serviceArgs({
      teamId: args.teamId,
      entries: args.entries.map((entry) => ({
        id: entry.id,
        date: entry.date,
        projectId: entry.projectId,
        assignedId: entry.assignedId,
        description: entry.description,
        start: entry.start,
        stop: entry.stop,
        duration: entry.duration,
        rate: entry.rate,
        currency: entry.currency,
        billed: entry.billed,
      })),
    }),
  ) as Promise<TrackerEntryRecord[]>;
}

export async function deleteTrackerEntryInConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().mutation(
    convexApi.trackerEntries.serviceDeleteTrackerEntry,
    serviceArgs({
      teamId: args.teamId,
      id: args.id,
    }),
  ) as Promise<{ id: string } | null>;
}

export async function getCurrentTrackerTimerFromConvex(args: {
  teamId: string;
  assignedId?: ConvexUserId | null;
}) {
  return createClient().query(
    convexApi.trackerEntries.serviceGetCurrentTrackerTimer,
    serviceArgs({
      teamId: args.teamId,
      assignedId: args.assignedId,
    }),
  ) as Promise<TrackerEntryRecord | null>;
}

export async function startTrackerTimerInConvex(args: {
  teamId: string;
  id: string;
  projectId: string;
  assignedId?: ConvexUserId | null;
  description?: string | null;
  start?: string;
}) {
  return createClient().mutation(
    convexApi.trackerEntries.serviceStartTrackerTimer,
    serviceArgs({
      teamId: args.teamId,
      id: args.id,
      projectId: args.projectId,
      assignedId: args.assignedId,
      description: args.description,
      start: args.start,
    }),
  ) as Promise<TrackerEntryRecord>;
}

export async function stopTrackerTimerInConvex(args: {
  teamId: string;
  id?: string;
  assignedId?: ConvexUserId | null;
  stop?: string;
}) {
  return createClient().mutation(
    convexApi.trackerEntries.serviceStopTrackerTimer,
    serviceArgs({
      teamId: args.teamId,
      id: args.id,
      assignedId: args.assignedId,
      stop: args.stop,
    }),
  ) as Promise<
    | (TrackerEntryRecord & {
        discarded?: false;
      })
    | {
        id: string;
        discarded: true;
        duration: number;
        projectId: string | null;
        description: string | null;
        start: string | null;
        stop: string | null;
      }
  >;
}
