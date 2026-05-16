import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../client";
import type { TrackerEntryRecord, UpsertTrackerEntryInput } from "./shared";

type TrackerEntryRow = {
  id: string;
  team_id: string;
  project_id: string | null;
  assigned_id: string | null;
  description: string | null;
  start: string | null;
  stop: string | null;
  duration: number | null;
  date: string;
  rate: number | null;
  currency: string | null;
  billed: number;
  created_at: string;
  updated_at: string;
};

export function requireTrackerEntriesD1(db: Database) {
  return requireCloudflareD1Database(db);
}

function toBoolean(value: number | boolean) {
  return value === true || value === 1;
}

function toTrackerEntryRecord(row: TrackerEntryRow): TrackerEntryRecord {
  return {
    id: row.id,
    teamId: row.team_id,
    projectId: row.project_id,
    assignedId: row.assigned_id,
    description: row.description,
    start: row.start,
    stop: row.stop,
    duration: row.duration,
    date: row.date,
    rate: row.rate,
    currency: row.currency,
    billed: toBoolean(row.billed),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildEntryFilters(args: {
  teamId: string;
  date?: string;
  from?: string;
  to?: string;
  projectId?: string | null;
  assignedId?: string | null;
}) {
  const clauses = ["team_id = ?"];
  const values: unknown[] = [args.teamId];

  if (args.date) {
    clauses.push("date = ?");
    values.push(args.date);
  }

  if (args.from && args.to) {
    clauses.push("date >= ?", "date <= ?");
    values.push(args.from, args.to);
  }

  if (args.projectId) {
    clauses.push("project_id = ?");
    values.push(args.projectId);
  }

  if (args.assignedId) {
    clauses.push("assigned_id = ?");
    values.push(args.assignedId);
  }

  return { clauses, values };
}

async function getTrackerEntriesFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    date?: string;
    from?: string;
    to?: string;
    projectId?: string | null;
    assignedId?: string | null;
  },
) {
  const { clauses, values } = buildEntryFilters(args);
  const { results = [] } = await d1
    .prepare(
      `select *
       from tracker_entries
       where ${clauses.join(" and ")}
       order by date asc, coalesce(start, '') asc, created_at asc`,
    )
    .bind(...values)
    .all<TrackerEntryRow>();

  return results.map(toTrackerEntryRecord);
}

export function getTrackerEntriesByDateFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    date: string;
    projectId?: string | null;
    assignedId?: string | null;
  },
) {
  return getTrackerEntriesFromD1(d1, args);
}

export function getTrackerEntriesByRangeFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    from: string;
    to: string;
    projectId?: string | null;
    assignedId?: string | null;
  },
) {
  return getTrackerEntriesFromD1(d1, args);
}

export async function getTrackerEntriesByProjectIdsFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: { teamId: string; projectIds: string[] },
) {
  const projectIds = [...new Set(args.projectIds)];

  if (projectIds.length === 0) {
    return [];
  }

  const { results = [] } = await d1
    .prepare(
      `select *
       from tracker_entries
       where team_id = ? and project_id in (${projectIds.map(() => "?").join(", ")})
       order by date asc, coalesce(start, '') asc, created_at asc`,
    )
    .bind(args.teamId, ...projectIds)
    .all<TrackerEntryRow>();

  return results.map(toTrackerEntryRecord);
}

export async function getTrackerEntryByIdFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: { teamId: string; id: string },
) {
  const row = await d1
    .prepare("select * from tracker_entries where team_id = ? and id = ? limit 1")
    .bind(args.teamId, args.id)
    .first<TrackerEntryRow>();

  return row ? toTrackerEntryRecord(row) : null;
}

export async function upsertTrackerEntriesInD1(
  d1: CloudflareD1DatabaseBinding,
  args: { teamId: string; entries: UpsertTrackerEntryInput[] },
) {
  const results: TrackerEntryRecord[] = [];

  for (const entry of args.entries) {
    const timestamp = new Date().toISOString();
    const existing = await getTrackerEntryByIdFromD1(d1, {
      teamId: args.teamId,
      id: entry.id,
    });
    const createdAt = existing?.createdAt ?? timestamp;

    await d1
      .prepare(
        `insert into tracker_entries (
          id, team_id, project_id, assigned_id, description, start, stop, duration,
          date, rate, currency, billed, created_at, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(id) do update set
          team_id = excluded.team_id,
          project_id = excluded.project_id,
          assigned_id = excluded.assigned_id,
          description = excluded.description,
          start = excluded.start,
          stop = excluded.stop,
          duration = excluded.duration,
          date = excluded.date,
          rate = excluded.rate,
          currency = excluded.currency,
          billed = excluded.billed,
          updated_at = excluded.updated_at`,
      )
      .bind(
        entry.id,
        args.teamId,
        entry.projectId ?? null,
        entry.assignedId ?? null,
        entry.description ?? null,
        entry.start ?? null,
        entry.stop ?? null,
        entry.duration ?? null,
        entry.date,
        entry.rate ?? null,
        entry.currency ?? null,
        (entry.billed ?? false) ? 1 : 0,
        createdAt,
        timestamp,
      )
      .run();

    const updated = await getTrackerEntryByIdFromD1(d1, {
      teamId: args.teamId,
      id: entry.id,
    });

    if (!updated) {
      throw new Error("Failed to upsert tracker entry");
    }

    results.push(updated);
  }

  return results;
}

