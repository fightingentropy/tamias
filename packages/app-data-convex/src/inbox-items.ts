import { api, convexApi, createClient, serviceArgs } from "./base";

export type InboxItemStatus =
  | "new"
  | "archived"
  | "processing"
  | "done"
  | "pending"
  | "analyzing"
  | "suggested_match"
  | "no_match"
  | "other"
  | "deleted";

export type InboxItemType = "invoice" | "expense" | "other";

export type InboxItemRecord = {
  id: string;
  teamId: string;
  createdAt: string;
  updatedAt: string;
  filePath: string[];
  fileName: string | null;
  transactionId: string | null;
  amount: number | null;
  currency: string | null;
  contentType: string | null;
  size: number | null;
  attachmentId: string | null;
  date: string | null;
  forwardedTo: string | null;
  referenceId: string | null;
  meta: Record<string, unknown> | null;
  status: InboxItemStatus;
  website: string | null;
  senderEmail: string | null;
  displayName: string | null;
  type: InboxItemType | null;
  description: string | null;
  baseAmount: number | null;
  baseCurrency: string | null;
  taxAmount: number | null;
  taxRate: number | null;
  taxType: string | null;
  inboxAccountId: string | null;
  invoiceNumber: string | null;
  groupedInboxId: string | null;
};

export type InboxLiabilityAggregateRowRecord = {
  date: string;
  currency: string | null;
  totalAmount: number;
  itemCount: number;
  updatedAt: string;
};

export type InboxStatusCountSummaryRecord = {
  totals: {
    new: number;
    archived: number;
    processing: number;
    done: number;
    pending: number;
    analyzing: number;
    suggested_match: number;
    no_match: number;
    other: number;
    deleted: number;
  };
  rangeCount: number;
};

export type UpsertInboxItemInConvexInput = {
  teamId: string;
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  filePath: string[];
  fileName?: string | null;
  transactionId?: string | null;
  amount?: number | null;
  currency?: string | null;
  contentType?: string | null;
  size?: number | null;
  attachmentId?: string | null;
  date?: string | null;
  forwardedTo?: string | null;
  referenceId?: string | null;
  meta?: Record<string, unknown> | null;
  status: InboxItemStatus;
  website?: string | null;
  senderEmail?: string | null;
  displayName?: string | null;
  type?: InboxItemType | null;
  description?: string | null;
  baseAmount?: number | null;
  baseCurrency?: string | null;
  taxAmount?: number | null;
  taxRate?: number | null;
  taxType?: string | null;
  inboxAccountId?: string | null;
  invoiceNumber?: string | null;
  groupedInboxId?: string | null;
};

export async function getInboxItemsFromConvex(args: {
  teamId: string;
  ids?: string[];
  referenceIds?: string[];
  groupedInboxIds?: string[];
  transactionIds?: string[];
  invoiceNumber?: string | null;
  date?: string | null;
  filePath?: string[];
  statuses?: InboxItemStatus[];
}) {
  return createClient().query(
    api.inbox.serviceGetInboxItems,
    serviceArgs({
      publicTeamId: args.teamId,
      ids: args.ids,
      referenceIds: args.referenceIds,
      groupedInboxIds: args.groupedInboxIds,
      transactionIds: args.transactionIds,
      invoiceNumber: args.invoiceNumber,
      date: args.date,
      filePath: args.filePath,
      statuses: args.statuses,
    }),
  ) as Promise<InboxItemRecord[]>;
}

export async function searchInboxItemsFromConvex(args: {
  teamId: string;
  query: string;
  limit?: number;
}) {
  return createClient().query(
    convexApi.inbox.serviceSearchInboxItems,
    serviceArgs({
      publicTeamId: args.teamId,
      query: args.query,
      limit: args.limit,
    }),
  ) as Promise<InboxItemRecord[]>;
}

export async function getInboxItemsByAmountRangeFromConvex(args: {
  teamId: string;
  minAmount: number;
  maxAmount: number;
  limit?: number;
}) {
  return createClient().query(
    convexApi.inbox.serviceGetInboxItemsByAmountRange,
    serviceArgs({
      publicTeamId: args.teamId,
      minAmount: args.minAmount,
      maxAmount: args.maxAmount,
      limit: args.limit,
    }),
  ) as Promise<InboxItemRecord[]>;
}

export async function getInboxItemsByDatePageFromConvex(args: {
  teamId: string;
  cursor?: string | null;
  pageSize: number;
  order?: "asc" | "desc";
  dateGte?: string | null;
  dateLte?: string | null;
}) {
  return createClient().query(
    convexApi.inbox.serviceListInboxItemsByDatePage,
    serviceArgs({
      publicTeamId: args.teamId,
      order: args.order,
      dateGte: args.dateGte,
      dateLte: args.dateLte,
      paginationOpts: {
        numItems: args.pageSize,
        cursor: args.cursor ?? null,
      },
    }),
  ) as Promise<{
    page: InboxItemRecord[];
    isDone: boolean;
    continueCursor: string;
  }>;
}

