import { db } from "@tamias/app-data/client";
import type { MiddlewareHandler } from "hono";

/**
 * Attaches the shared query context to the request.
 */
export const withDatabase: MiddlewareHandler = async (c, next) => {
  c.set("db", db);

  await next();
};
