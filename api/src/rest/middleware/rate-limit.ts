import type { MiddlewareHandler } from "hono";
import {
  createRateLimitBucketName,
  type RateLimitOutcome,
} from "../../rate-limit/shared";
import type { Context } from "../types";

type RateLimitOptions = {
  name: string;
  windowMs: number;
  limit: number;
  keyGenerator: (context: Parameters<MiddlewareHandler<Context>>[0]) => string;
  statusCode?: number;
  message?: string;
};

export function createRateLimitMiddleware(
  options: RateLimitOptions,
): MiddlewareHandler<Context> {
  return async (context, next) => {
    const key = options.keyGenerator(context) || "unknown";
    const bucketName = createRateLimitBucketName(options.name, key);
    const coordinator = context.env.RATE_LIMIT_COORDINATOR;
    const outcome = (await coordinator.getByName(bucketName).consume({
      key,
      limit: options.limit,
      windowMs: options.windowMs,
    })) as RateLimitOutcome;
    const headers = buildRateLimitHeaders(outcome);

    if (!outcome.allowed) {
      return new Response(options.message ?? "Rate limit exceeded", {
        status: options.statusCode ?? 429,
        headers,
      });
    }

    await next();

    for (const [header, value] of headers) {
      context.res.headers.set(header, value);
    }
  };
}

function buildRateLimitHeaders(outcome: RateLimitOutcome) {
  return new Headers({
    "X-RateLimit-Limit": String(outcome.limit),
    "X-RateLimit-Remaining": String(outcome.remaining),
    "X-RateLimit-Reset": String(Math.ceil(outcome.resetAt / 1000)),
    "Retry-After": String(Math.ceil(outcome.retryAfterMs / 1000)),
  });
}
