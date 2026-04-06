import {
  getTransactionsPageFromConvex,
  type TransactionRecord,
  type TransactionStatus,
} from "@tamias/app-data-convex";
import type { Database } from "../../client";
import { createQueryCacheKey, getOrSetQueryCacheValue } from "../../client";
import { normalizeTimestampBoundary } from "../date-boundaries";
import { collectCursorPages, DEFAULT_PAGE_SIZE } from "./shared";

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

function getTransactionRangeCacheBucket(db: Database, key: string) {
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

export async function getTransactionsPaged(args: {
  db?: Database;
  teamId: string;
  dateGte?: string | null;
  dateLte?: string | null;
  statusesNotIn?: TransactionStatus[];
  pageSize?: number;
}) {
  const load = async () =>
    collectCursorPages((cursor) =>
      getTransactionsPageFromConvex({
        teamId: args.teamId,
        cursor,
        pageSize: args.pageSize ?? DEFAULT_PAGE_SIZE,
        order: "asc",
        dateGte: args.dateGte,
        dateLte: args.dateLte,
        statusesNotIn: args.statusesNotIn,
      }),
    );

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
