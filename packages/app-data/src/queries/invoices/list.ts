import type { Database } from "../../client";
import { type InvoiceStatus, getProjectedInvoicesForTeam } from "../invoice-projections";
import {
  buildInvoicePageResponse,
  canUseIndexedInvoicePage,
  compareNullableNumbers,
  compareNullableStrings,
  getIndexedInvoicesPage,
} from "./reads-shared";
import type { GetInvoicesParams } from "./types";
import type { ProjectedInvoiceRecord } from "./shared";

export async function getInvoices(_db: Database, params: GetInvoicesParams) {
  const {
    teamId,
    sort,
    cursor,
    pageSize = 25,
    q,
    statuses,
    start,
    end,
    customers: customerIds,
    ids,
    recurringIds,
    recurring,
  } = params;

  if (
    canUseIndexedInvoicePage({
      sort,
      q,
      ids,
      recurringIds,
    })
  ) {
    return getIndexedInvoicesPage(params);
  }

  let data = await getProjectedInvoicesForTeam(teamId);

  if (ids && ids.length > 0) {
    const idSet = new Set(ids);
    data = data.filter((invoice) => idSet.has(invoice.id));
  }

  if (recurringIds && recurringIds.length > 0) {
    const recurringIdSet = new Set(recurringIds);
    data = data.filter(
      (invoice) => !!invoice.invoiceRecurringId && recurringIdSet.has(invoice.invoiceRecurringId),
    );
  }

  if (recurring === true) {
    data = data.filter((invoice) => !!invoice.invoiceRecurringId);
  } else if (recurring === false) {
    data = data.filter((invoice) => !invoice.invoiceRecurringId);
  }

  if (statuses && statuses.length > 0) {
    const validStatuses = statuses.filter((status) =>
      ["draft", "overdue", "paid", "unpaid", "canceled", "scheduled", "refunded"].includes(status),
    ) as InvoiceStatus[];

    if (validStatuses.length > 0) {
      const statusSet = new Set(validStatuses);
      data = data.filter((invoice) => statusSet.has(invoice.status));
    }
  }

  if (start && end) {
    data = data.filter(
      (invoice) => !!invoice.dueDate && invoice.dueDate >= start && invoice.dueDate <= end,
    );
  }

  if (customerIds && customerIds.length > 0) {
    const customerIdSet = new Set(customerIds);
    data = data.filter((invoice) => !!invoice.customerId && customerIdSet.has(invoice.customerId));
  }

  if (q) {
    const trimmedQuery = q.trim();
    const lowerQuery = trimmedQuery.toLowerCase();

    if (!Number.isNaN(Number.parseInt(trimmedQuery, 10))) {
      const normalizedAmount = Number(trimmedQuery).toString();
      data = data.filter(
        (invoice) =>
          invoice.amount !== null &&
          invoice.amount !== undefined &&
          Number(invoice.amount).toString() === normalizedAmount,
      );
    } else {
      data = data.filter((invoice) => {
        const invoiceNumber = invoice.invoiceNumber.toLowerCase();
        const customerName = (invoice.customerName ?? "").toLowerCase();

        return invoiceNumber.includes(lowerQuery) || customerName.includes(lowerQuery);
      });
    }
  }

  const compareBySort = (left: ProjectedInvoiceRecord, right: ProjectedInvoiceRecord) => {
    if (sort && sort.length === 2) {
      const [column, direction] = sort;
      const multiplier = direction === "asc" ? 1 : -1;

      if (column === "customer") {
        return compareNullableStrings(left.customer?.name, right.customer?.name) * multiplier;
      }

      if (column === "created_at") {
        return compareNullableStrings(left.createdAt, right.createdAt) * multiplier;
      }

      if (column === "due_date") {
        return compareNullableStrings(left.dueDate, right.dueDate) * multiplier;
      }

      if (column === "amount") {
        return compareNullableNumbers(left.amount, right.amount) * multiplier;
      }

      if (column === "status") {
        return compareNullableStrings(left.status, right.status) * multiplier;
      }
    }

    return compareNullableStrings(right.createdAt, left.createdAt);
  };

  data = [...data].sort((left, right) => {
    const result = compareBySort(left, right);

    if (result !== 0) {
      return result;
    }

    return compareNullableStrings(right.id, left.id);
  });

  const offset = cursor ? Number.parseInt(cursor, 10) : 0;
  const pagedData = data.slice(offset, offset + pageSize);

  const nextCursor = pagedData.length === pageSize ? (offset + pageSize).toString() : undefined;

  return {
    ...buildInvoicePageResponse({
      invoices: pagedData,
      cursor,
      nextCursor,
      hasNextPage: pagedData.length === pageSize,
    }),
    meta: {
      cursor: nextCursor ?? null,
      hasPreviousPage: offset > 0,
      hasNextPage: pagedData.length === pageSize,
    },
  };
}
