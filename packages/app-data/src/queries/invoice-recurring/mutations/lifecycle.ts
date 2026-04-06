import {
  advanceToFutureDate,
  calculateNextScheduledDate,
  shouldMarkCompleted,
} from "@tamias/invoice/server-recurring";
import type { Database, DatabaseOrTransaction } from "../../../client";
import { getInvoiceRecurringById } from "../reads";
import {
  MAX_CONSECUTIVE_FAILURES,
  buildRecurringParams,
  upsertProjectedInvoiceRecurringRecord,
  type ProjectedInvoiceRecurringRecord,
} from "../shared";

export async function markInvoiceGenerated(
  db: DatabaseOrTransaction,
  params: { id: string; teamId: string },
) {
  const current = await getInvoiceRecurringById(db as Database, params);

  if (!current) {
    return null;
  }

  const now = new Date();
  const newInvoicesGenerated = current.invoicesGenerated + 1;
  const baseDate = current.nextScheduledAt ? new Date(current.nextScheduledAt) : now;
  const initialNextDate = calculateNextScheduledDate(buildRecurringParams(current), baseDate);
  const { date: nextScheduledAt } = advanceToFutureDate(
    buildRecurringParams(current),
    initialNextDate,
    now,
  );
  const isCompleted = shouldMarkCompleted(
    current.endType,
    current.endDate ? new Date(current.endDate) : null,
    current.endCount,
    newInvoicesGenerated,
    nextScheduledAt,
  );

  return upsertProjectedInvoiceRecurringRecord({
    ...current,
    invoicesGenerated: newInvoicesGenerated,
    consecutiveFailures: 0,
    lastGeneratedAt: now.toISOString(),
    nextScheduledAt: isCompleted ? null : nextScheduledAt.toISOString(),
    status: isCompleted ? "completed" : "active",
    updatedAt: now.toISOString(),
  });
}

export async function recordInvoiceGenerationFailure(
  db: Database,
  params: { id: string; teamId: string },
): Promise<{
  result: ProjectedInvoiceRecurringRecord | null;
  autoPaused: boolean;
}> {
  const current = await getInvoiceRecurringById(db, params);

  if (!current) {
    return { result: null, autoPaused: false };
  }

  const newFailureCount = current.consecutiveFailures + 1;
  const shouldAutoPause = newFailureCount >= MAX_CONSECUTIVE_FAILURES;
  const result = await upsertProjectedInvoiceRecurringRecord({
    ...current,
    consecutiveFailures: newFailureCount,
    status: shouldAutoPause ? "paused" : current.status,
    updatedAt: new Date().toISOString(),
  });

  return { result: result ?? null, autoPaused: shouldAutoPause };
}

export async function pauseInvoiceRecurring(
  db: DatabaseOrTransaction,
  params: { id: string; teamId: string },
) {
  const existing = await getInvoiceRecurringById(db as Database, params);

  if (!existing) {
    return null;
  }

  return upsertProjectedInvoiceRecurringRecord({
    ...existing,
    status: "paused",
    updatedAt: new Date().toISOString(),
  });
}

export async function resumeInvoiceRecurring(db: Database, params: { id: string; teamId: string }) {
  const current = await getInvoiceRecurringById(db, params);

  if (!current || current.status !== "paused") {
    return null;
  }

  const now = new Date();
  const nextScheduledAt = calculateNextScheduledDate(buildRecurringParams(current), now);
  const isCompleted = shouldMarkCompleted(
    current.endType,
    current.endDate ? new Date(current.endDate) : null,
    current.endCount,
    current.invoicesGenerated,
    nextScheduledAt,
  );

  if (isCompleted) {
    return upsertProjectedInvoiceRecurringRecord({
      ...current,
      status: "completed",
      nextScheduledAt: null,
      updatedAt: now.toISOString(),
    });
  }

  return upsertProjectedInvoiceRecurringRecord({
    ...current,
    status: "active",
    consecutiveFailures: 0,
    nextScheduledAt: nextScheduledAt.toISOString(),
    updatedAt: now.toISOString(),
  });
}

export async function deleteInvoiceRecurring(
  db: DatabaseOrTransaction,
  params: { id: string; teamId: string },
) {
  const existing = await getInvoiceRecurringById(db as Database, params);

  if (!existing) {
    return null;
  }

  return upsertProjectedInvoiceRecurringRecord({
    ...existing,
    status: "canceled",
    nextScheduledAt: null,
    updatedAt: new Date().toISOString(),
  });
}
