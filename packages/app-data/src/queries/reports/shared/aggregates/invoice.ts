import {
  getInvoiceAgingAggregateRowsFromConvex,
  getInvoiceDateAggregateRowsFromConvex,
  type InvoiceAggregateDateField,
} from "@tamias/app-data-convex";
import type { Database } from "../../../../client";
import { createQueryCacheKey, getOrSetQueryCacheValue } from "../../../../client";
import type { ProjectedInvoiceRecord } from "../../../invoice-projections";
import { normalizeTimestampBoundary } from "../../../date-boundaries";
import { normalizeReportInvoiceStatuses } from "./shared";

export async function getReportInvoiceDateAggregateRows(
  db: Database,
  params: {
    teamId: string;
    statuses: ProjectedInvoiceRecord["status"][];
    dateField: InvoiceAggregateDateField;
    inputCurrency?: string;
    from?: string;
    to?: string;
    recurring?: boolean;
  },
) {
  const normalizedStatuses = normalizeReportInvoiceStatuses(params.statuses);

  if (!normalizedStatuses || normalizedStatuses.length === 0) {
    return null;
  }

  return getOrSetQueryCacheValue(
    db,
    createQueryCacheKey("reports:invoice-date-aggregates", {
      teamId: params.teamId,
      statuses: normalizedStatuses,
      dateField: params.dateField,
      inputCurrency: params.inputCurrency ?? null,
      from: params.from ? normalizeTimestampBoundary(params.from, "start") : null,
      to: params.to ? normalizeTimestampBoundary(params.to, "end") : null,
      recurring: params.recurring ?? null,
    }),
    async () => {
      const rows = await getInvoiceDateAggregateRowsFromConvex({
        teamId: params.teamId,
        statuses: normalizedStatuses,
        dateField: params.dateField,
        dateFrom: params.from ? normalizeTimestampBoundary(params.from, "start") : null,
        dateTo: params.to ? normalizeTimestampBoundary(params.to, "end") : null,
        currency: params.inputCurrency ?? null,
        recurring: params.recurring,
      });

      return rows.length > 0 ? rows : null;
    },
  );
}

export async function getReportInvoiceAgingAggregateRows(
  db: Database,
  params: {
    teamId: string;
    statuses: ProjectedInvoiceRecord["status"][];
    inputCurrency?: string;
  },
) {
  const normalizedStatuses = normalizeReportInvoiceStatuses(params.statuses);

  if (!normalizedStatuses || normalizedStatuses.length === 0) {
    return null;
  }

  return getOrSetQueryCacheValue(
    db,
    createQueryCacheKey("reports:invoice-aging-aggregates", {
      teamId: params.teamId,
      statuses: normalizedStatuses,
      inputCurrency: params.inputCurrency ?? null,
    }),
    async () => {
      const rows = await getInvoiceAgingAggregateRowsFromConvex({
        teamId: params.teamId,
        statuses: normalizedStatuses,
        currency: params.inputCurrency ?? null,
      });

      return rows.length > 0 ? rows : null;
    },
  );
}
