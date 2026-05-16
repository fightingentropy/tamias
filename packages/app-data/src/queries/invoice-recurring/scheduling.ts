import type { Database } from "../../client";
import {
  getDueInvoiceRecurringSeriesFromD1,
  getUpcomingInvoiceRecurringSeriesFromD1,
  requireInvoiceRecurringD1,
} from "./d1";
import {
  DEFAULT_BATCH_SIZE,
  getProjectedInvoiceRecurringForTeam,
  hydrateProjectedInvoiceRecurringRecords,
  sortRecurringByNextScheduledAtAsc,
} from "./shared";

export async function getDueInvoiceRecurring(db: Database, options?: { limit?: number }) {
  const now = new Date().toISOString();
  const limit = options?.limit ?? DEFAULT_BATCH_SIZE;
  const data = (
    await hydrateProjectedInvoiceRecurringRecords(
      db,
      await getDueInvoiceRecurringSeriesFromD1(requireInvoiceRecurringD1(db), {
        before: now,
        limit: limit + 1,
      }),
    )
  )
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
  db: Database,
  hoursAhead = 24,
  options?: { limit?: number },
) {
  const now = new Date();
  const futureDate = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  const limit = options?.limit ?? 100;
  const nowIso = now.toISOString();
  const futureDateIso = futureDate.toISOString();
  const data = (
    await hydrateProjectedInvoiceRecurringRecords(
      db,
      await getUpcomingInvoiceRecurringSeriesFromD1(requireInvoiceRecurringD1(db), {
        after: nowIso,
        before: futureDateIso,
        limit: limit + 1,
      }),
    )
  )
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
      const cutoff = new Date(nextScheduledAt.getTime() - (hoursAhead + 1) * 60 * 60 * 1000);

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
  db: Database,
  params: {
    teamId: string;
    before: Date;
    limit?: number;
  },
) {
  const now = new Date().toISOString();

  return (await getProjectedInvoiceRecurringForTeam(db, params.teamId))
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
