import { LocalCache } from "./local-cache";

// Shared TTL constants for banking provider caching
export const CacheTTL = {
  THIRTY_MINUTES: 1800,
  ONE_HOUR: 3600,
  TWENTY_FOUR_HOURS: 86400,
} as const;

const cache: LocalCache<unknown> = new LocalCache(30 * 60);

export const bankingCache = {
  get: (key: string): Promise<any | undefined> =>
    Promise.resolve(cache.get(key)),
  set: (key: string, value: any, ttl?: number): Promise<void> => {
    cache.set(key, value, ttl);
    return Promise.resolve();
  },
  delete: (key: string): Promise<void> => {
    cache.delete(key);
    return Promise.resolve();
  },

  /**
   * Get a cached value or compute and store it.
   * Eliminates the repeated check-cache / fetch / store pattern.
   */
  getOrSet: async <T>(
    key: string,
    ttl: number,
    fn: () => Promise<T>,
  ): Promise<T> => {
    const cached = cache.get(key) as T | undefined;
    if (cached !== undefined) return cached;
    const result = await fn();
    cache.set(key, result, ttl);
    return result;
  },
};
