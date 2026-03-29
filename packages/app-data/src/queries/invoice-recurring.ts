import { UTCDate } from "@date-fns/utc";
import {
  type CurrentUserIdentityRecord,
  getCustomerByIdFromConvex,
  getDueInvoiceRecurringSeriesFromConvex,
  getInvoiceRecurringSeriesByLegacyIdFromConvex,
  getInvoiceRecurringSeriesByTeamFromConvex,
  getUpcomingInvoiceRecurringSeriesFromConvex,
  upsertInvoiceRecurringSeriesInConvex,
} from "@tamias/app-data-convex";
import { addMonths, endOfMonth, format, parseISO } from "date-fns";
import type {
  Database,
  DatabaseOrTransaction,
} from "../client";
import {
  getProjectedInvoiceByRecurringSequence,
  getProjectedInvoicesByRecurringId,
} from "./invoice-projections";
import {
  RECURRING_STATUSES,
  advanceToFutureDate,
  calculateFirstScheduledDate,
  calculateNextScheduledDate,
  calculateUpcomingDates,
  type InvoiceRecurringEndType,
  type InvoiceRecurringFrequency,
  type InvoiceRecurringStatus,
  type RecurringInvoiceParams,
  shouldMarkCompleted,
} from "@tamias/invoice/server-recurring";

type ConvexUserId = CurrentUserIdentityRecord["convexId"];

export type CreateInvoiceRecurringParams = {
  teamId: string;
  userId: ConvexUserId;
  customerId?: string | null;
  customerName?: string | null;
  frequency: InvoiceRecurringFrequency;
  frequencyDay?: number | null;
  frequencyWeek?: number | null;
  frequencyInterval?: number | null;
  endType: InvoiceRecurringEndType;
  endDate?: string | null;
  endCount?: number | null;
  timezone: string;
  dueDateOffset?: number;
  amount?: number | null;
  currency?: string | null;
  lineItems?: unknown;
  template?: unknown;
  paymentDetails?: unknown;
  fromDetails?: unknown;
  noteDetails?: unknown;
  vat?: number | null;
  tax?: number | null;
  discount?: number | null;
  subtotal?: number | null;
  topBlock?: unknown;
  bottomBlock?: unknown;
  templateId?: string | null;
  /**
   * Optional issue date for the first invoice.
   * If provided and in the future, the first invoice will be scheduled for this date.
   * If not provided or in the past, the first invoice is generated immediately.
   */
  issueDate?: string | null;
};

function hasOwnKey(object: object, key: string) {
  return Object.hasOwn(object, key);
}

export async function createInvoiceRecurring(
  _db: DatabaseOrTransaction,
  params: CreateInvoiceRecurringParams,
) {
  const {
    teamId,
    userId,
    customerId,
    customerName,
    frequency,
    frequencyDay,
    frequencyWeek,
    frequencyInterval,
    endType,
    endDate,
    endCount,
    timezone,
    dueDateOffset = 30,
    amount,
    currency,
    lineItems,
    template,
    paymentDetails,
    fromDetails,
    noteDetails,
    vat,
    tax,
    discount,
    subtotal,
    topBlock,
    bottomBlock,
    templateId,
    issueDate,
  } = params;

  // Calculate the first scheduled date based on issue date
  // If issue date is in the future, schedule for that date; otherwise generate immediately
  const now = new Date();
  const recurringParams: RecurringInvoiceParams = {
    frequency,
    frequencyDay: frequencyDay ?? null,
    frequencyWeek: frequencyWeek ?? null,
    frequencyInterval: frequencyInterval ?? null,
    timezone,
  };

  // Use provided issue date or default to now
  const issueDateParsed = issueDate ? new Date(issueDate) : now;
  const firstScheduledAt = calculateFirstScheduledDate(
    recurringParams,
    issueDateParsed,
    now,
  );
  const timestamp = now.toISOString();

  return upsertProjectedInvoiceRecurringRecord({
    id: crypto.randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
    teamId,
    userId,
    customerId: customerId ?? null,
    frequency,
    frequencyDay: frequencyDay ?? null,
    frequencyWeek: frequencyWeek ?? null,
    frequencyInterval: frequencyInterval ?? null,
    endType,
    endDate: endDate ?? null,
    endCount: endCount ?? null,
    status: "active",
    invoicesGenerated: 0,
    consecutiveFailures: 0,
    nextScheduledAt: firstScheduledAt.toISOString(),
    lastGeneratedAt: null,
    upcomingNotificationSentAt: null,
    timezone,
    dueDateOffset,
    amount: amount ?? null,
    currency: currency ?? null,
    lineItems: lineItems ?? null,
    template: template ?? null,
    paymentDetails: paymentDetails ?? null,
    fromDetails: fromDetails ?? null,
    noteDetails: noteDetails ?? null,
    customerName: customerName ?? null,
    vat: vat ?? null,
    tax: tax ?? null,
    discount: discount ?? null,
    subtotal: subtotal ?? null,
    topBlock: topBlock ?? null,
    bottomBlock: bottomBlock ?? null,
    templateId: templateId ?? null,
  });
}