export async function deleteTrackerEntryFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: { teamId: string; id: string },
) {
  const existing = await getTrackerEntryByIdFromD1(d1, args);

  if (!existing) {
    return null;
  }

  await d1
    .prepare("delete from tracker_entries where team_id = ? and id = ?")
    .bind(args.teamId, args.id)
    .run();

  return { id: args.id };
}

export async function getCurrentTrackerTimerFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: { teamId: string; assignedId?: string | null },
) {
  const clauses = ["team_id = ?", "stop is null", "start is not null"];
  const values: unknown[] = [args.teamId];

  if (args.assignedId) {
    clauses.push("assigned_id = ?");
    values.push(args.assignedId);
  }

  const row = await d1
    .prepare(
      `select *
       from tracker_entries
       where ${clauses.join(" and ")}
       order by start desc, created_at desc
       limit 1`,
    )
    .bind(...values)
    .first<TrackerEntryRow>();

  return row ? toTrackerEntryRecord(row) : null;
}

export async function startTrackerTimerInD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    id: string;
    projectId: string;
    assignedId?: string | null;
    description?: string | null;
    start?: string;
  },
) {
  const current = await getCurrentTrackerTimerFromD1(d1, {
    teamId: args.teamId,
    assignedId: args.assignedId,
  });

  if (current?.start) {
    const stopTime = new Date().toISOString();
    const duration = Math.floor(
      (new Date(stopTime).getTime() - new Date(current.start).getTime()) / 1000,
    );

    await upsertTrackerEntriesInD1(d1, {
      teamId: args.teamId,
      entries: [
        {
          ...current,
          stop: stopTime,
          duration,
        },
      ],
    });
  }

  const start = args.start ?? new Date().toISOString();
  const [created] = await upsertTrackerEntriesInD1(d1, {
    teamId: args.teamId,
    entries: [
      {
        id: args.id,
        teamId: args.teamId,
        projectId: args.projectId,
        assignedId: args.assignedId ?? null,
        description: args.description ?? null,
        start,
        stop: null,
        duration: null,
        date: new Date(start).toISOString().split("T")[0] ?? start,
        billed: false,
      },
    ],
  });

  if (!created) {
    throw new Error("Failed to start tracker timer");
  }

  return created;
}

export async function stopTrackerTimerInD1(
  d1: CloudflareD1DatabaseBinding,
  args: { teamId: string; id?: string; assignedId?: string | null; stop?: string },
) {
  const entry = args.id
    ? await getTrackerEntryByIdFromD1(d1, {
        teamId: args.teamId,
        id: args.id,
      })
    : await getCurrentTrackerTimerFromD1(d1, {
        teamId: args.teamId,
        assignedId: args.assignedId,
      });

  if (!entry) {
    throw new Error("No running timer found to stop");
  }

  if (entry.stop) {
    throw new Error("Timer is already stopped");
  }

  if (!entry.start) {
    throw new Error("Timer has no start time");
  }

  const stop = args.stop ?? new Date().toISOString();
  const duration = Math.floor((new Date(stop).getTime() - new Date(entry.start).getTime()) / 1000);

  if (duration < 60) {
    await deleteTrackerEntryFromD1(d1, {
      teamId: args.teamId,
      id: entry.id,
    });

    return {
      id: entry.id,
      discarded: true as const,
      duration,
      projectId: entry.projectId,
      description: entry.description,
      start: entry.start,
      stop: entry.stop,
    };
  }

  const [updated] = await upsertTrackerEntriesInD1(d1, {
    teamId: args.teamId,
    entries: [
      {
        ...entry,
        stop,
        duration,
      },
    ],
  });

  if (!updated) {
    throw new Error("Failed to stop tracker timer");
  }

  return {
    ...updated,
    discarded: false as const,
  };
}
