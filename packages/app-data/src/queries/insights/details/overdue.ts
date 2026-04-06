import type { Database } from "../../../client";
import { getProjectedInvoicesByFilters } from "../../invoice-projections";

export type OverdueInvoiceDetail = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail?: string;
  amount: number;
  currency: string;
  dueDate: string;
  daysOverdue: number;
};

export async function getOverdueInvoiceDetails(
  _db: Database,
  params: { teamId: string; currency?: string },
): Promise<OverdueInvoiceDetail[]> {
  const { teamId, currency } = params;
  const result = (
    await getProjectedInvoicesByFilters({
      teamId,
      statuses: ["overdue"],
      currency,
    })
  )
    .filter((invoice) => !!invoice.dueDate)
    .sort((left, right) => (left.dueDate ?? "").localeCompare(right.dueDate ?? ""));

  const now = new Date();

  return result.map((invoice) => {
    const dueDate = new Date(invoice.dueDate!);
    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber ?? "",
      customerName: invoice.customerName ?? "Unknown",
      customerEmail: invoice.customer.email ?? undefined,
      amount: Number(invoice.amount ?? 0),
      currency: invoice.currency ?? "USD",
      dueDate: invoice.dueDate!,
      daysOverdue: Math.max(0, daysOverdue),
    };
  });
}

export type OverdueInvoiceWithBehavior = OverdueInvoiceDetail & {
  typicalPayDays?: number;
  isUnusual: boolean;
  unusualReason?: string;
};

export async function getOverdueInvoicesWithBehavior(
  db: Database,
  params: { teamId: string; currency?: string },
): Promise<OverdueInvoiceWithBehavior[]> {
  const { teamId, currency } = params;
  const overdueInvoices = await getOverdueInvoiceDetails(db, {
    teamId,
    currency,
  });

  if (overdueInvoices.length === 0) {
    return [];
  }

  const behaviorByCustomer = new Map<string, { avgDays: number; count: number }>();
  const paidDaysByCustomer = new Map<string, number[]>();

  for (const invoice of await getProjectedInvoicesByFilters({
    teamId,
    statuses: ["paid"],
    currency,
  })) {
    if (!invoice.customerName || !invoice.paidAt || !invoice.dueDate) {
      continue;
    }

    const avgDaysToPay =
      (new Date(invoice.paidAt).getTime() - new Date(invoice.dueDate).getTime()) /
      (1000 * 60 * 60 * 24);
    const current = paidDaysByCustomer.get(invoice.customerName) ?? [];

    current.push(avgDaysToPay);
    paidDaysByCustomer.set(invoice.customerName, current);
  }

  for (const [customerName, dayValues] of paidDaysByCustomer.entries()) {
    if (dayValues.length < 2) {
      continue;
    }

    const averageDays = dayValues.reduce((sum, value) => sum + value, 0) / dayValues.length;

    behaviorByCustomer.set(customerName, {
      avgDays: Math.max(0, Math.round(averageDays) + 14),
      count: dayValues.length,
    });
  }

  return overdueInvoices.map((invoice) => {
    const behavior = behaviorByCustomer.get(invoice.customerName);

    if (!behavior) {
      return { ...invoice, isUnusual: false };
    }

    const unusualThreshold = Math.max(behavior.avgDays * 1.5, behavior.avgDays + 7);
    const isUnusual = invoice.daysOverdue > unusualThreshold;

    return {
      ...invoice,
      typicalPayDays: behavior.avgDays,
      isUnusual,
      unusualReason: isUnusual ? `usually pays within ${behavior.avgDays} days` : undefined,
    };
  });
}