export type UpdateInvoiceRecurringParams = {
  id: string;
  teamId: string;
  customerId?: string | null;
  customerName?: string | null;
  frequency?: InvoiceRecurringFrequency;
  frequencyDay?: number | null;
  frequencyWeek?: number | null;
  frequencyInterval?: number | null;
  endType?: InvoiceRecurringEndType;
  endDate?: string | null;
  endCount?: number | null;
  timezone?: string;
  dueDateOffset?: number;
  amount?: number | null;
  currency?: string | null;
  lineItems?: unknown;
  template?: unknown;
  paymentDetails?: unknown;
  fromDetails?: unknown;
  noteDetails?: unknown;
  vat?: number | null;
  tax?: number | null;
  discount?: number | null;
  subtotal?: number | null;
  topBlock?: unknown;
  bottomBlock?: unknown;
  templateId?: string | null;
  status?: "active" | "paused" | "completed" | "canceled";
  invoicesGenerated?: number;
  // Optional explicit scheduling fields (used when linking existing invoice)
  nextScheduledAt?: string;
  lastGeneratedAt?: string;
};

export async function updateInvoiceRecurring(
  _db: DatabaseOrTransaction,
  params: UpdateInvoiceRecurringParams,
) {
  const {
    id,
    teamId,
    nextScheduledAt: explicitNextScheduledAt,
    lastGeneratedAt: explicitLastGeneratedAt,
    ...updateData
  } = params;

  // Check if frequency-related fields are being updated
  const frequencyFieldsChanged =
    params.frequency !== undefined ||
    params.frequencyDay !== undefined ||
    params.frequencyWeek !== undefined ||
    params.frequencyInterval !== undefined;

  // Check if end type or condition fields are being updated
  const endConditionsChanged =
    params.endType !== undefined ||
    params.endDate !== undefined ||
    params.endCount !== undefined;

  // If explicit nextScheduledAt is provided, use it; otherwise auto-calculate if frequency changed
  let nextScheduledAt: string | undefined = explicitNextScheduledAt;

  // Fetch current record if we need to merge/validate
  let current: ProjectedInvoiceRecurringRecord | null = null;

  if (frequencyFieldsChanged || endConditionsChanged) {
    current = await getInvoiceRecurringById(_db as Database, { id, teamId });
  }

  // Validate merged end conditions
  if (current && endConditionsChanged) {
    const mergedEndType = params.endType ?? current.endType;
    const mergedEndDate =
      params.endDate !== undefined ? params.endDate : current.endDate;
    const mergedEndCount =
      params.endCount !== undefined ? params.endCount : current.endCount;

    // Validate: endDate required when endType is 'on_date'
    if (mergedEndType === "on_date" && !mergedEndDate) {
      throw new Error("endDate is required when endType is 'on_date'");
    }

    // Validate: endCount required when endType is 'after_count'
    if (mergedEndType === "after_count" && !mergedEndCount) {
      throw new Error("endCount is required when endType is 'after_count'");
    }
  }

  // Calculate nextScheduledAt if frequency changed and series is active
  if (!nextScheduledAt && frequencyFieldsChanged && current) {
    if (current.status === "active") {
      const recurringParams: RecurringInvoiceParams = {
        frequency: params.frequency ?? current.frequency,
        frequencyDay:
          params.frequencyDay !== undefined
            ? params.frequencyDay
            : current.frequencyDay,
        frequencyWeek:
          params.frequencyWeek !== undefined
            ? params.frequencyWeek
            : current.frequencyWeek,
        frequencyInterval:
          params.frequencyInterval !== undefined
            ? params.frequencyInterval
            : current.frequencyInterval,
        timezone: params.timezone ?? current.timezone,
      };

      const nextDate = calculateNextScheduledDate(recurringParams, new Date());
      nextScheduledAt = nextDate.toISOString();
    }
  }

  const existing =
    current ?? (await getInvoiceRecurringById(_db as Database, { id, teamId }));

  if (!existing) {
    return null;
  }

  const nextCustomerId = hasOwnKey(params, "customerId")
    ? (params.customerId ?? null)
    : existing.customerId;
  const nextCustomerName = hasOwnKey(params, "customerName")
    ? (params.customerName ?? null)
    : hasOwnKey(params, "customerId")
      ? null
      : existing.customerName;

  return upsertProjectedInvoiceRecurringRecord({
    ...existing,
    updatedAt: new Date().toISOString(),
    customerId: nextCustomerId,
    customerName: nextCustomerName,
    frequency: hasOwnKey(updateData, "frequency")
      ? (updateData.frequency ?? existing.frequency)
      : existing.frequency,
    frequencyDay: hasOwnKey(updateData, "frequencyDay")
      ? (updateData.frequencyDay ?? null)
      : existing.frequencyDay,
    frequencyWeek: hasOwnKey(updateData, "frequencyWeek")
      ? (updateData.frequencyWeek ?? null)
      : existing.frequencyWeek,
    frequencyInterval: hasOwnKey(updateData, "frequencyInterval")
      ? (updateData.frequencyInterval ?? null)
      : existing.frequencyInterval,
    endType: hasOwnKey(updateData, "endType")
      ? (updateData.endType ?? existing.endType)
      : existing.endType,
    endDate: hasOwnKey(updateData, "endDate")
      ? (updateData.endDate ?? null)
      : existing.endDate,
    endCount: hasOwnKey(updateData, "endCount")
      ? (updateData.endCount ?? null)
      : existing.endCount,
    timezone: hasOwnKey(updateData, "timezone")
      ? (updateData.timezone ?? existing.timezone)
      : existing.timezone,
    dueDateOffset: hasOwnKey(updateData, "dueDateOffset")
      ? (updateData.dueDateOffset ?? existing.dueDateOffset)
      : existing.dueDateOffset,
    amount: hasOwnKey(updateData, "amount")
      ? (updateData.amount ?? null)
      : existing.amount,
    currency: hasOwnKey(updateData, "currency")
      ? (updateData.currency ?? null)
      : existing.currency,
    lineItems: hasOwnKey(updateData, "lineItems")
      ? (updateData.lineItems ?? null)
      : existing.lineItems,
    template: hasOwnKey(updateData, "template")
      ? (updateData.template ?? null)
      : existing.template,
    paymentDetails: hasOwnKey(updateData, "paymentDetails")
      ? (updateData.paymentDetails ?? null)
      : existing.paymentDetails,
    fromDetails: hasOwnKey(updateData, "fromDetails")
      ? (updateData.fromDetails ?? null)
      : existing.fromDetails,
    noteDetails: hasOwnKey(updateData, "noteDetails")
      ? (updateData.noteDetails ?? null)
      : existing.noteDetails,
    vat: hasOwnKey(updateData, "vat") ? (updateData.vat ?? null) : existing.vat,
    tax: hasOwnKey(updateData, "tax") ? (updateData.tax ?? null) : existing.tax,
    discount: hasOwnKey(updateData, "discount")
      ? (updateData.discount ?? null)
      : existing.discount,
    subtotal: hasOwnKey(updateData, "subtotal")
      ? (updateData.subtotal ?? null)
      : existing.subtotal,
    topBlock: hasOwnKey(updateData, "topBlock")
      ? (updateData.topBlock ?? null)
      : existing.topBlock,
    bottomBlock: hasOwnKey(updateData, "bottomBlock")
      ? (updateData.bottomBlock ?? null)
      : existing.bottomBlock,
    templateId: hasOwnKey(updateData, "templateId")
      ? (updateData.templateId ?? null)
      : existing.templateId,
    status: hasOwnKey(updateData, "status")
      ? (updateData.status ?? existing.status)
      : existing.status,
    invoicesGenerated: hasOwnKey(updateData, "invoicesGenerated")
      ? (updateData.invoicesGenerated ?? existing.invoicesGenerated)
      : existing.invoicesGenerated,
    nextScheduledAt:
      nextScheduledAt ??
      (hasOwnKey(params, "nextScheduledAt")
        ? (params.nextScheduledAt ?? null)
        : existing.nextScheduledAt),
    lastGeneratedAt: explicitLastGeneratedAt ?? existing.lastGeneratedAt,
  });
}