export async function getInboxItemsPageFromConvex(args: {
  teamId: string;
  cursor?: string | null;
  pageSize: number;
  status?: InboxItemStatus;
  order?: "asc" | "desc";
  createdAtFrom?: string;
  createdAtTo?: string;
}) {
  return createClient().query(
    convexApi.inbox.serviceListInboxItemsPage,
    serviceArgs({
      publicTeamId: args.teamId,
      status: args.status,
      order: args.order,
      createdAtFrom: args.createdAtFrom,
      createdAtTo: args.createdAtTo,
      paginationOpts: {
        numItems: args.pageSize,
        cursor: args.cursor ?? null,
      },
    }),
  ) as Promise<{
    page: InboxItemRecord[];
    isDone: boolean;
    continueCursor: string;
  }>;
}

export async function getInboxItemByIdFromConvex(args: {
  teamId: string;
  inboxId: string;
}) {
  return createClient().query(
    api.inbox.serviceGetInboxItemById,
    serviceArgs({
      publicTeamId: args.teamId,
      inboxId: args.inboxId,
    }),
  ) as Promise<InboxItemRecord | null>;
}

export async function getInboxItemInfoFromConvex(args: { inboxId: string }) {
  return createClient().query(
    api.inbox.serviceGetInboxItemInfo,
    serviceArgs({
      inboxId: args.inboxId,
    }),
  ) as Promise<InboxItemRecord | null>;
}

export async function getInboxLiabilityAggregateRowsFromConvex(args: {
  teamId: string;
  dateFrom?: string | null;
  dateTo?: string | null;
}) {
  return createClient().query(
    convexApi.inbox.serviceGetInboxLiabilityAggregateRows,
    serviceArgs({
      publicTeamId: args.teamId,
      dateFrom: args.dateFrom,
      dateTo: args.dateTo,
    }),
  ) as Promise<InboxLiabilityAggregateRowRecord[]>;
}

export async function getInboxStatusCountSummaryFromConvex(args: {
  teamId: string;
  createdAtFrom?: string | null;
  createdAtTo?: string | null;
  rangeStatus?: InboxItemStatus;
}) {
  return createClient().query(
    convexApi.inbox.serviceGetInboxStatusCountSummary,
    serviceArgs({
      publicTeamId: args.teamId,
      createdAtFrom: args.createdAtFrom ?? null,
      createdAtTo: args.createdAtTo ?? null,
      rangeStatus: args.rangeStatus,
    }),
  ) as Promise<InboxStatusCountSummaryRecord>;
}

export async function getPendingInboxItemsToNoMatchFromConvex(args: {
  createdAtTo: string;
  cursor?: string | null;
  pageSize: number;
}) {
  return createClient().query(
    api.inbox.serviceListPendingInboxItemsToNoMatch,
    serviceArgs({
      createdAtTo: args.createdAtTo,
      paginationOpts: {
        numItems: args.pageSize,
        cursor: args.cursor ?? null,
      },
    }),
  ) as Promise<{
    page: InboxItemRecord[];
    isDone: boolean;
    continueCursor: string;
  }>;
}

export async function upsertInboxItemsInConvex(args: {
  items: UpsertInboxItemInConvexInput[];
}) {
  return createClient().mutation(
    api.inbox.serviceUpsertInboxItems,
    serviceArgs({
      items: args.items.map((item) => ({
        publicTeamId: item.teamId,
        id: item.id,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        filePath: item.filePath,
        fileName: item.fileName,
        transactionId: item.transactionId,
        amount: item.amount,
        currency: item.currency,
        contentType: item.contentType,
        size: item.size,
        attachmentId: item.attachmentId,
        date: item.date,
        forwardedTo: item.forwardedTo,
        referenceId: item.referenceId,
        meta: item.meta,
        status: item.status,
        website: item.website,
        senderEmail: item.senderEmail,
        displayName: item.displayName,
        type: item.type,
        description: item.description,
        baseAmount: item.baseAmount,
        baseCurrency: item.baseCurrency,
        taxAmount: item.taxAmount,
        taxRate: item.taxRate,
        taxType: item.taxType,
        inboxAccountId: item.inboxAccountId,
        invoiceNumber: item.invoiceNumber,
        groupedInboxId: item.groupedInboxId,
      })),
    }),
  ) as Promise<InboxItemRecord[]>;
}

export async function rebuildInboxLiabilityAggregatesInConvex(args: {
  teamId?: string | null;
}) {
  return createClient().mutation(
    convexApi.inbox.serviceRebuildInboxLiabilityAggregates,
    serviceArgs({
      publicTeamId: args.teamId ?? null,
    }),
  ) as Promise<
    Array<{
      teamId: string;
      inboxItemCount: number;
      inboxLiabilityAggregateRows: number;
    }>
  >;
}

export async function rebuildInboxStatusAggregatesInConvex(args: {
  teamId?: string | null;
}) {
  return createClient().mutation(
    convexApi.inbox.serviceRebuildInboxStatusAggregates,
    serviceArgs({
      publicTeamId: args.teamId ?? null,
    }),
  ) as Promise<
    Array<{
      teamId: string;
      inboxItemCount: number;
      inboxStatusAggregateRows: number;
    }>
  >;
}
