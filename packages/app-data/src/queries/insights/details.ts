import {
  getCustomersByIdsFromConvex,
  getInvoiceAgingAggregateRowsFromConvex,
  getTrackerEntriesByProjectIdsFromConvex,
  getTrackerProjectsFromConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../../client";
import { getProjectedInvoicesByFilters } from "../invoice-projections";
import { isDefined } from "./shared";

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
    .sort((left, right) =>
      (left.dueDate ?? "").localeCompare(right.dueDate ?? ""),
    );

  const now = new Date();

  return result.map((inv) => {
    const dueDate = new Date(inv.dueDate!);
    const daysOverdue = Math.floor(
      (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber ?? "",
      customerName: inv.customerName ?? "Unknown",
      customerEmail: inv.customer.email ?? undefined,
      amount: Number(inv.amount ?? 0),
      currency: inv.currency ?? "USD",
      dueDate: inv.dueDate!,
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

  const behaviorMap = new Map<string, { avgDays: number; count: number }>();
  const paidByCustomer = new Map<string, number[]>();
  for (const invoice of await getProjectedInvoicesByFilters({
    teamId,
    statuses: ["paid"],
    currency,
  })) {
    if (!invoice.customerName || !invoice.paidAt || !invoice.dueDate) {
      continue;
    }

    const avgDaysToPay =
      (new Date(invoice.paidAt).getTime() -
        new Date(invoice.dueDate).getTime()) /
      (1000 * 60 * 60 * 24);
    const current = paidByCustomer.get(invoice.customerName) ?? [];
    current.push(avgDaysToPay);
    paidByCustomer.set(invoice.customerName, current);
  }

  for (const [customerName, dayValues] of paidByCustomer.entries()) {
    if (dayValues.length < 2) {
      continue;
    }

    const averageDays =
      dayValues.reduce((sum, value) => sum + value, 0) / dayValues.length;
    const normalPayDays = Math.max(0, Math.round(averageDays) + 14);
    behaviorMap.set(customerName, {
      avgDays: normalPayDays,
      count: dayValues.length,
    });
  }

  return overdueInvoices.map((inv) => {
    const behavior = behaviorMap.get(inv.customerName);

    if (!behavior) {
      return { ...inv, isUnusual: false };
    }

    const unusualThreshold = Math.max(
      behavior.avgDays * 1.5,
      behavior.avgDays + 7,
    );
    const isUnusual = inv.daysOverdue > unusualThreshold;

    return {
      ...inv,
      typicalPayDays: behavior.avgDays,
      isUnusual,
      unusualReason: isUnusual
        ? `usually pays within ${behavior.avgDays} days`
        : undefined,
    };
  });
}

export type UnbilledHoursDetail = {
  projectId: string;
  projectName: string;
  customerName?: string;
  hours: number;
  rate: number;
  currency: string;
  billableAmount: number;
};

export async function getUnbilledHoursDetails(
  _db: Database,
  params: { teamId: string; currency?: string },
): Promise<UnbilledHoursDetail[]> {
  const { teamId, currency } = params;
  const projects = await getTrackerProjectsFromConvex({ teamId });
  const filteredProjects = currency
    ? projects.filter((project) => project.currency === currency)
    : projects;
  const entries = await getTrackerEntriesByProjectIdsFromConvex({
    teamId,
    projectIds: filteredProjects.map((project) => project.id),
  });
  const customerIds = filteredProjects
    .map((project) => project.customerId)
    .filter(isDefined);
  const customerRows = customerIds.length
    ? await getCustomersByIdsFromConvex({
        teamId,
        customerIds: [...new Set(customerIds)],
      })
    : [];
  const customerNameById = new Map(
    customerRows.map((row) => [row.id, row.name]),
  );
  const projectById = new Map(
    filteredProjects.map((project) => [project.id, project]),
  );
  const totalsByProject = new Map<string, number>();

  for (const entry of entries) {
    if (!entry.projectId || entry.billed) {
      continue;
    }

    totalsByProject.set(
      entry.projectId,
      (totalsByProject.get(entry.projectId) ?? 0) + (entry.duration ?? 0),
    );
  }

  return [...totalsByProject.entries()]
    .flatMap(([projectId, totalSeconds]) => {
      const project = projectById.get(projectId);

      if (!project) {
        return [];
      }

      const hours = Math.round((totalSeconds / 3600) * 10) / 10;
      const rate = Number(project.rate ?? 0);
      const billableAmount = Math.round(hours * rate * 100) / 100;

      return [
        {
          projectId,
          projectName: project.name,
          customerName: project.customerId
            ? (customerNameById.get(project.customerId) ?? undefined)
            : undefined,
          hours,
          rate,
          currency: project.currency ?? "USD",
          billableAmount,
        },
      ];
    })
    .filter((row) => row.hours > 0)
    .sort((a, b) => b.billableAmount - a.billableAmount);
}

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
  ).sort(
    (left, right) => (Number(right.amount) || 0) - (Number(left.amount) || 0),
  );

  return result.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber ?? undefined,
    customerName: inv.customerName ?? "Unknown",
    amount: Number(inv.amount ?? 0),
    currency: inv.currency ?? "USD",
    createdAt: inv.createdAt ?? new Date().toISOString(),
  }));
}

