import type { Database, DatabaseOrTransaction } from "../client";
import type { activityStatusEnum, activityTypeEnum } from "../schema";
import {
  createActivityInD1,
  findRecentActivityFromD1,
  getActivitiesD1,
  getActivitiesFromD1,
  updateActivityMetadataInD1,
  updateActivityStatusInD1,
  updateAllActivitiesStatusInD1,
} from "./activities/d1";

type UserId = string;

export type Activity = {
  id: string;
  createdAt: string;
  teamId: string;
  userId: UserId | null;
  type: (typeof activityTypeEnum.enumValues)[number];
  priority: number | null;
  groupId: string | null;
  source: "system" | "user";
  metadata: Record<string, any>;
  status: (typeof activityStatusEnum.enumValues)[number];
  lastUsedAt: string | null;
};

type CreateActivityParams = {
  teamId: string;
  userId?: UserId;
  type: (typeof activityTypeEnum.enumValues)[number];
  source: "system" | "user";
  status?: (typeof activityStatusEnum.enumValues)[number];
  priority?: number;
  groupId?: string;
  metadata: Record<string, any>;
};

function requireActivitiesD1(db: DatabaseOrTransaction) {
  const d1 = getActivitiesD1(db);

  if (!d1) {
    throw new Error("Activities require Cloudflare D1");
  }

  return d1;
}

export async function createActivity(
  db: DatabaseOrTransaction,
  params: CreateActivityParams,
): Promise<Activity> {
  return createActivityInD1(requireActivitiesD1(db), params);
}

export async function updateActivityStatus(
  db: Database,
  activityId: string,
  status: (typeof activityStatusEnum.enumValues)[number],
  teamId: string,
): Promise<Activity | null> {
  return updateActivityStatusInD1(requireActivitiesD1(db), {
    activityId,
    teamId,
    status,
  });
}

export async function updateAllActivitiesStatus(
  db: Database,
  teamId: string,
  status: (typeof activityStatusEnum.enumValues)[number],
  options: { userId: UserId },
): Promise<Activity[]> {
  return updateAllActivitiesStatusInD1(requireActivitiesD1(db), {
    teamId,
    userId: options.userId,
    status,
  });
}

export type GetActivitiesParams = {
  teamId: string;
  cursor?: string | null;
  pageSize?: number;
  status?:
    | (typeof activityStatusEnum.enumValues)[number][]
    | (typeof activityStatusEnum.enumValues)[number]
    | null;
  userId?: UserId | null;
  priority?: number | null;
  maxPriority?: number | null;
  createdAfter?: string | null;
};

export async function getActivities(
  db: Database,
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
    typeof params.status === "string" ? [params.status] : (params.status ?? undefined);

  return getActivitiesFromD1(requireActivitiesD1(db), {
    teamId: params.teamId,
    cursor: params.cursor,
    pageSize: params.pageSize,
    statuses,
    userId: params.userId,
    priority: params.priority,
    maxPriority: params.maxPriority,
    createdAfter: params.createdAfter,
  });
}

export type FindRecentInboxNewActivityParams = {
  teamId: string;
  userId?: UserId;
  timeWindowMinutes?: number;
};

export async function findRecentInboxNewActivity(
  db: Database,
  params: FindRecentInboxNewActivityParams,
): Promise<Activity | null> {
  return findRecentActivityFromD1(requireActivitiesD1(db), {
    ...params,
    type: "inbox_new",
  });
}

export type FindRecentActivityParams = {
  teamId: string;
  userId?: UserId;
  type: (typeof activityTypeEnum.enumValues)[number];
  timeWindowMinutes?: number;
};

export async function findRecentActivity(
  db: Database,
  params: FindRecentActivityParams,
): Promise<Activity | null> {
  return findRecentActivityFromD1(requireActivitiesD1(db), params);
}

export type UpdateActivityMetadataParams = {
  activityId: string;
  teamId: string;
  metadata: Record<string, any>;
};

export async function updateActivityMetadata(
  db: Database,
  params: UpdateActivityMetadataParams,
): Promise<Activity | null> {
  return updateActivityMetadataInD1(requireActivitiesD1(db), params);
}
