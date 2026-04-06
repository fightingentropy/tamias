import {
  type CurrentUserIdentityRecord,
  getCustomerByIdFromConvex,
  getInvoiceRecurringSeriesByLegacyIdFromConvex,
  getInvoiceRecurringSeriesByTeamFromConvex,
  upsertInvoiceRecurringSeriesInConvex,
} from "@tamias/app-data-convex";
import type {
  InvoiceRecurringEndType,
  InvoiceRecurringFrequency,
  InvoiceRecurringStatus,
  RecurringInvoiceParams,
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
  issueDate?: string | null;
};

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
  status?: InvoiceRecurringStatus;
  invoicesGenerated?: number;
  nextScheduledAt?: string;
  lastGeneratedAt?: string;
};

export type GetInvoiceRecurringByIdParams = {
  id: string;
  teamId: string;
};

export type GetInvoiceRecurringListParams = {
  teamId: string;
  status?: InvoiceRecurringStatus[];
  customerId?: string;
  cursor?: string | null;
  pageSize?: number;
};

export type MarkInvoiceGeneratedParams = {
  id: string;
  teamId: string;
};

export type GetUpcomingInvoicesParams = {
  id: string;
  teamId: string;
  limit?: number;
};

export type GetRecurringInvoiceProjectionParams = {
  teamId: string;
  forecastMonths: number;
  currency?: string;
};

export type RecurringInvoiceProjectionResult = Map<string, { amount: number; count: number }>;

export type InvoiceRecurringByIdResult = {
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

export type ProjectedInvoiceRecurringRecord = InvoiceRecurringByIdResult;

export const DEFAULT_BATCH_SIZE = 50;
export const MAX_CONSECUTIVE_FAILURES = 3;

type RecurringScheduleFields = Pick<
  ProjectedInvoiceRecurringRecord,
  "frequency" | "frequencyDay" | "frequencyWeek" | "frequencyInterval" | "timezone"
>;

export function hasOwnKey(object: object, key: string) {
  return Object.hasOwn(object, key);
}

export function buildRecurringParams(record: RecurringScheduleFields): RecurringInvoiceParams {
  return {
    frequency: record.frequency,
    frequencyDay: record.frequencyDay,
    frequencyWeek: record.frequencyWeek,
    frequencyInterval: record.frequencyInterval,
    timezone: record.timezone,
  };
}

export function sortRecurringByCreatedAtDesc(
  left: ProjectedInvoiceRecurringRecord,
  right: ProjectedInvoiceRecurringRecord,
) {
  const createdAtComparison = right.createdAt.localeCompare(left.createdAt);

  if (createdAtComparison !== 0) {
    return createdAtComparison;
  }

  return right.id.localeCompare(left.id);
}

export function sortRecurringByNextScheduledAtAsc(
  left: ProjectedInvoiceRecurringRecord,
  right: ProjectedInvoiceRecurringRecord,
) {
  return (left.nextScheduledAt ?? "").localeCompare(right.nextScheduledAt ?? "");
}

export function getProjectedInvoiceRecurringPayload(
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

export async function upsertProjectedInvoiceRecurringRecord(
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

export async function getProjectedInvoiceRecurringForTeam(teamId: string) {
  const records = await getInvoiceRecurringSeriesByTeamFromConvex({ teamId });

  return records
    .map(getProjectedInvoiceRecurringPayload)
    .filter(
      (record): record is ProjectedInvoiceRecurringRecord =>
        !!record && typeof record === "object" && record.teamId === teamId,
    );
}

export async function getProjectedInvoiceRecurringByLegacyId(id: string) {
  const projected = await getInvoiceRecurringSeriesByLegacyIdFromConvex({
    id,
  });

  return getProjectedInvoiceRecurringPayload(projected);
}

export async function getProjectedInvoiceRecurringById(params: GetInvoiceRecurringByIdParams) {
  const payload = await getProjectedInvoiceRecurringByLegacyId(params.id);

  return payload?.teamId === params.teamId ? payload : null;
}
