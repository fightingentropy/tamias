import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../client";
import type { activityStatusEnum, activityTypeEnum } from "../../schema";
import type { Activity } from "../activities";

type UserId = string;

type ActivityStatus = (typeof activityStatusEnum.enumValues)[number];
type ActivityType = (typeof activityTypeEnum.enumValues)[number];

type ActivityRow = {
  id: string;
  team_id: string;
  user_id: string | null;
  type: string;
  priority: number | null;
  group_id: string | null;
  source: "system" | "user";
  metadata_json: string;
  status: ActivityStatus;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
};

export type GetActivitiesFromD1Params = {
  teamId: string;
  cursor?: string | null;
  pageSize?: number;
  statuses?: ActivityStatus[] | null;
  userId?: UserId | null;
  priority?: number | null;
  maxPriority?: number | null;
  createdAfter?: string | null;
};

export type FindRecentActivityFromD1Params = {
  teamId: string;
  userId?: UserId;
  type: ActivityType;
  timeWindowMinutes?: number;
};

export type CreateActivityInD1Params = {
  teamId: string;
  userId?: UserId;
  type: ActivityType;
  source: "system" | "user";
  status?: ActivityStatus;
  priority?: number;
  groupId?: string;
  metadata: Record<string, unknown>;
};

export function getActivitiesD1(db: Database) {
  return requireCloudflareD1Database(db);
}

function parseMetadata(value: string): Record<string, unknown> {
  return JSON.parse(value) as Record<string, unknown>;
}

function toActivityRecord(row: ActivityRow): Activity {
  return {
    id: row.id,
    createdAt: row.created_at,
    teamId: row.team_id,
    userId: row.user_id,
    type: row.type as ActivityType,
    priority: row.priority,
    groupId: row.group_id,
    source: row.source,
    metadata: parseMetadata(row.metadata_json),
    status: row.status as ActivityStatus,
    lastUsedAt: row.last_used_at,
  };
}

export async function upsertActivityInD1(
  d1: CloudflareD1DatabaseBinding,
  activity: Activity,
  options: { updatedAt?: string } = {},
) {
  await d1
    .prepare(
      `insert into activities (
        id,
        team_id,
        user_id,
        type,
        priority,
        group_id,
        source,
        metadata_json,
        status,
        created_at,
        updated_at,
        last_used_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        team_id = excluded.team_id,
        user_id = excluded.user_id,
        type = excluded.type,
        priority = excluded.priority,
        group_id = excluded.group_id,
        source = excluded.source,
        metadata_json = excluded.metadata_json,
        status = excluded.status,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        last_used_at = excluded.last_used_at`,
    )
    .bind(
      activity.id,
      activity.teamId,
      activity.userId ?? null,
      activity.type,
      activity.priority ?? null,
      activity.groupId ?? null,
      activity.source,
      JSON.stringify(activity.metadata ?? {}),
      activity.status,
      activity.createdAt,
      options.updatedAt ?? new Date().toISOString(),
      activity.lastUsedAt ?? null,
    )
    .run();
}

export async function createActivityInD1(
  d1: CloudflareD1DatabaseBinding,
  params: CreateActivityInD1Params,
) {
  const timestamp = new Date().toISOString();
  const activity: Activity = {
    id: crypto.randomUUID(),
    createdAt: timestamp,
    teamId: params.teamId,
    userId: params.userId ?? null,
    type: params.type,
    priority: params.priority ?? 5,
    groupId: params.groupId ?? null,
    source: params.source,
    metadata: params.metadata,
    status: params.status ?? "unread",
    lastUsedAt: null,
  };

  await upsertActivityInD1(d1, activity, { updatedAt: timestamp });

  return activity;
}

