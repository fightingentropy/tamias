import type { MiddlewareHandler } from "hono";

type RateLimitOptions = {
  windowMs: number;
  limit: number;
  keyGenerator: (context: Parameters<MiddlewareHandler>[0]) => string;
  statusCode?: number;
  message?: string;
};

/**
 * Best-effort in-memory limiter for Workers.
 * It avoids timers in global scope and prunes stale entries on access.
 */
export function createRateLimitMiddleware(
  options: RateLimitOptions,
): MiddlewareHandler {
  const requestsByKey = new Map<string, number[]>();

  return async (context, next) => {
    const key = options.keyGenerator(context) || "unknown";
    const now = Date.now();
    const windowStart = now - options.windowMs;
    const recentRequests = (requestsByKey.get(key) ?? []).filter(
      (timestamp) => timestamp > windowStart,
    );

    if (recentRequests.length >= options.limit) {
      return new Response(options.message ?? "Rate limit exceeded", {
        status: options.statusCode ?? 429,
      });
    }

    recentRequests.push(now);
    requestsByKey.set(key, recentRequests);

    await next();
  };
}
