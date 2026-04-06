import type { ProjectedInvoiceRecurringRecord, UpdateInvoiceRecurringParams } from "../shared";
import { hasOwnKey } from "../shared";

export function mergeNextCustomer(
  existing: ProjectedInvoiceRecurringRecord,
  params: UpdateInvoiceRecurringParams,
) {
  const nextCustomerId = hasOwnKey(params, "customerId")
    ? (params.customerId ?? null)
    : existing.customerId;
  const nextCustomerName = hasOwnKey(params, "customerName")
    ? (params.customerName ?? null)
    : hasOwnKey(params, "customerId")
      ? null
      : existing.customerName;

  return {
    nextCustomerId,
    nextCustomerName,
  };
}
