import type { Database } from "../../client";
import { getCustomerByIdFromD1, requireCustomersD1 } from "../customers/d1";
import type {
  InvoiceRecurringEndType,
  InvoiceRecurringFrequency,
  InvoiceRecurringStatus,
  RecurringInvoiceParams,
} from "@tamias/invoice/server-recurring";
import {
  getInvoiceRecurringSeriesByIdFromD1,
  getInvoiceRecurringSeriesByTeamFromD1,
  requireInvoiceRecurringD1,
  upsertInvoiceRecurringSeriesInD1,
  type StoredInvoiceRecurringRecord,
} from "./d1";

type UserId = string;

export type CreateInvoiceRecurringParams = {
  teamId: string;
  userId: UserId;
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
  userId: UserId;
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

async function hydrateInvoiceRecurringRecord(
  db: Database,
  record: Omit<ProjectedInvoiceRecurringRecord, "customer">,
): Promise<ProjectedInvoiceRecurringRecord> {
  const customer = record.customerId
    ? await getCustomerByIdFromD1(requireCustomersD1(db), {
        teamId: record.teamId,
        id: record.customerId,
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
  db: Database,
  record: Omit<ProjectedInvoiceRecurringRecord, "customer">,
) {
  const recurring = await hydrateInvoiceRecurringRecord(db, record);
  await upsertInvoiceRecurringSeriesInD1(requireInvoiceRecurringD1(db), recurring);

  return recurring;
}

export async function hydrateProjectedInvoiceRecurringRecords(
  db: Database,
  records: StoredInvoiceRecurringRecord[],
) {
  return Promise.all(records.map((record) => hydrateInvoiceRecurringRecord(db, record)));
}

export async function getProjectedInvoiceRecurringForTeam(db: Database, teamId: string) {
  const records = await getInvoiceRecurringSeriesByTeamFromD1(
    requireInvoiceRecurringD1(db),
    teamId,
  );

  return hydrateProjectedInvoiceRecurringRecords(
    db,
    records.filter((record) => record.teamId === teamId),
  );
}

export async function getProjectedInvoiceRecurringByLegacyId(db: Database, id: string) {
  const projected = await getInvoiceRecurringSeriesByIdFromD1(requireInvoiceRecurringD1(db), id);

  return projected ? hydrateInvoiceRecurringRecord(db, projected) : null;
}

export async function getProjectedInvoiceRecurringById(
  db: Database,
  params: GetInvoiceRecurringByIdParams,
) {
  const payload = await getProjectedInvoiceRecurringByLegacyId(db, params.id);

  return payload?.teamId === params.teamId ? payload : null;
}
