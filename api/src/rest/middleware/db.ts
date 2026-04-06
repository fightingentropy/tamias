import { createDatabase } from "@tamias/app-data/client";
import type { MiddlewareHandler } from "hono";

/**
 * Attaches a request-scoped query context to the request.
 */
export const withDatabase: MiddlewareHandler = async (c, next) => {
  c.set("db", createDatabase());

  await next();
};
