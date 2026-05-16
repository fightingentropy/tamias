import { OpenAPIHono } from "@hono/zod-openapi";
import { handleDashboardAuthAction } from "@tamias/app-services/first-party-auth";
import { HTTPException } from "hono/http-exception";
import { publicMiddleware } from "../middleware";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import type { Context } from "../types";

const app = new OpenAPIHono<Context>();

app.use("*", ...publicMiddleware);
app.use(
  "*",
  createRateLimitMiddleware({
    name: "dashboard-auth",
    windowMs: 10 * 60 * 1000,
    limit: 50,
    keyGenerator: (c) => c.get("clientIp") || "unknown",
    statusCode: 429,
    message: "Rate limit exceeded",
  }),
);

function getBearerToken(header: string | undefined) {
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim() || null;
}

app.post("/", async (c) => {
  const body = (await c.req.json().catch(() => null)) as
    | {
        action?: unknown;
        args?: unknown;
      }
    | null;

  if (!body || typeof body.action !== "string") {
    throw new HTTPException(400, { message: "Invalid auth body" });
  }

  if (body.action !== "auth:signIn" && body.action !== "auth:signOut") {
    throw new HTTPException(400, { message: "Invalid auth action" });
  }

  try {
    const result = await handleDashboardAuthAction(
      {
        action: body.action,
        args:
          body.args && typeof body.args === "object" ? (body.args as Record<string, unknown>) : {},
      },
      {
        db: c.get("db"),
        accessToken: getBearerToken(c.req.header("Authorization")),
        userAgent: c.req.header("User-Agent") ?? null,
        ip: c.get("clientIp") ?? null,
      },
    );

    return c.json(result);
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "Authentication failed",
      },
      400,
    );
  }
});

export { app as authRouter };
