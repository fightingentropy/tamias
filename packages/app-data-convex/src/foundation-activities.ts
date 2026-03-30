import type { ConvexUserId } from "./base";
import { api, createClient, serviceArgs } from "./base";
import type { NotificationStatus } from "./foundation-notifications";

export type ActivityRecord = {
  id: string;
  createdAt: string;
  teamId: string;
  userId: ConvexUserId | null;
  type: string;
  priority: number | null;
  groupId: string | null;
  source: "system" | "user";
  metadata: Record<string, unknown>;
  status: NotificationStatus;
  lastUsedAt: string | null;
};

export type ActivitiesResult = {
  meta: {
    cursor: string | null;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
  data: ActivityRecord[];
};

export async function createActivityInConvex(args: {
  teamId: string;
  userId?: ConvexUserId;
  type: string;
  source: "system" | "user";
  status?: NotificationStatus;
  priority?: number;
  groupId?: string;
  metadata: Record<string, unknown>;
}) {
  return createClient().mutation(
    api.foundation.serviceCreateActivity,
    serviceArgs({
      publicActivityId: crypto.randomUUID(),
      publicTeamId: args.teamId,
      userId: args.userId,
      type: args.type,
      source: args.source,
      status: args.status,
      priority: args.priority,
      groupId: args.groupId,
      metadata: args.metadata,
    }),
  ) as Promise<ActivityRecord>;
}

export async function updateActivityStatusInConvex(args: {
  activityId: string;
  teamId: string;
  status: NotificationStatus;
}) {
  return createClient().mutation(
    api.foundation.serviceUpdateActivityStatus,
    serviceArgs({
      publicActivityId: args.activityId,
      publicTeamId: args.teamId,
      status: args.status,
    }),
  ) as Promise<ActivityRecord | null>;
}

export async function updateAllActivitiesStatusInConvex(args: {
  teamId: string;
  userId: ConvexUserId;
  status: NotificationStatus;
}) {
  return createClient().mutation(
    api.foundation.serviceUpdateAllActivitiesStatus,
    serviceArgs({
      publicTeamId: args.teamId,
      userId: args.userId,
      status: args.status,
    }),
  ) as Promise<ActivityRecord[]>;
}

export async function getActivitiesFromConvex(args: {
  teamId: string;
  cursor?: string | null;
  pageSize?: number;
  statuses?: NotificationStatus[] | null;
  userId?: ConvexUserId | null;
  priority?: number | null;
  maxPriority?: number | null;
  createdAfter?: string | null;
}) {
  return createClient().query(
    api.foundation.serviceGetActivities,
    serviceArgs({
      publicTeamId: args.teamId,
      cursor: args.cursor ?? undefined,
      pageSize: args.pageSize,
      statuses: args.statuses ?? undefined,
      userId: args.userId ?? undefined,
      priority: args.priority ?? undefined,
      maxPriority: args.maxPriority ?? undefined,
      createdAfter: args.createdAfter ?? undefined,
    }),
  ) as Promise<ActivitiesResult>;
}

export async function findRecentActivityInConvex(args: {
  teamId: string;
  userId?: ConvexUserId;
  type: string;
  timeWindowMinutes?: number;
}) {
  return createClient().query(
    api.foundation.serviceFindRecentActivity,
    serviceArgs({
      publicTeamId: args.teamId,
      userId: args.userId,
      type: args.type,
      timeWindowMinutes: args.timeWindowMinutes,
    }),
  ) as Promise<ActivityRecord | null>;
}

export async function updateActivityMetadataInConvex(args: {
  activityId: string;
  teamId: string;
  metadata: Record<string, unknown>;
}) {
  return createClient().mutation(
    api.foundation.serviceUpdateActivityMetadata,
    serviceArgs({
      publicActivityId: args.activityId,
      publicTeamId: args.teamId,
      metadata: args.metadata,
    }),
  ) as Promise<ActivityRecord | null>;
}