export async function getActivitiesFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: GetActivitiesFromD1Params,
) {
  const statuses = params.statuses ?? undefined;
  const pageSize = params.pageSize ?? 20;
  const offset = params.cursor ? Number.parseInt(params.cursor, 10) : 0;
  const filters = ["team_id = ?"];
  const values: unknown[] = [params.teamId];

  if (statuses && statuses.length === 0) {
    return {
      meta: {
        cursor: null,
        hasPreviousPage: offset > 0,
        hasNextPage: false,
      },
      data: [],
    };
  }

  if (statuses) {
    filters.push(`status in (${statuses.map(() => "?").join(", ")})`);
    values.push(...statuses);
  }

  if (params.userId) {
    filters.push("user_id = ?");
    values.push(params.userId);
  }

  if (params.priority !== undefined && params.priority !== null) {
    filters.push("priority = ?");
    values.push(params.priority);
  }

  if (params.maxPriority !== undefined && params.maxPriority !== null) {
    filters.push("coalesce(priority, 5) <= ?");
    values.push(params.maxPriority);
  }

  if (params.createdAfter) {
    filters.push("created_at >= ?");
    values.push(params.createdAfter);
  }

  const { results = [] } = await d1
    .prepare(
      `select *
       from activities
       where ${filters.join(" and ")}
       order by created_at desc
       limit ? offset ?`,
    )
    .bind(...values, pageSize, offset)
    .all<ActivityRow>();

  const nextCursor = results.length === pageSize ? String(offset + pageSize) : null;

  return {
    meta: {
      cursor: nextCursor,
      hasPreviousPage: offset > 0,
      hasNextPage: results.length === pageSize,
    },
    data: results.map(toActivityRecord),
  };
}

export async function findRecentActivityFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: FindRecentActivityFromD1Params,
) {
  const timeWindowAgo = new Date(
    Date.now() - (params.timeWindowMinutes ?? 5) * 60 * 1000,
  ).toISOString();
  const filters = ["team_id = ?", "type = ?", "status = 'unread'", "created_at >= ?"];
  const values: unknown[] = [params.teamId, params.type, timeWindowAgo];

  if (params.userId) {
    filters.push("user_id = ?");
    values.push(params.userId);
  }

  const row = await d1
    .prepare(
      `select *
       from activities
       where ${filters.join(" and ")}
       order by created_at desc
       limit 1`,
    )
    .bind(...values)
    .first<ActivityRow>();

  return row ? toActivityRecord(row) : null;
}

export async function getActivityFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: { activityId: string; teamId: string },
) {
  const row = await d1
    .prepare("select * from activities where id = ? and team_id = ? limit 1")
    .bind(params.activityId, params.teamId)
    .first<ActivityRow>();

  return row ? toActivityRecord(row) : null;
}

export async function updateActivityStatusInD1(
  d1: CloudflareD1DatabaseBinding,
  params: { activityId: string; teamId: string; status: ActivityStatus },
) {
  const timestamp = new Date().toISOString();

  await d1
    .prepare(
      `update activities
      set status = ?, updated_at = ?
      where id = ? and team_id = ?`,
    )
    .bind(params.status, timestamp, params.activityId, params.teamId)
    .run();

  return getActivityFromD1(d1, params);
}

export async function updateAllActivitiesStatusInD1(
  d1: CloudflareD1DatabaseBinding,
  params: { teamId: string; userId: UserId; status: ActivityStatus },
) {
  const timestamp = new Date().toISOString();
  const statusFilter =
    params.status === "archived"
      ? "status in ('unread', 'read')"
      : params.status === "read"
        ? "status = 'unread'"
        : "status != ? and status != 'archived'";
  const rowsQuery =
    params.status === "unread"
      ? d1
          .prepare(
            `select *
            from activities
            where team_id = ? and user_id = ? and ${statusFilter}`,
          )
          .bind(params.teamId, params.userId, params.status)
      : d1
          .prepare(
            `select *
            from activities
            where team_id = ? and user_id = ? and ${statusFilter}`,
          )
          .bind(params.teamId, params.userId);
  const { results = [] } = await rowsQuery.all<ActivityRow>();

  if (results.length === 0) {
    return [];
  }

  const ids = results.map((row) => row.id);
  const placeholders = ids.map(() => "?").join(", ");

  await d1
    .prepare(
      `update activities
      set status = ?, updated_at = ?
      where id in (${placeholders})`,
    )
    .bind(params.status, timestamp, ...ids)
    .run();

  return results.map((row) =>
    toActivityRecord({
      ...row,
      status: params.status,
      updated_at: timestamp,
    }),
  );
}

export async function updateActivityMetadataInD1(
  d1: CloudflareD1DatabaseBinding,
  params: { activityId: string; teamId: string; metadata: Record<string, unknown> },
) {
  const timestamp = new Date().toISOString();

  await d1
    .prepare(
      `update activities
      set metadata_json = ?, created_at = ?, updated_at = ?
      where id = ? and team_id = ?`,
    )
    .bind(JSON.stringify(params.metadata), timestamp, timestamp, params.activityId, params.teamId)
    .run();

  return getActivityFromD1(d1, params);
}
