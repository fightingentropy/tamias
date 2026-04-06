import type { InvoiceStatus } from "../../invoice-projections";
import type { GetInvoicesParams } from "../types";

const INVOICE_STATUSES = [
  "draft",
  "overdue",
  "paid",
  "unpaid",
  "canceled",
  "scheduled",
  "refunded",
] as const;

export function compareNullableStrings(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  return (left ?? "").localeCompare(right ?? "");
}

export function compareNullableNumbers(
  left: number | null | undefined,
  right: number | null | undefined,
) {
  return (left ?? 0) - (right ?? 0);
}

export function getValidInvoiceStatuses(statuses: GetInvoicesParams["statuses"]): InvoiceStatus[] {
  return (statuses ?? []).filter((status) =>
    INVOICE_STATUSES.includes(status as InvoiceStatus),
  ) as InvoiceStatus[];
}
