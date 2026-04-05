import type { MiddlewareHandler } from "hono";
import { withAuth } from "./auth";
import { withDatabase } from "./db";
import { withClientIp } from "./ip";
import { createRateLimitMiddleware } from "./rate-limit";

/**
 * Public endpoint middleware.
 * No authentication required
 */
export const publicMiddleware: MiddlewareHandler[] = [
  withClientIp,
  withDatabase,
];

/**
 * Protected endpoint middleware - requires authentication
 * Supports both API keys and OAuth tokens in a single unified middleware
 * Note: withAuth must be first to set session in context
 */
export const protectedMiddleware: MiddlewareHandler[] = [
  withClientIp,
  withDatabase,
  withAuth,
  createRateLimitMiddleware({
    name: "protected-rest-api",
    windowMs: 10 * 60 * 1000, // 10 minutes
    limit: 100,
    keyGenerator: (c) => {
      return c.get("session")?.user?.id ?? "unknown";
    },
    statusCode: 429,
    message: "Rate limit exceeded",
  }),
];

export const fileMiddleware: MiddlewareHandler[] = [
  withClientIp,
  withDatabase,
  withAuth,
];

export { withRequiredScope } from "./scope";
