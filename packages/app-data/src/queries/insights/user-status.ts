import {
  dismissInsightInConvex,
  getInsightUserStatusesFromConvex,
  markInsightAsReadInConvex,
  undoDismissInsightInConvex,
  type InsightUserStatusRecord,
} from "@tamias/app-data-convex";
import type { Database, DatabaseOrTransaction } from "../../client";
import {
  compareInsightPeriodDesc,
  listTeamInsights,
  type ConvexUserId,
  type InsightPeriodType,
  type InsightStatus,
} from "./shared";

export type InsightUserStatus = InsightUserStatusRecord;

export async function getInsightUserStatus(
  _db: Database,
  params: { insightId: string; userId: ConvexUserId },
): Promise<InsightUserStatus | null> {
  const statuses = await getInsightUserStatusesFromConvex({
    userId: params.userId,
  });

  return (
    statuses.find((status) => status.insightId === params.insightId) ?? null
  );
}

export async function markInsightAsRead(
  _db: DatabaseOrTransaction,
  params: { insightId: string; userId: ConvexUserId },
): Promise<InsightUserStatus> {
  return markInsightAsReadInConvex({
    userId: params.userId,
    insightId: params.insightId,
  });
}

export async function dismissInsight(
  _db: DatabaseOrTransaction,
  params: { insightId: string; userId: ConvexUserId },
): Promise<InsightUserStatus> {
  return dismissInsightInConvex({
    userId: params.userId,
    insightId: params.insightId,
  });
}

export async function undoDismissInsight(
  _db: DatabaseOrTransaction,
  params: { insightId: string; userId: ConvexUserId },
): Promise<InsightUserStatus | null> {
  return undoDismissInsightInConvex({
    userId: params.userId,
    insightId: params.insightId,
  });
}

export type GetInsightsForUserParams = {
  teamId: string;
  userId: ConvexUserId;
  periodType?: InsightPeriodType;
  includeDismissed?: boolean;
  cursor?: string | null;
  pageSize?: number;
  status?: InsightStatus;
};

export async function getInsightsForUser(
  db: Database,
  params: GetInsightsForUserParams,
) {
  const {
    teamId,
    userId,
    periodType,
    includeDismissed = false,
    cursor,
    pageSize = 10,
    status,
  } = params;

  const offset = cursor ? Number.parseInt(cursor, 10) : 0;
  const userStatuses = await getInsightUserStatusesFromConvex({ userId });
  const userStatusByInsightId = new Map(
    userStatuses.map((userStatus) => [userStatus.insightId, userStatus]),
  );
  const dismissedInsightIds = new Set(
    includeDismissed
      ? []
      : userStatuses
          .filter((userStatus) => userStatus.dismissedAt)
          .map((userStatus) => userStatus.insightId),
  );
  const filtered = (await listTeamInsights(db, teamId))
    .filter(
      (insight) =>
        (!periodType || insight.periodType === periodType) &&
        (!status || insight.status === status) &&
        !dismissedInsightIds.has(insight.id),
    )
    .sort(compareInsightPeriodDesc);
  const data = filtered.slice(offset, offset + pageSize);

  const nextCursor =
    data && data.length === pageSize
      ? (offset + pageSize).toString()
      : undefined;

  return {
    meta: {
      cursor: nextCursor ?? null,
      hasPreviousPage: offset > 0,
      hasNextPage: data && data.length === pageSize,
    },
    data: data.map((insight) => ({
      ...insight,
      userStatus: {
        readAt: userStatusByInsightId.get(insight.id)?.readAt ?? null,
        dismissedAt: userStatusByInsightId.get(insight.id)?.dismissedAt ?? null,
      },
    })),
  };
}