export type UpcomingInvoicesResult = {
  totalDue: number;
  count: number;
  currency: string;
};

export async function getUpcomingInvoicesForInsight(
  _db: Database,
  params: {
    teamId: string;
    fromDate: Date;
    toDate: Date;
    currency?: string;
  },
): Promise<UpcomingInvoicesResult> {
  const { teamId, fromDate, toDate, currency } = params;
  const dueDateFrom = fromDate.toISOString().slice(0, 10);
  const dueDateTo = toDate.toISOString().slice(0, 10);
  const matchingRows = (
    await getInvoiceAgingAggregateRowsFromConvex({
      teamId,
      statuses: ["unpaid", "overdue"],
      currency: currency ?? null,
    })
  ).filter(
    (row) =>
      !!row.dueDate && row.dueDate >= dueDateFrom && row.dueDate <= dueDateTo,
  );
  const row = matchingRows.length
    ? {
        totalAmount: matchingRows.reduce(
          (sum, aggregateRow) => sum + aggregateRow.totalAmount,
          0,
        ),
        invoiceCount: matchingRows.reduce(
          (sum, aggregateRow) => sum + aggregateRow.invoiceCount,
          0,
        ),
        currency: matchingRows[0]?.currency ?? null,
      }
    : null;

  return {
    totalDue: Number(row?.totalAmount ?? 0),
    count: row?.invoiceCount ?? 0,
    currency: row?.currency ?? currency ?? "USD",
  };
}

export type OverdueInvoicesSummary = {
  count: number;
  totalAmount: number;
  oldestDays: number;
  currency: string;
};

export async function getOverdueInvoicesSummary(
  _db: Database,
  params: {
    teamId: string;
    asOfDate: Date;
    currency?: string;
  },
): Promise<OverdueInvoicesSummary> {
  const { teamId, asOfDate, currency } = params;
  const asOfBoundary = asOfDate.toISOString().slice(0, 10);
  const overdueRows = (
    await getInvoiceAgingAggregateRowsFromConvex({
      teamId,
      statuses: ["overdue"],
      currency: currency ?? null,
    })
  ).filter((row) => !!row.dueDate && row.dueDate < asOfBoundary);

  const summaryResult =
    overdueRows.length > 0
      ? {
          totalAmount: overdueRows.reduce(
            (sum, aggregateRow) => sum + aggregateRow.totalAmount,
            0,
          ),
          invoiceCount: overdueRows.reduce(
            (sum, aggregateRow) => sum + aggregateRow.invoiceCount,
            0,
          ),
          oldestDueDate:
            [...overdueRows]
              .map((aggregateRow) => aggregateRow.dueDate!)
              .sort((left, right) => left.localeCompare(right))[0] ??
            asOfDate.toISOString(),
          currency: overdueRows[0]?.currency ?? null,
        }
      : null;

  if (!summaryResult || summaryResult.invoiceCount === 0) {
    return {
      count: 0,
      totalAmount: 0,
      oldestDays: 0,
      currency: currency ?? "USD",
    };
  }

  const oldestDueDate = new Date(summaryResult.oldestDueDate);
  const oldestDays = Math.floor(
    (asOfDate.getTime() - oldestDueDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  return {
    count: summaryResult.invoiceCount,
    totalAmount: Number(summaryResult.totalAmount),
    oldestDays: Math.max(0, oldestDays),
    currency: summaryResult.currency ?? currency ?? "USD",
  };
}
