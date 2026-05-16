import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../client";
import type { TrackerProjectRecord, TrackerProjectTagAssignmentRecord } from "./types";

type TrackerProjectRow = {
  id: string;
  team_id: string;
  name: string;
  description: string | null;
  status: TrackerProjectRecord["status"];
  customer_id: string | null;
  estimate: number | null;
  currency: string | null;
  billable: number;
  rate: number | null;
  created_at: string;
  updated_at: string;
};

type TrackerProjectTagAssignmentRow = {
  tracker_project_id: string;
  tag_id: string;
  team_id: string;
  created_at: string;
  updated_at: string;
};

export function requireTrackerProjectsD1(db: Database) {
  return requireCloudflareD1Database(db);
}

function toBoolean(value: number | boolean) {
  return value === true || value === 1;
}

function buildSearchText(project: {
  name: string;
  description?: string | null;
  status?: TrackerProjectRecord["status"] | null;
  currency?: string | null;
}) {
  return [project.name, project.description, project.status, project.currency]
    .map((value) => value?.trim().toLowerCase() ?? "")
    .filter(Boolean)
    .join("\n");
}

function toTrackerProjectRecord(row: TrackerProjectRow): TrackerProjectRecord {
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    description: row.description,
    status: row.status,
    customerId: row.customer_id,
    estimate: row.estimate,
    currency: row.currency,
    billable: toBoolean(row.billable),
    rate: row.rate,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toTrackerProjectTagAssignmentRecord(
  row: TrackerProjectTagAssignmentRow,
): TrackerProjectTagAssignmentRecord {
  return {
    trackerProjectId: row.tracker_project_id,
    tagId: row.tag_id,
    teamId: row.team_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getTrackerProjectsFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    status?: TrackerProjectRecord["status"] | null;
    tagIds?: string[] | null;
    order?: "asc" | "desc";
  },
) {
  const clauses = ["p.team_id = ?"];
  const values: unknown[] = [args.teamId];

  if (args.status) {
    clauses.push("p.status = ?");
    values.push(args.status);
  }

  const tagIds = [...new Set(args.tagIds ?? [])];

  if (tagIds.length > 0) {
    clauses.push(
      `exists (
        select 1 from tracker_project_tag_assignments a
        where a.team_id = p.team_id
          and a.tracker_project_id = p.id
          and a.tag_id in (${tagIds.map(() => "?").join(", ")})
      )`,
    );
    values.push(...tagIds);
  }

  const order = args.order === "asc" ? "asc" : "desc";
  const { results = [] } = await d1
    .prepare(
      `select p.*
       from tracker_projects p
       where ${clauses.join(" and ")}
       order by p.created_at ${order}, p.id ${order}`,
    )
    .bind(...values)
    .all<TrackerProjectRow>();

  return results.map(toTrackerProjectRecord);
}

export async function getTrackerProjectsPageFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    cursor?: string | null;
    pageSize: number;
    status?: TrackerProjectRecord["status"] | null;
    order?: "asc" | "desc";
  },
) {
  const pageSize = Math.max(1, args.pageSize);
  const offset = args.cursor ? Number.parseInt(args.cursor, 10) || 0 : 0;
  const projects = await getTrackerProjectsFromD1(d1, args);
  const page = projects.slice(offset, offset + pageSize);
  const nextOffset = offset + pageSize;

  return {
    page,
    isDone: nextOffset >= projects.length,
    continueCursor: nextOffset < projects.length ? String(nextOffset) : "",
  };
}

export async function searchTrackerProjectsFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    query: string;
    status?: TrackerProjectRecord["status"] | null;
    limit?: number;
  },
) {
  const normalized = args.query.trim().toLowerCase();

  if (!normalized) {
    return [];
  }

  const clauses = ["team_id = ?", "search_text like ?"];
  const values: unknown[] = [args.teamId, `%${normalized}%`];

  if (args.status) {
    clauses.push("status = ?");
    values.push(args.status);
  }

  values.push(Math.max(1, args.limit ?? 100));
  const { results = [] } = await d1
    .prepare(
      `select *
       from tracker_projects
       where ${clauses.join(" and ")}
       order by created_at desc, id desc
       limit ?`,
    )
    .bind(...values)
    .all<TrackerProjectRow>();

  return results.map(toTrackerProjectRecord);
}

export async function getTrackerProjectsByIdsFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: { teamId: string; projectIds: string[] },
) {
  const ids = [...new Set(args.projectIds)];

  if (ids.length === 0) {
    return [];
  }

  const { results = [] } = await d1
    .prepare(
      `select *
       from tracker_projects
       where team_id = ? and id in (${ids.map(() => "?").join(", ")})`,
    )
    .bind(args.teamId, ...ids)
    .all<TrackerProjectRow>();

  const byId = new Map(results.map((row) => [row.id, toTrackerProjectRecord(row)]));
  return ids.flatMap((id) => {
    const project = byId.get(id);
    return project ? [project] : [];
  });
}

export async function getTrackerProjectsByCustomerIdsFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: { teamId: string; customerIds: string[] },
) {
  const ids = [...new Set(args.customerIds)];

  if (ids.length === 0) {
    return [];
  }

  const { results = [] } = await d1
    .prepare(
      `select *
       from tracker_projects
       where team_id = ? and customer_id in (${ids.map(() => "?").join(", ")})
       order by created_at desc, id desc`,
    )
    .bind(args.teamId, ...ids)
    .all<TrackerProjectRow>();

  return results.map(toTrackerProjectRecord);
}

