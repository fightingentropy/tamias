import {
  getDueInvoiceRecurringSeriesFromConvex,
  getUpcomingInvoiceRecurringSeriesFromConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../../client";
import {
  DEFAULT_BATCH_SIZE,
  getProjectedInvoiceRecurringForTeam,
  getProjectedInvoiceRecurringPayload,
  sortRecurringByNextScheduledAtAsc,
} from "./shared";

export async function getDueInvoiceRecurring(
  _db: Database,
  options?: { limit?: number },
) {
  const now = new Date().toISOString();
  const limit = options?.limit ?? DEFAULT_BATCH_SIZE;
  const data = (
    await getDueInvoiceRecurringSeriesFromConvex({
      before: now,
      limit: limit + 1,
    })
  )
    .map(getProjectedInvoiceRecurringPayload)
    .filter(
      (record): record is NonNullable<typeof record> =>
        !!record &&
        record.status === "active" &&
        !!record.nextScheduledAt &&
        record.nextScheduledAt <= now,
    )
    .sort(sortRecurringByNextScheduledAtAsc);

  const hasMore = data.length > limit;

  return {
    data: hasMore ? data.slice(0, limit) : data,
    hasMore,
  };
}

export async function getUpcomingDueRecurring(
  _db: Database,
  hoursAhead = 24,
  options?: { limit?: number },
) {
  const now = new Date();
  const futureDate = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  const limit = options?.limit ?? 100;
  const nowIso = now.toISOString();
  const futureDateIso = futureDate.toISOString();
  const data = (
    await getUpcomingInvoiceRecurringSeriesFromConvex({
      after: nowIso,
      before: futureDateIso,
      limit: limit + 1,
    })
  )
    .map(getProjectedInvoiceRecurringPayload)
    .filter(
      (record): record is NonNullable<typeof record> =>
        !!record &&
        record.status === "active" &&
        !!record.nextScheduledAt &&
        record.nextScheduledAt > nowIso &&
        record.nextScheduledAt <= futureDateIso,
    )
    .filter((record) => {
      if (!record.upcomingNotificationSentAt || !record.nextScheduledAt) {
        return true;
      }

      const notificationSentAt = new Date(record.upcomingNotificationSentAt);
      const nextScheduledAt = new Date(record.nextScheduledAt);
      const cutoff = new Date(
        nextScheduledAt.getTime() - (hoursAhead + 1) * 60 * 60 * 1000,
      );

      return notificationSentAt <= cutoff;
    })
    .sort(sortRecurringByNextScheduledAtAsc);

  const hasMore = data.length > limit;

  return {
    data: hasMore ? data.slice(0, limit) : data,
    hasMore,
  };
}

export async function getUpcomingDueRecurringByTeam(
  _db: Database,
  params: {
    teamId: string;
    before: Date;
    limit?: number;
  },
) {
  const now = new Date().toISOString();

  return (await getProjectedInvoiceRecurringForTeam(params.teamId))
    .filter(
      (record) =>
        record.status === "active" &&
        !!record.nextScheduledAt &&
        record.nextScheduledAt > now &&
        record.nextScheduledAt <= params.before.toISOString(),
    )
    .sort(sortRecurringByNextScheduledAtAsc)
    .slice(0, params.limit ?? 10)
    .map((record) => ({
      id: record.id,
      teamId: record.teamId,
      customerId: record.customerId,
      customerName: record.customerName,
      frequency: record.frequency,
      nextScheduledAt: record.nextScheduledAt,
      amount: record.amount,
      currency: record.currency,
    }));
}
