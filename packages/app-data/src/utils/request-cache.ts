import {
  createQueryCacheKey,
  getOrSetQueryCacheValue,
  type Database,
} from "../client";

/**
 * Reuse identical query results within a single request context.
 *
 * This keeps dedupe scoped to the request-owned database handle so results do
 * not leak or diverge across Cloudflare isolates.
 */
export function reuseQueryResult<TParams, TResult>(args: {
  keyPrefix: string;
  keyFn: (params: TParams) => string;
  load: (db: Database, params: TParams) => Promise<TResult>;
}) {
  return async (db: Database, params: TParams): Promise<TResult> => {
    const key = createQueryCacheKey(args.keyPrefix, args.keyFn(params));

    return getOrSetQueryCacheValue(db, key, () => args.load(db, params));
  };
}
