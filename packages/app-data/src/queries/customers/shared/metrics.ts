import {
  getPublicInvoicesByCustomerIdsFromConvex,
  getTrackerProjectsByCustomerIdsFromConvex,
  type CustomerRecord,
} from "@tamias/app-data-convex";
import type {
  CustomerListMetrics,
  CustomerListRow,
  ProjectedCustomerInvoice,
} from "../types";
import { attachCustomerTags } from "./tags";

function toProjectedCustomerInvoice(
  value: unknown,
): ProjectedCustomerInvoice | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.id !== "string" ||
    typeof record.teamId !== "string" ||
    typeof record.createdAt !== "string"
  ) {
    return null;
  }

  return {
    id: record.id,
    teamId: record.teamId,
    customerId:
      typeof record.customerId === "string" ? record.customerId : null,
    amount: typeof record.amount === "number" ? record.amount : null,
    currency: typeof record.currency === "string" ? record.currency : null,
    status: typeof record.status === "string" ? record.status : null,
    issueDate: typeof record.issueDate === "string" ? record.issueDate : null,
    dueDate: typeof record.dueDate === "string" ? record.dueDate : null,
    token: typeof record.token === "string" ? record.token : null,
    createdAt: record.createdAt,
  };
}

export async function getProjectedInvoicesForCustomers(
  teamId: string,
  customerIds: string[],
) {
  if (customerIds.length === 0) {
    return [];
  }

  return (await getPublicInvoicesByCustomerIdsFromConvex({ teamId, customerIds }))
    .map((record) => toProjectedCustomerInvoice(record.payload))
    .filter(
      (record): record is ProjectedCustomerInvoice =>
        !!record && record.teamId === teamId,
    );
}

function getDefaultCustomerListMetrics(): CustomerListMetrics {
  return {
    invoiceCount: 0,
    totalRevenue: 0,
    outstandingAmount: 0,
    lastInvoiceDate: null,
    invoiceCurrency: null,
  };
}

function buildInvoiceMetricsByCustomerId(invoices: ProjectedCustomerInvoice[]) {
  const metricsByCustomerId = new Map<string, CustomerListMetrics>();

  for (const invoice of invoices) {
    if (!invoice.customerId) {
      continue;
    }

    const current =
      metricsByCustomerId.get(invoice.customerId) ??
      getDefaultCustomerListMetrics();

    current.invoiceCount += 1;

    const amount = invoice.amount ?? 0;

    if (invoice.status === "paid") {
      current.totalRevenue += amount;
    } else if (invoice.status === "unpaid" || invoice.status === "overdue") {
      current.outstandingAmount += amount;
    }

    if (
      invoice.issueDate &&
      (!current.lastInvoiceDate || invoice.issueDate > current.lastInvoiceDate)
    ) {
      current.lastInvoiceDate = invoice.issueDate;
    }

    if (!current.invoiceCurrency && invoice.currency) {
      current.invoiceCurrency = invoice.currency;
    }

    metricsByCustomerId.set(invoice.customerId, current);
  }

  return metricsByCustomerId;
}

function buildProjectCountByCustomerId(
  trackerProjects: Awaited<
    ReturnType<typeof getTrackerProjectsByCustomerIdsFromConvex>
  >,
) {
  const projectCountByCustomerId = new Map<string, number>();

  for (const project of trackerProjects) {
    if (!project.customerId) {
      continue;
    }

    projectCountByCustomerId.set(
      project.customerId,
      (projectCountByCustomerId.get(project.customerId) ?? 0) + 1,
    );
  }

  return projectCountByCustomerId;
}

export async function buildCustomerRows(
  teamId: string,
  customers: CustomerRecord[],
): Promise<CustomerListRow[]> {
  if (customers.length === 0) {
    return [];
  }

  const customerIds = customers.map((customer) => customer.id);
  const [trackerProjects, invoices] = await Promise.all([
    getTrackerProjectsByCustomerIdsFromConvex({
      teamId,
      customerIds,
    }),
    getProjectedInvoicesForCustomers(teamId, customerIds),
  ]);
  const metricsByCustomerId = buildInvoiceMetricsByCustomerId(invoices);
  const projectCountByCustomerId = buildProjectCountByCustomerId(trackerProjects);

  return attachCustomerTags(
    teamId,
    customers.map((customer) => ({
      ...customer,
      ...(metricsByCustomerId.get(customer.id) ??
        getDefaultCustomerListMetrics()),
      projectCount: projectCountByCustomerId.get(customer.id) ?? 0,
    })),
  );
}