export type GetInvoiceRecurringByIdParams = {
  id: string;
  teamId: string;
};

type InvoiceRecurringByIdResult = {
  id: string;
  createdAt: string;
  updatedAt: string | null;
  teamId: string;
  userId: ConvexUserId;
  customerId: string | null;
  frequency: InvoiceRecurringFrequency;
  frequencyDay: number | null;
  frequencyWeek: number | null;
  frequencyInterval: number | null;
  endType: InvoiceRecurringEndType;
  endDate: string | null;
  endCount: number | null;
  status: InvoiceRecurringStatus;
  invoicesGenerated: number;
  consecutiveFailures: number;
  nextScheduledAt: string | null;
  lastGeneratedAt: string | null;
  upcomingNotificationSentAt: string | null;
  timezone: string;
  dueDateOffset: number;
  amount: number | null;
  currency: string | null;
  lineItems: unknown;
  template: unknown;
  paymentDetails: unknown;
  fromDetails: unknown;
  noteDetails: unknown;
  customerName: string | null;
  vat: number | null;
  tax: number | null;
  discount: number | null;
  subtotal: number | null;
  topBlock: unknown;
  bottomBlock: unknown;
  templateId: string | null;
  customer: {
    id: string | null;
    name: string | null;
    email: string | null;
    website: string | null;
  };
};

