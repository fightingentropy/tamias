import type { InvoiceStatus } from "../../invoice-projections";
import {
  INVOICE_SEARCH_STATUSES,
  TRACKER_PROJECT_SEARCH_STATUSES,
  TRANSACTION_SEARCH_STATUSES,
  TRANSACTION_SEARCH_STATUS_VALUES,
} from "../types";

export function getInvoiceStatusFilter(status?: string) {
  return status && INVOICE_SEARCH_STATUSES.has(status as InvoiceStatus)
    ? (status as InvoiceStatus)
    : undefined;
}

export function getTrackerProjectStatusFilter(status?: string) {
  return status && TRACKER_PROJECT_SEARCH_STATUSES.has(status)
    ? (status as "in_progress" | "completed")
    : undefined;
}

export function getTransactionStatusExclusions(status?: string) {
  if (!status || !TRANSACTION_SEARCH_STATUSES.has(status)) {
    return undefined;
  }

  return TRANSACTION_SEARCH_STATUS_VALUES.filter((candidateStatus) => candidateStatus !== status);
}
