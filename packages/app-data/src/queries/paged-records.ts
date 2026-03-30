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
import type { Database } from "../client";
import {
  createQueryCacheKey,
  getOrSetQueryCacheValue,
} from "../client";
import { normalizeTimestampBoundary } from "./date-boundaries";
import {
  getProjectedInvoicePayload,
  type ProjectedInvoiceRecord,
} from "./invoices/shared";

const DEFAULT_PAGE_SIZE = 250;
const transactionRangeCache = new WeakMap<
  Database,
  Map<
    string,
    Array<{
      dateGte: string | null;
      dateLte: string | null;
      records: TransactionRecord[];
    }>
  >
>();

function getTransactionRangeCacheBucket(
  db: Database,
  key: string,
) {
  let cacheByDb = transactionRangeCache.get(db);

  if (!cacheByDb) {
    cacheByDb = new Map();
    transactionRangeCache.set(db, cacheByDb);
  }

  const existing = cacheByDb.get(key);

  if (existing) {
    return existing;
  }

  const bucket: Array<{
    dateGte: string | null;
    dateLte: string | null;
    records: TransactionRecord[];
  }> = [];
  cacheByDb.set(key, bucket);
  return bucket;
}

function normalizeRangeBoundary(
  value: string | null | undefined,
  boundary: "start" | "end",
) {
  if (!value) {
    return null;
  }

  return normalizeTimestampBoundary(value, boundary);
}

function doesCachedRangeContainRequest(
  cached: {
    dateGte: string | null;
    dateLte: string | null;
  },
  requested: {
    dateGte: string | null;
    dateLte: string | null;
  },
) {
  const lowerBoundMatches =
    cached.dateGte === null ||
    (requested.dateGte !== null && cached.dateGte <= requested.dateGte);
  const upperBoundMatches =
    cached.dateLte === null ||
    (requested.dateLte !== null && cached.dateLte >= requested.dateLte);

  return lowerBoundMatches && upperBoundMatches;
}

function filterTransactionsByRange(
  records: TransactionRecord[],
  requested: {
    dateGte: string | null;
    dateLte: string | null;
  },
) {
  if (!requested.dateGte && !requested.dateLte) {
    return records;
  }

  return records.filter((record) => {
    const recordDate = normalizeTimestampBoundary(record.date, "start");

    if (requested.dateGte && recordDate < requested.dateGte) {
      return false;
    }

    if (requested.dateLte && recordDate > requested.dateLte) {
      return false;
    }

    return true;
  });
}

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
  db?: Database;
  teamId: string;
  dateGte?: string | null;
  dateLte?: string | null;
  statusesNotIn?: TransactionStatus[];
  pageSize?: number;
}) {
  const load = async () => {
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
  };

  if (!args.db) {
    return load();
  }

  const normalizedRange = {
    dateGte: normalizeRangeBoundary(args.dateGte, "start"),
    dateLte: normalizeRangeBoundary(args.dateLte, "end"),
  };
  const rangeBucketKey = createQueryCacheKey("paged-records:transactions:range", {
    teamId: args.teamId,
    statusesNotIn: args.statusesNotIn ?? null,
    pageSize: args.pageSize ?? DEFAULT_PAGE_SIZE,
  });
  const cachedRange = getTransactionRangeCacheBucket(args.db, rangeBucketKey).find(
    (entry) => doesCachedRangeContainRequest(entry, normalizedRange),
  );

  if (cachedRange) {
    return filterTransactionsByRange(cachedRange.records, normalizedRange);
  }

  return getOrSetQueryCacheValue(
    args.db,
    createQueryCacheKey("paged-records:transactions", {
      teamId: args.teamId,
      dateGte: args.dateGte ?? null,
      dateLte: args.dateLte ?? null,
      statusesNotIn: args.statusesNotIn ?? null,
      pageSize: args.pageSize ?? DEFAULT_PAGE_SIZE,
    }),
    async () => {
      const records = await load();
      const bucket = getTransactionRangeCacheBucket(args.db!, rangeBucketKey);

      bucket.push({
        ...normalizedRange,
        records,
      });

      return records;
    },
  );
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
