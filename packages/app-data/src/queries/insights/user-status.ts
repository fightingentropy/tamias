import type { Database, DatabaseOrTransaction } from "../../client";
import {
  compareInsightPeriodDesc,
  listTeamInsights,
  type UserId,
  type InsightPeriodType,
  type InsightStatus,
} from "./shared";
import {
  dismissInsightStatus,
  listInsightUserStatuses,
  markInsightStatusAsRead,
  undoDismissInsightStatus,
  type InsightUserStatusRecord,
} from "./store";

export type InsightUserStatus = InsightUserStatusRecord;

export async function getInsightUserStatus(
  db: Database,
  params: { insightId: string; userId: UserId },
): Promise<InsightUserStatus | null> {
  const statuses = await listInsightUserStatuses(db, {
    userId: params.userId,
  });

  return statuses.find((status) => status.insightId === params.insightId) ?? null;
}

export async function markInsightAsRead(
  db: DatabaseOrTransaction,
  params: { insightId: string; userId: UserId },
): Promise<InsightUserStatus> {
  return markInsightStatusAsRead(db, {
    userId: params.userId,
    insightId: params.insightId,
  });
}

export async function dismissInsight(
  db: DatabaseOrTransaction,
  params: { insightId: string; userId: UserId },
): Promise<InsightUserStatus> {
  return dismissInsightStatus(db, {
    userId: params.userId,
    insightId: params.insightId,
  });
}

export async function undoDismissInsight(
  db: DatabaseOrTransaction,
  params: { insightId: string; userId: UserId },
): Promise<InsightUserStatus | null> {
  return undoDismissInsightStatus(db, {
    userId: params.userId,
    insightId: params.insightId,
  });
}

export type GetInsightsForUserParams = {
  teamId: string;
  userId: UserId;
  periodType?: InsightPeriodType;
  includeDismissed?: boolean;
  cursor?: string | null;
  pageSize?: number;
  status?: InsightStatus;
};

export async function getInsightsForUser(db: Database, params: GetInsightsForUserParams) {
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
  const userStatuses = await listInsightUserStatuses(db, { userId });
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

  const nextCursor = data && data.length === pageSize ? (offset + pageSize).toString() : undefined;

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
