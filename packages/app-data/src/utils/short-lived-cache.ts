import { LocalCache } from "@tamias/cache/local-cache";
import type { Database } from "../client";

export const SHORT_LIVED_READ_TTL_SECONDS = 30;

/**
 * Process-local short-lived cache for expensive team-scoped reads.
 *
 * This complements request-scoped db dedupe by reusing identical results across
 * nearby requests handled by the same instance, while keeping freshness tight.
 */
export function cacheAcrossRequests<TParams, TResult>(args: {
  keyPrefix: string;
  keyFn: (params: TParams) => string;
  load: (db: Database, params: TParams) => Promise<TResult>;
  ttlSeconds?: number;
}) {
  const ttlSeconds = args.ttlSeconds ?? SHORT_LIVED_READ_TTL_SECONDS;
  const cache = new LocalCache<TResult>(ttlSeconds);
  const inflight = new Map<string, Promise<TResult>>();

  return async (db: Database, params: TParams): Promise<TResult> => {
    const key = `${args.keyPrefix}:${args.keyFn(params)}`;
    const cached = cache.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const existing = inflight.get(key);
    if (existing) {
      return existing;
    }

    const promise = args
      .load(db, params)
      .then((result) => {
        cache.set(key, result, ttlSeconds);
        return result;
      })
      .finally(() => {
        inflight.delete(key);
      });

    inflight.set(key, promise);

    return promise;
  };
}
