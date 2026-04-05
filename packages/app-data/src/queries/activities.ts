import {
  type ActivityRecord,
  type CurrentUserIdentityRecord,
  createActivityInConvex,
  findRecentActivityInConvex,
  getActivitiesFromConvex,
  updateActivityMetadataInConvex,
  updateActivityStatusInConvex,
  updateAllActivitiesStatusInConvex,
} from "../convex";
import type { Database, DatabaseOrTransaction } from "../client";
import type { activityStatusEnum, activityTypeEnum } from "../schema";

type ConvexUserId = CurrentUserIdentityRecord["convexId"];

export type Activity = {
  id: string;
  createdAt: string;
  teamId: string;
  userId: ConvexUserId | null;
  type: (typeof activityTypeEnum.enumValues)[number];
  priority: number | null;
  groupId: string | null;
  source: "system" | "user";
  metadata: Record<string, any>;
  status: (typeof activityStatusEnum.enumValues)[number];
  lastUsedAt: string | null;
};

function toActivity(record: ActivityRecord): Activity {
  return {
    ...record,
    type: record.type as Activity["type"],
    status: record.status as Activity["status"],
    metadata: record.metadata as Record<string, any>,
  };
}

type CreateActivityParams = {
  teamId: string;
  userId?: ConvexUserId;
  type: (typeof activityTypeEnum.enumValues)[number];
  source: "system" | "user";
  status?: (typeof activityStatusEnum.enumValues)[number];
  priority?: number;
  groupId?: string;
  metadata: Record<string, any>;
};

export async function createActivity(
  _db: DatabaseOrTransaction,
  params: CreateActivityParams,
): Promise<Activity> {
  const record = await createActivityInConvex({
    teamId: params.teamId,
    userId: params.userId,
    type: params.type,
    source: params.source,
    status: params.status,
    priority: params.priority,
    groupId: params.groupId,
    metadata: params.metadata,
  });

  return toActivity(record);
}

export async function updateActivityStatus(
  _db: Database,
  activityId: string,
  status: (typeof activityStatusEnum.enumValues)[number],
  teamId: string,
): Promise<Activity | null> {
  const record = await updateActivityStatusInConvex({
    activityId,
    teamId,
    status,
  });

  return record ? toActivity(record) : null;
}

export async function updateAllActivitiesStatus(
  _db: Database,
  teamId: string,
  status: (typeof activityStatusEnum.enumValues)[number],
  options: { userId: ConvexUserId },
): Promise<Activity[]> {
  const records = await updateAllActivitiesStatusInConvex({
    teamId,
    userId: options.userId,
    status,
  });

  return records.map(toActivity);
}

export type GetActivitiesParams = {
  teamId: string;
  cursor?: string | null;
  pageSize?: number;
  status?:
    | (typeof activityStatusEnum.enumValues)[number][]
    | (typeof activityStatusEnum.enumValues)[number]
    | null;
  userId?: ConvexUserId | null;
  priority?: number | null;
  maxPriority?: number | null;
  createdAfter?: string | null;
};

export async function getActivities(
  _db: Database,
  params: GetActivitiesParams,
): Promise<{
  meta: {
    cursor: string | null;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
  data: Activity[];
}> {
  const statuses =
    typeof params.status === "string"
      ? [params.status]
      : params.status ?? undefined;

  const result = await getActivitiesFromConvex({
    teamId: params.teamId,
    cursor: params.cursor,
    pageSize: params.pageSize,
    statuses,
    userId: params.userId,
    priority: params.priority,
    maxPriority: params.maxPriority,
    createdAfter: params.createdAfter,
  });

  return {
    ...result,
    data: result.data.map(toActivity),
  };
}

export type FindRecentInboxNewActivityParams = {
  teamId: string;
  userId?: ConvexUserId;
  timeWindowMinutes?: number;
};

export async function findRecentInboxNewActivity(
  _db: Database,
  params: FindRecentInboxNewActivityParams,
): Promise<Activity | null> {
  const record = await findRecentActivityInConvex({
    ...params,
    type: "inbox_new",
  });

  return record ? toActivity(record) : null;
}

export type FindRecentActivityParams = {
  teamId: string;
  userId?: ConvexUserId;
  type: (typeof activityTypeEnum.enumValues)[number];
  timeWindowMinutes?: number;
};

export async function findRecentActivity(
  _db: Database,
  params: FindRecentActivityParams,
): Promise<Activity | null> {
  const record = await findRecentActivityInConvex({
    teamId: params.teamId,
    userId: params.userId,
    type: params.type,
    timeWindowMinutes: params.timeWindowMinutes,
  });

  return record ? toActivity(record) : null;
}

export type UpdateActivityMetadataParams = {
  activityId: string;
  teamId: string;
  metadata: Record<string, any>;
};

export async function updateActivityMetadata(
  _db: Database,
  params: UpdateActivityMetadataParams,
): Promise<Activity | null> {
  const record = await updateActivityMetadataInConvex({
    activityId: params.activityId,
    teamId: params.teamId,
    metadata: params.metadata,
  });

  return record ? toActivity(record) : null;
}