type ProjectedInvoiceRecurringRecord = InvoiceRecurringByIdResult;

function getProjectedInvoiceRecurringPayload(
  record: { payload: unknown } | null | undefined,
): ProjectedInvoiceRecurringRecord | null {
  const payload = record?.payload as ProjectedInvoiceRecurringRecord | null;

  if (!payload || typeof payload !== "object") {
    return null;
  }

  return payload;
}

async function hydrateInvoiceRecurringRecord(
  record: Omit<ProjectedInvoiceRecurringRecord, "customer">,
): Promise<ProjectedInvoiceRecurringRecord> {
  const customer = record.customerId
    ? await getCustomerByIdFromConvex({
        teamId: record.teamId,
        customerId: record.customerId,
      })
    : null;

  return {
    ...record,
    customerName: record.customerName ?? customer?.name ?? null,
    customer: {
      id: customer?.id ?? null,
      name: customer?.name ?? null,
      email: customer?.email ?? null,
      website: customer?.website ?? null,
    },
  };
}

async function upsertProjectedInvoiceRecurringRecord(
  record: Omit<ProjectedInvoiceRecurringRecord, "customer">,
) {
  const recurring = await hydrateInvoiceRecurringRecord(record);
  await upsertInvoiceRecurringSeriesInConvex({
    teamId: recurring.teamId,
    id: recurring.id,
    customerId: recurring.customerId,
    customerName: recurring.customerName,
    status: recurring.status,
    nextScheduledAt: recurring.nextScheduledAt,
    upcomingNotificationSentAt: recurring.upcomingNotificationSentAt,
    payload: JSON.parse(JSON.stringify(recurring)) as Record<string, unknown>,
  });

  return recurring;
}

async function getProjectedInvoiceRecurringForTeam(teamId: string) {
  const records = await getInvoiceRecurringSeriesByTeamFromConvex({ teamId });

  return records
    .map(getProjectedInvoiceRecurringPayload)
    .filter(
      (record): record is ProjectedInvoiceRecurringRecord =>
        !!record && typeof record === "object" && record.teamId === teamId,
    );
}

export async function getInvoiceRecurringById(
  _db: Database,
  params: GetInvoiceRecurringByIdParams,
) {
  const { id, teamId } = params;
  const projected = await getInvoiceRecurringSeriesByLegacyIdFromConvex({
    id,
  });

  const payload = getProjectedInvoiceRecurringPayload(projected);

  if (payload && payload.teamId === teamId) {
    return payload;
  }
  return null;
}

