import type { Database } from "../../../client";
import { getInvoiceRecurringById } from "../reads";
import { upsertProjectedInvoiceRecurringRecord } from "../shared";

export async function markUpcomingNotificationSent(
  db: Database,
  params: { id: string; teamId: string },
) {
  const existing = await getInvoiceRecurringById(db, params);

  if (!existing) {
    return null;
  }

  const timestamp = new Date().toISOString();

  return upsertProjectedInvoiceRecurringRecord({
    ...existing,
    upcomingNotificationSentAt: timestamp,
    updatedAt: timestamp,
  });
}