export async function getTrackerProjectByIdFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: { teamId: string; id: string },
) {
  const row = await d1
    .prepare("select * from tracker_projects where team_id = ? and id = ? limit 1")
    .bind(args.teamId, args.id)
    .first<TrackerProjectRow>();

  return row ? toTrackerProjectRecord(row) : null;
}

export async function upsertTrackerProjectInD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    id: string;
    teamId: string;
    name: string;
    description?: string | null;
    status?: TrackerProjectRecord["status"] | null;
    customerId?: string | null;
    estimate?: number | null;
    currency?: string | null;
    billable?: boolean | null;
    rate?: number | null;
  },
) {
  const timestamp = new Date().toISOString();
  const existing = await getTrackerProjectByIdFromD1(d1, args);
  const status = args.status ?? existing?.status ?? "in_progress";
  const createdAt = existing?.createdAt ?? timestamp;
  const project = {
    id: args.id,
    teamId: args.teamId,
    name: args.name,
    description: args.description ?? null,
    status,
    customerId: args.customerId ?? null,
    estimate: args.estimate ?? null,
    currency: args.currency ?? null,
    billable: args.billable ?? existing?.billable ?? false,
    rate: args.rate ?? null,
    createdAt,
    updatedAt: timestamp,
  } satisfies TrackerProjectRecord;

  await d1
    .prepare(
      `insert into tracker_projects (
        id, team_id, name, description, status, customer_id, estimate, currency,
        billable, rate, search_text, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        team_id = excluded.team_id,
        name = excluded.name,
        description = excluded.description,
        status = excluded.status,
        customer_id = excluded.customer_id,
        estimate = excluded.estimate,
        currency = excluded.currency,
        billable = excluded.billable,
        rate = excluded.rate,
        search_text = excluded.search_text,
        updated_at = excluded.updated_at`,
    )
    .bind(
      project.id,
      project.teamId,
      project.name,
      project.description,
      project.status,
      project.customerId,
      project.estimate,
      project.currency,
      project.billable ? 1 : 0,
      project.rate,
      buildSearchText(project),
      project.createdAt,
      project.updatedAt,
    )
    .run();

  return project;
}

export async function deleteTrackerProjectFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: { teamId: string; id: string },
) {
  const project = await getTrackerProjectByIdFromD1(d1, args);

  if (!project) {
    return null;
  }

  await d1
    .prepare("delete from tracker_entries where team_id = ? and project_id = ?")
    .bind(args.teamId, args.id)
    .run();
  await d1
    .prepare(
      "delete from tracker_project_tag_assignments where team_id = ? and tracker_project_id = ?",
    )
    .bind(args.teamId, args.id)
    .run();
  await d1
    .prepare("delete from tracker_projects where team_id = ? and id = ?")
    .bind(args.teamId, args.id)
    .run();

  return { id: args.id };
}

export async function getTrackerProjectAssignmentsForProjectIdsFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: { teamId: string; trackerProjectIds: string[] },
) {
  const ids = [...new Set(args.trackerProjectIds)];

  if (ids.length === 0) {
    return [];
  }

  const { results = [] } = await d1
    .prepare(
      `select tracker_project_id, tag_id, team_id, created_at, updated_at
       from tracker_project_tag_assignments
       where team_id = ? and tracker_project_id in (${ids.map(() => "?").join(", ")})
       order by created_at asc`,
    )
    .bind(args.teamId, ...ids)
    .all<TrackerProjectTagAssignmentRow>();

  return results.map(toTrackerProjectTagAssignmentRecord);
}

export async function replaceTrackerProjectTagsInD1(
  d1: CloudflareD1DatabaseBinding,
  args: { teamId: string; trackerProjectId: string; tagIds: string[] },
) {
  const project = await getTrackerProjectByIdFromD1(d1, {
    teamId: args.teamId,
    id: args.trackerProjectId,
  });

  if (!project) {
    throw new Error("Tracker project tag target not found");
  }

  const timestamp = new Date().toISOString();
  const tagIds = [...new Set(args.tagIds)];

  await d1
    .prepare(
      "delete from tracker_project_tag_assignments where team_id = ? and tracker_project_id = ?",
    )
    .bind(args.teamId, args.trackerProjectId)
    .run();

  for (const tagId of tagIds) {
    await d1
      .prepare(
        `insert into tracker_project_tag_assignments (
          tracker_project_id, tag_id, team_id, project_created_at, created_at, updated_at
        ) values (?, ?, ?, ?, ?, ?)`,
      )
      .bind(args.trackerProjectId, tagId, args.teamId, project.createdAt, timestamp, timestamp)
      .run();
  }

  return getTrackerProjectAssignmentsForProjectIdsFromD1(d1, {
    teamId: args.teamId,
    trackerProjectIds: [args.trackerProjectId],
  });
}

export async function deleteTrackerProjectTagsForTagInD1(
  d1: CloudflareD1DatabaseBinding,
  args: { teamId: string; tagId: string },
) {
  await d1
    .prepare("delete from tracker_project_tag_assignments where team_id = ? and tag_id = ?")
    .bind(args.teamId, args.tagId)
    .run();

  return { tagId: args.tagId };
}