export type GetInvoiceRecurringListParams = {
  teamId: string;
  status?: ("active" | "paused" | "completed" | "canceled")[];
  customerId?: string;
  cursor?: string | null;
  pageSize?: number;
};

export async function getInvoiceRecurringList(
  _db: Database,
  params: GetInvoiceRecurringListParams,
) {
  const { teamId, status, customerId, cursor, pageSize = 25 } = params;
  let data = await getProjectedInvoiceRecurringForTeam(teamId);

  if (status && status.length > 0) {
    const validStatuses = status.filter((s) => RECURRING_STATUSES.includes(s));

    if (validStatuses.length > 0) {
      const validStatusSet = new Set(validStatuses);
      data = data.filter((record) => validStatusSet.has(record.status));
    }
  }

  if (customerId) {
    data = data.filter((record) => record.customerId === customerId);
  }

  const offset = cursor ? Number.parseInt(cursor, 10) : 0;
  data = [...data].sort((left, right) => {
    const createdAtComparison = right.createdAt.localeCompare(left.createdAt);

    if (createdAtComparison !== 0) {
      return createdAtComparison;
    }

    return right.id.localeCompare(left.id);
  });
  const pagedData = data.slice(offset, offset + pageSize);

  const nextCursor =
    pagedData.length === pageSize ? (offset + pageSize).toString() : undefined;

  return {
    meta: {
      cursor: nextCursor ?? null,
      hasPreviousPage: offset > 0,
      hasNextPage: pagedData.length === pageSize,
    },
    data: pagedData.map((record) => ({
      id: record.id,
      createdAt: record.createdAt,
      customerId: record.customerId,
      customerName: record.customerName,
      frequency: record.frequency,
      frequencyDay: record.frequencyDay,
      frequencyWeek: record.frequencyWeek,
      endType: record.endType,
      endCount: record.endCount,
      status: record.status,
      invoicesGenerated: record.invoicesGenerated,
      nextScheduledAt: record.nextScheduledAt,
      amount: record.amount,
      currency: record.currency,
      customer: {
        id: record.customer.id,
        name: record.customer.name,
        email: record.customer.email,
      },
    })),
  };
}

/**
 * Default batch size for processing recurring invoices
 * Prevents overwhelming the system when many invoices are due at once
 */
const DEFAULT_BATCH_SIZE = 50;

/**
 * Get recurring invoices that are due for generation
 * Used by the scheduler to find invoices that need to be generated
 *
 * @param db - Database instance
 * @param options.limit - Maximum number of records to return (default: 50)
 * @returns Object with data array and hasMore flag for pagination awareness
 */
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
      (record): record is ProjectedInvoiceRecurringRecord =>
        !!record &&
        record.status === "active" &&
        !!record.nextScheduledAt &&
        record.nextScheduledAt <= now,
    )
    .sort((left, right) =>
      (left.nextScheduledAt ?? "").localeCompare(right.nextScheduledAt ?? ""),
    );

  const hasMore = data.length > limit;
  const records = hasMore ? data.slice(0, limit) : data;

  return {
    data: records,
    hasMore,
  };
}

/**
 * Mark a recurring invoice as generated and update the next scheduled date
 * This should be called after successfully generating an invoice
 */
export type MarkInvoiceGeneratedParams = {
  id: string;
  teamId: string;
};

