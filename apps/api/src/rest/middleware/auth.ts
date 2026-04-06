import { getRequestAuthDependencies } from "@tamias/app-services/auth";
import { resolveRequestAuth } from "@tamias/auth-session";
import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";

export const withAuth: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader) {
    throw new HTTPException(401, { message: "Authorization header required" });
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer") {
    throw new HTTPException(401, { message: "Invalid authorization scheme" });
  }

  if (!token) {
    throw new HTTPException(401, { message: "Token required" });
  }

  const auth = await resolveRequestAuth(c.req.raw.headers, {
    ...getRequestAuthDependencies(),
    internalApiKey: undefined,
  });

  if (!auth.session) {
    throw new HTTPException(401, { message: "Invalid or expired token" });
  }

  c.set("session", auth.session);
  c.set("teamId", auth.teamId);
  c.set("scopes", auth.scopes);

  await next();
};
