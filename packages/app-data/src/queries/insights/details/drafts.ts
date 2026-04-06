import type { Database } from "../../../client";
import { getProjectedInvoicesByFilters } from "../../invoice-projections";

export type DraftInvoiceDetail = {
  id: string;
  invoiceNumber?: string;
  customerName: string;
  amount: number;
  currency: string;
  createdAt: string;
};

export async function getDraftInvoices(
  _db: Database,
  params: { teamId: string; currency?: string },
): Promise<DraftInvoiceDetail[]> {
  const { teamId, currency } = params;
  const result = (
    await getProjectedInvoicesByFilters({
      teamId,
      statuses: ["draft"],
      currency,
    })
  ).sort((left, right) => (Number(right.amount) || 0) - (Number(left.amount) || 0));

  return result.map((invoice) => ({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber ?? undefined,
    customerName: invoice.customerName ?? "Unknown",
    amount: Number(invoice.amount ?? 0),
    currency: invoice.currency ?? "USD",
    createdAt: invoice.createdAt ?? new Date().toISOString(),
  }));
}
