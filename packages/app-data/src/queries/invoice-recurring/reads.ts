import { RECURRING_STATUSES, calculateUpcomingDates } from "@tamias/invoice/server-recurring";
import type { Database } from "../../client";
import {
  getProjectedInvoiceByRecurringSequence,
  getProjectedInvoicesByRecurringId,
} from "../invoice-projections";
import {
  buildRecurringParams,
  getProjectedInvoiceRecurringById,
  getProjectedInvoiceRecurringByLegacyId,
  getProjectedInvoiceRecurringForTeam,
  sortRecurringByCreatedAtDesc,
  type GetInvoiceRecurringByIdParams,
  type GetInvoiceRecurringListParams,
  type GetUpcomingInvoicesParams,
} from "./shared";

function getValidRecurringStatuses(statuses: GetInvoiceRecurringListParams["status"]) {
  return (statuses ?? []).filter((status) => RECURRING_STATUSES.includes(status));
}

export async function getInvoiceRecurringById(
  _db: Database,
  params: GetInvoiceRecurringByIdParams,
) {
  return getProjectedInvoiceRecurringById(params);
}

export async function getInvoiceRecurringList(
  _db: Database,
  params: GetInvoiceRecurringListParams,
) {
  const { teamId, status, customerId, cursor, pageSize = 25 } = params;
  let data = await getProjectedInvoiceRecurringForTeam(teamId);

  if (status && status.length > 0) {
    const validStatuses = getValidRecurringStatuses(status);

    if (validStatuses.length > 0) {
      const validStatusSet = new Set(validStatuses);
      data = data.filter((record) => validStatusSet.has(record.status));
    }
  }

  if (customerId) {
    data = data.filter((record) => record.customerId === customerId);
  }

  const offset = cursor ? Number.parseInt(cursor, 10) : 0;
  data = [...data].sort(sortRecurringByCreatedAtDesc);
  const pagedData = data.slice(offset, offset + pageSize);
  const nextCursor = pagedData.length === pageSize ? (offset + pageSize).toString() : undefined;

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

export async function getUpcomingInvoices(db: Database, params: GetUpcomingInvoicesParams) {
  const { id, teamId, limit = 10 } = params;
  const recurring = await getInvoiceRecurringById(db, { id, teamId });

  if (!recurring) {
    return null;
  }

  const startDate = recurring.nextScheduledAt ? new Date(recurring.nextScheduledAt) : new Date();

  return calculateUpcomingDates(
    buildRecurringParams(recurring),
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

export async function checkInvoiceExists(
  _db: Database,
  params: { invoiceRecurringId: string; recurringSequence: number },
) {
  const recurring = await getProjectedInvoiceRecurringByLegacyId(params.invoiceRecurringId);

  if (!recurring) {
    return null;
  }

  const result = await getProjectedInvoiceByRecurringSequence(
    recurring.teamId,
    params.invoiceRecurringId,
    params.recurringSequence,
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
