import {
  getInboxItemsByDatePageFromConvex,
  getInboxItemsPageFromConvex,
  getPublicInvoicesPageFromConvex,
  getTransactionsPageFromConvex,
  type InboxItemRecord,
  type InboxItemStatus,
  type TransactionRecord,
  type TransactionStatus,
} from "@tamias/app-data-convex";
import { normalizeTimestampBoundary } from "./date-boundaries";
import {
  getProjectedInvoicePayload,
  type ProjectedInvoiceRecord,
} from "./invoices/shared";

const DEFAULT_PAGE_SIZE = 250;

async function collectPublicInvoicePages(args: {
  teamId: string;
  status?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
  pageSize?: number;
}) {
  const records = [];
  let cursor: string | null = null;

  while (true) {
    const result = await getPublicInvoicesPageFromConvex({
      teamId: args.teamId,
      cursor,
      pageSize: args.pageSize ?? DEFAULT_PAGE_SIZE,
      status: args.status,
      order: "asc",
      createdAtFrom: args.createdAtFrom,
      createdAtTo: args.createdAtTo,
    });

    records.push(...result.page);

    if (result.isDone) {
      return records;
    }

    cursor = result.continueCursor;
  }
}

export async function getProjectedInvoicesPaged(args: {
  teamId: string;
  statuses?: string[];
  createdAtFrom?: string;
  createdAtTo?: string;
  pageSize?: number;
}) {
  const createdAtFrom = args.createdAtFrom
    ? normalizeTimestampBoundary(args.createdAtFrom, "start")
    : undefined;
  const createdAtTo = args.createdAtTo
    ? normalizeTimestampBoundary(args.createdAtTo, "end")
    : undefined;
  const statuses =
    args.statuses && args.statuses.length > 0
      ? [...new Set(args.statuses)]
      : null;

  const records = statuses
    ? (
        await Promise.all(
          statuses.map((status) =>
            collectPublicInvoicePages({
              teamId: args.teamId,
              status,
              createdAtFrom,
              createdAtTo,
              pageSize: args.pageSize,
            }),
          ),
        )
      ).flat()
    : await collectPublicInvoicePages({
        teamId: args.teamId,
        createdAtFrom,
        createdAtTo,
        pageSize: args.pageSize,
      });

  return records.flatMap((record) => {
    const projected = getProjectedInvoicePayload(record);

    return projected && projected.teamId === args.teamId ? [projected] : [];
  }) as ProjectedInvoiceRecord[];
}

export async function getTransactionsPaged(args: {
  teamId: string;
  dateGte?: string | null;
  dateLte?: string | null;
  statusesNotIn?: TransactionStatus[];
  pageSize?: number;
}) {
  const records: TransactionRecord[] = [];
  let cursor: string | null = null;

  while (true) {
    const result = await getTransactionsPageFromConvex({
      teamId: args.teamId,
      cursor,
      pageSize: args.pageSize ?? DEFAULT_PAGE_SIZE,
      order: "asc",
      dateGte: args.dateGte,
      dateLte: args.dateLte,
      statusesNotIn: args.statusesNotIn,
    });

    records.push(...result.page);

    if (result.isDone) {
      return records;
    }

    cursor = result.continueCursor;
  }
}

export async function getInboxItemsPaged(args: {
  teamId: string;
  status?: InboxItemStatus;
  createdAtFrom?: string;
  createdAtTo?: string;
  order?: "asc" | "desc";
  pageSize?: number;
}) {
  const records: InboxItemRecord[] = [];
  let cursor: string | null = null;

  while (true) {
    const result = await getInboxItemsPageFromConvex({
      teamId: args.teamId,
      cursor,
      pageSize: args.pageSize ?? DEFAULT_PAGE_SIZE,
      status: args.status,
      order: args.order ?? "desc",
      createdAtFrom: args.createdAtFrom,
      createdAtTo: args.createdAtTo,
    });

    records.push(...result.page);

    if (result.isDone) {
      return records;
    }

    cursor = result.continueCursor;
  }
}

export async function getInboxItemsByDatePaged(args: {
  teamId: string;
  dateGte?: string | null;
  dateLte?: string | null;
  order?: "asc" | "desc";
  pageSize?: number;
}) {
  const records: InboxItemRecord[] = [];
  let cursor: string | null = null;

  while (true) {
    const result = await getInboxItemsByDatePageFromConvex({
      teamId: args.teamId,
      cursor,
      pageSize: args.pageSize ?? DEFAULT_PAGE_SIZE,
      order: args.order ?? "desc",
      dateGte: args.dateGte,
      dateLte: args.dateLte,
    });

    records.push(...result.page);

    if (result.isDone) {
      return records;
    }

    cursor = result.continueCursor;
  }
}

export async function countInboxItemsPaged(args: {
  teamId: string;
  status?: InboxItemStatus;
  createdAtFrom?: string;
  createdAtTo?: string;
  pageSize?: number;
}) {
  let cursor: string | null = null;
  let count = 0;

  while (true) {
    const result = await getInboxItemsPageFromConvex({
      teamId: args.teamId,
      cursor,
      pageSize: args.pageSize ?? DEFAULT_PAGE_SIZE,
      status: args.status,
      order: "asc",
      createdAtFrom: args.createdAtFrom,
      createdAtTo: args.createdAtTo,
    });

    count += result.page.length;

    if (result.isDone) {
      return count;
    }

    cursor = result.continueCursor;
  }
}