export async function markInvoiceGenerated(
  db: DatabaseOrTransaction,
  params: MarkInvoiceGeneratedParams,
) {
  const { id, teamId } = params;

  // Get current recurring invoice data
  const current = await getInvoiceRecurringById(db as Database, {
    id,
    teamId,
  });

  if (!current) {
    return null;
  }

  const now = new Date();
  const newInvoicesGenerated = current.invoicesGenerated + 1;

  // Calculate next scheduled date
  const recurringParams: RecurringInvoiceParams = {
    frequency: current.frequency,
    frequencyDay: current.frequencyDay,
    frequencyWeek: current.frequencyWeek,
    frequencyInterval: current.frequencyInterval,
    timezone: current.timezone,
  };

  // Use the original scheduled time as the base to preserve the intended schedule pattern
  // (e.g., biweekly invoices stay on the same weekday, monthly on the same date)
  const baseDate = current.nextScheduledAt
    ? new Date(current.nextScheduledAt)
    : now;

  const initialNextDate = calculateNextScheduledDate(recurringParams, baseDate);

  // Advance to future if scheduler ran late (prevents catch-up loop)
  const { date: nextScheduledAt } = advanceToFutureDate(
    recurringParams,
    initialNextDate,
    now,
  );

  // Check if series should be completed
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

/**
 * Maximum consecutive failures before auto-pausing
 */
const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Record a failure for a recurring invoice series
 * Auto-pauses after MAX_CONSECUTIVE_FAILURES
 * @returns Object with updated record and whether it was auto-paused
 */
export async function recordInvoiceGenerationFailure(
  db: Database,
  params: { id: string; teamId: string },
): Promise<{
  result: ProjectedInvoiceRecurringRecord | null;
  autoPaused: boolean;
}> {
  const { id, teamId } = params;

  // Get current data
  const current = await getInvoiceRecurringById(db, { id, teamId });

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

/**
 * Pause a recurring invoice series
 */
export async function pauseInvoiceRecurring(
  db: DatabaseOrTransaction,
  params: { id: string; teamId: string },
) {
  const { id, teamId } = params;
  const existing = await getInvoiceRecurringById(db as Database, {
    id,
    teamId,
  });

  if (!existing) {
    return null;
  }

  return upsertProjectedInvoiceRecurringRecord({
    ...existing,
    status: "paused",
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Resume a paused recurring invoice series
 * Validates that the series hasn't already completed before resuming
 */
export async function resumeInvoiceRecurring(
  db: Database,
  params: { id: string; teamId: string },
) {
  const { id, teamId } = params;

  // Get current data to recalculate next scheduled date
  const current = await getInvoiceRecurringById(db, { id, teamId });

  if (!current || current.status !== "paused") {
    return null;
  }

  // Calculate next scheduled date from now
  const now = new Date();
  const recurringParams: RecurringInvoiceParams = {
    frequency: current.frequency,
    frequencyDay: current.frequencyDay,
    frequencyWeek: current.frequencyWeek,
    frequencyInterval: current.frequencyInterval,
    timezone: current.timezone,
  };

  const nextScheduledAt = calculateNextScheduledDate(recurringParams, now);

  // Check if series should actually be completed (end conditions may have been met while paused)
  const isCompleted = shouldMarkCompleted(
    current.endType,
    current.endDate ? new Date(current.endDate) : null,
    current.endCount,
    current.invoicesGenerated,
    nextScheduledAt,
  );

  if (isCompleted) {
    // Mark as completed instead of resuming
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

/**
 * Delete a recurring invoice series (soft delete by setting status to canceled)
 * Generated invoices are kept
 */
export async function deleteInvoiceRecurring(
  db: DatabaseOrTransaction,
  params: { id: string; teamId: string },
) {
  const { id, teamId } = params;
  const existing = await getInvoiceRecurringById(db as Database, {
    id,
    teamId,
  });

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

/**
 * Get upcoming invoice preview for a recurring series
 */
export type GetUpcomingInvoicesParams = {
  id: string;
  teamId: string;
  limit?: number;
};

export async function getUpcomingInvoices(
  db: Database,
  params: GetUpcomingInvoicesParams,
) {
  const { id, teamId, limit = 10 } = params;

  const recurring = await getInvoiceRecurringById(db, { id, teamId });

  if (!recurring) {
    return null;
  }

  const recurringParams: RecurringInvoiceParams = {
    frequency: recurring.frequency,
    frequencyDay: recurring.frequencyDay,
    frequencyWeek: recurring.frequencyWeek,
    frequencyInterval: recurring.frequencyInterval,
    timezone: recurring.timezone,
  };

  const startDate = recurring.nextScheduledAt
    ? new Date(recurring.nextScheduledAt)
    : new Date();

  return calculateUpcomingDates(
    recurringParams,
    startDate,
    recurring.amount ?? 0,
    recurring.currency ?? "USD",
    recurring.endType,
    recurring.endDate ? new Date(recurring.endDate) : null,
    recurring.endCount,
    recurring.invoicesGenerated,
    limit,
  );
}

/**
 * Check if an invoice already exists for a recurring series and sequence number
 * Used for idempotency
 *
 * Returns:
 * - null if no invoice exists for this sequence
 * - { id, status, invoiceNumber } if an invoice exists
 *
 * This allows the caller to decide whether to:
 * - Create a new invoice (if null)
 * - Send an existing draft (if status is 'draft')
 * - Skip entirely (if already sent/paid)
 */
export async function checkInvoiceExists(
  _db: Database,
  params: { invoiceRecurringId: string; recurringSequence: number },
) {
  const { invoiceRecurringId, recurringSequence } = params;
  const projectedRecurring =
    await getInvoiceRecurringSeriesByLegacyIdFromConvex({
      id: invoiceRecurringId,
    });
  const recurring = getProjectedInvoiceRecurringPayload(projectedRecurring);

  if (!recurring) {
    return null;
  }

  const result = await getProjectedInvoiceByRecurringSequence(
    recurring.teamId,
    invoiceRecurringId,
    recurringSequence,
  );

  if (!result) {
    return null;
  }

  return {
    id: result.id,
    status: result.status,
    invoiceNumber: result.invoiceNumber,
  };
}

export async function getScheduledInvoicesForRecurring(
  _db: Database,
  params: { teamId: string; invoiceRecurringId: string },
) {
  return getProjectedInvoicesByRecurringId({
    teamId: params.teamId,
    invoiceRecurringId: params.invoiceRecurringId,
    statuses: ["scheduled"],
  });
}

/**
 * Get recurring invoices that are upcoming within the specified hours
 * and haven't had their upcoming notification sent yet
 * Used by the scheduler to send 24-hour advance notifications
 *
 * @param db - Database instance
 * @param hoursAhead - Hours to look ahead (default: 24)
 * @param options.limit - Maximum number of records to return (default: 100)
 * @returns Object with data array and hasMore flag
 */
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
      (record): record is ProjectedInvoiceRecurringRecord =>
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
    .sort((left, right) =>
      (left.nextScheduledAt ?? "").localeCompare(right.nextScheduledAt ?? ""),
    );

  const hasMore = data.length > limit;
  const records = hasMore ? data.slice(0, limit) : data;

  return {
    data: records,
    hasMore,
  };
}

/**
 * Get upcoming recurring invoices for a specific team before a given date
 * Used by insights to show upcoming recurring invoices for a team
 *
 * @param db - Database instance
 * @param params.teamId - Team ID to filter by
 * @param params.before - Only include invoices scheduled before this date
 * @param params.limit - Maximum number of records to return (default: 10)
 * @returns Array of upcoming recurring invoices for the team
 */
export async function getUpcomingDueRecurringByTeam(
  _db: Database,
  params: {
    teamId: string;
    before: Date;
    limit?: number;
  },
) {
  const { teamId, before, limit = 10 } = params;
  const now = new Date();
  const data = (await getProjectedInvoiceRecurringForTeam(teamId))
    .filter(
      (record) =>
        record.status === "active" &&
        !!record.nextScheduledAt &&
        record.nextScheduledAt > now.toISOString() &&
        record.nextScheduledAt <= before.toISOString(),
    )
    .sort((left, right) =>
      (left.nextScheduledAt ?? "").localeCompare(right.nextScheduledAt ?? ""),
    )
    .slice(0, limit);

  return data.map((record) => ({
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

/**
 * Mark that the upcoming notification has been sent for a recurring invoice series
 */
export async function markUpcomingNotificationSent(
  db: Database,
  params: { id: string; teamId: string },
) {
  const { id, teamId } = params;
  const existing = await getInvoiceRecurringById(db, { id, teamId });

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

/**
 * Calculate the maximum number of invoices that could occur in a given forecast period
 * based on the recurring invoice frequency.
 *
 * This converts forecastMonths into an invoice count limit, accounting for how many
 * invoices each frequency type generates per month.
 *
 * @param frequency - The recurring invoice frequency
 * @param frequencyInterval - Custom interval in days (for 'custom' frequency)
 * @param forecastMonths - Number of months to forecast
 * @returns Maximum number of invoices to calculate
 */
function calculateInvoiceLimitForPeriod(
  frequency: InvoiceRecurringFrequency,
  frequencyInterval: number | null,
  forecastMonths: number,
): number {
  // Add a buffer to ensure we don't miss edge cases at period boundaries
  const buffer = 2;

  switch (frequency) {
    case "weekly":
      // ~4.33 weeks per month
      return Math.ceil(forecastMonths * 4.33) + buffer;

    case "biweekly":
      // ~2.17 invoices per month (every 2 weeks)
      return Math.ceil(forecastMonths * 2.17) + buffer;

    case "monthly_date":
    case "monthly_weekday":
    case "monthly_last_day":
      // 1 invoice per month
      return forecastMonths + buffer;

    case "quarterly":
      // 1 invoice per 3 months
      return Math.ceil(forecastMonths / 3) + buffer;

    case "semi_annual":
      // 1 invoice per 6 months
      return Math.ceil(forecastMonths / 6) + buffer;

    case "annual":
      // 1 invoice per 12 months
      return Math.ceil(forecastMonths / 12) + buffer;

    case "custom":
      // frequencyInterval is in days
      if (frequencyInterval && frequencyInterval > 0) {
        // Average 30.44 days per month
        const invoicesPerMonth = 30.44 / frequencyInterval;
        return Math.ceil(forecastMonths * invoicesPerMonth) + buffer;
      }
      // Fallback if interval is not set
      return forecastMonths + buffer;

    default:
      // Default to monthly as a safe fallback
      return forecastMonths + buffer;
  }
}

/**
 * Project active recurring invoices into future months for revenue forecasting.
 *
 * This function queries all active recurring invoices and uses calculateUpcomingDates()
 * to project when they will generate invoices in the forecast period.
 *
 * @param db - Query context
 * @param params - Parameters including teamId and forecastMonths
 * @returns Map of month keys (yyyy-MM) to projected amounts and counts
 */
export type GetRecurringInvoiceProjectionParams = {
  teamId: string;
  forecastMonths: number;
  currency?: string;
};

export type RecurringInvoiceProjectionResult = Map<
  string,
  { amount: number; count: number }
>;

export async function getRecurringInvoiceProjection(
  _db: Database,
  params: GetRecurringInvoiceProjectionParams,
): Promise<RecurringInvoiceProjectionResult> {
  const { teamId, forecastMonths, currency } = params;
  const activeRecurring = (
    await getProjectedInvoiceRecurringForTeam(teamId)
  ).filter(
    (record) =>
      record.status === "active" && (!currency || record.currency === currency),
  );

  // Project each recurring invoice into forecast months
  const projection: RecurringInvoiceProjectionResult = new Map();

  // Calculate end date for the forecast period (used to filter results)
  // Use endOfMonth to match getRevenueForecast in reports.ts, which covers through
  // the last day of each forecast month. Without this, invoices scheduled for
  // later in the last forecast month would be incorrectly excluded.
  const forecastEndDate = endOfMonth(addMonths(new UTCDate(), forecastMonths));

  for (const recurring of activeRecurring) {
    // Skip if no next scheduled date or no amount
    if (!recurring.nextScheduledAt || !recurring.amount) {
      continue;
    }

    const recurringParams: RecurringInvoiceParams = {
      frequency: recurring.frequency,
      frequencyDay: recurring.frequencyDay,
      frequencyWeek: recurring.frequencyWeek,
      frequencyInterval: recurring.frequencyInterval,
      timezone: recurring.timezone,
    };

    // Calculate the maximum number of invoices that could occur in the forecast period
    // based on the frequency. This is the 'limit' parameter for calculateUpcomingDates,
    // which controls how many invoices to return (not the time period).
    const invoiceLimitForPeriod = calculateInvoiceLimitForPeriod(
      recurring.frequency,
      recurring.frequencyInterval,
      forecastMonths,
    );

    // Calculate upcoming invoice dates
    const upcoming = calculateUpcomingDates(
      recurringParams,
      new Date(recurring.nextScheduledAt),
      recurring.amount,
      recurring.currency ?? "USD",
      recurring.endType,
      recurring.endDate ? new Date(recurring.endDate) : null,
      recurring.endCount,
      recurring.invoicesGenerated,
      invoiceLimitForPeriod,
    );

    // Group by month, filtering to only include invoices within the forecast period
    for (const invoice of upcoming.invoices) {
      const invoiceDate = parseISO(invoice.date);

      // Skip invoices beyond the forecast period
      if (invoiceDate > forecastEndDate) {
        continue;
      }

      const monthKey = format(invoiceDate, "yyyy-MM");
      const existing = projection.get(monthKey) || { amount: 0, count: 0 };
      projection.set(monthKey, {
        amount: existing.amount + invoice.amount,
        count: existing.count + 1,
      });
    }
  }

  return projection;
}
